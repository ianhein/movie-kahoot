"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import useSWR, { mutate } from "swr";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ThumbsUp, ThumbsDown, Check, Film, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getProposedMovies,
  voteForMovie,
  selectMovie,
  removeProposedMovie,
} from "@/app/actions/movie-actions";
import { getMovieDetails, getPosterUrl } from "@/lib/tmdb";
import { toast } from "sonner";
import type { RoomMovie, ProposedMoviesProps } from "@/lib/types";
import { MovieDetailsDialog } from "@/components/movie/movie-details-dialog";

export function ProposedMovies({
  roomId,
  userId,
  isHost,
}: ProposedMoviesProps) {
  const router = useRouter();
  const t = useTranslations("room");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [movies, setMovies] = useState<RoomMovie[]>([]);
  const [localizedMovies, setLocalizedMovies] = useState<
    Map<string, { title: string; overview: string | null }>
  >(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [votingFor, setVotingFor] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [loadingImages, setLoadingImages] = useState<Set<string>>(new Set());
  const [selectedMovieId, setSelectedMovieId] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [removeDialogOpen, setRemoveDialogOpen] = useState(false);
  const [movieToRemove, setMovieToRemove] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // SWR para películas propuestas - polling + broadcast para actualizaciones instantáneas
  const { data: moviesData } = useSWR(
    `proposed-movies-${roomId}`,
    async () => {
      const result = await getProposedMovies(roomId);
      if (result.movies) {
        return result.movies as RoomMovie[];
      }
      return [];
    },
    {
      refreshInterval: 15000, // Polling cada 15s como fallback
      revalidateOnFocus: true,
      dedupingInterval: 1000,
    }
  );

  // Actualizar estado local cuando SWR obtiene nuevos datos
  useEffect(() => {
    if (moviesData) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newMovies = moviesData as any;

      setMovies((prevMovies) => {
        const prevIds = new Set(prevMovies.map((m) => m.id));
        const newImageIds = newMovies
          .filter((m: RoomMovie) => m.movies?.poster_url && !prevIds.has(m.id))
          .map((m: RoomMovie) => m.id);

        if (newImageIds.length > 0) {
          setLoadingImages((prev) => {
            const next = new Set(prev);
            newImageIds.forEach((id: string) => next.add(id));
            return next;
          });
        }

        return newMovies;
      });
      setIsLoading(false);
    }
  }, [moviesData]);

  // Cargar traducciones de películas cuando cambie el locale o las películas
  useEffect(() => {
    const loadLocalizedData = async () => {
      if (movies.length === 0) return;

      const newLocalizedMovies = new Map<
        string,
        { title: string; overview: string | null }
      >();

      // Cargar en paralelo todos los detalles de TMDB
      await Promise.all(
        movies.map(async (roomMovie) => {
          if (!roomMovie.movies?.id) return;
          try {
            const details = await getMovieDetails(roomMovie.movies.id, locale);
            newLocalizedMovies.set(roomMovie.movies.id, {
              title: details.title,
              overview: details.overview,
            });
          } catch {
            // Fallback a datos de BD si falla
            if (roomMovie.movies) {
              newLocalizedMovies.set(roomMovie.movies.id, {
                title: roomMovie.movies.title,
                overview: roomMovie.movies.overview,
              });
            }
          }
        })
      );

      setLocalizedMovies(newLocalizedMovies);
    };

    loadLocalizedData();
  }, [movies, locale]);

  // Suscribirse a broadcast para actualizaciones instantáneas
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`movies-control:${roomId}`)
      .on("broadcast", { event: "movies_updated" }, () => {
        // Revalidar SWR inmediatamente
        mutate(`proposed-movies-${roomId}`);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const handleImageLoad = (roomMovieId: string) => {
    setLoadingImages((prev) => {
      const next = new Set(prev);
      next.delete(roomMovieId);
      return next;
    });
  };

  // Función helper para enviar broadcast de actualización
  const broadcastMoviesUpdate = async () => {
    const supabase = createClient();
    const channel = supabase.channel(`movies-control:${roomId}`);
    await channel.subscribe();
    await channel.send({
      type: "broadcast",
      event: "movies_updated",
      payload: { timestamp: Date.now() },
    });
    supabase.removeChannel(channel);
  };

  const handleVote = async (roomMovieId: string, vote: boolean) => {
    setVotingFor(roomMovieId);
    try {
      const result = await voteForMovie(roomMovieId, userId, vote);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(vote ? `${tCommon("yes")}! 👍` : `${tCommon("no")} 👎`);
        // Notificar a todos los clientes
        broadcastMoviesUpdate();
        // También revalidar localmente
        mutate(`proposed-movies-${roomId}`);
      }
    } catch {
      toast.error(t("voteFailed"));
    } finally {
      setVotingFor(null);
    }
  };

  const handleSelectMovie = async (roomMovieId: string) => {
    setSelecting(roomMovieId);
    try {
      const result = await selectMovie(roomId, roomMovieId);
      if (result.error) {
        toast.error(result.error);
        setSelecting(null);
      } else {
        toast.success(t("startingQuiz"));

        // Enviar broadcast a todos los miembros de la sala usando canal dedicado
        const supabase = createClient();
        const broadcastChannel = supabase.channel(`room-control:${roomId}`, {
          config: { broadcast: { ack: true } },
        });

        await broadcastChannel.subscribe();
        await broadcastChannel.send({
          type: "broadcast",
          event: "quiz_started",
          payload: { timestamp: Date.now() },
        });

        // Limpiar el canal y redirigir
        supabase.removeChannel(broadcastChannel);
        router.push(`/room/${roomId}/quiz`);
      }
    } catch {
      toast.error(t("selectFailed"));
      setSelecting(null);
    }
  };

  const handleRemoveMovie = async (
    roomMovieId: string,
    movieTitle: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setMovieToRemove({ id: roomMovieId, title: movieTitle });
    setRemoveDialogOpen(true);
  };

  const confirmRemoveMovie = async () => {
    if (!movieToRemove) return;

    setRemoving(movieToRemove.id);
    try {
      const result = await removeProposedMovie(roomId, movieToRemove.id);
      if (result.error) {
        toast.error(result.error);
        setRemoving(null);
        setRemoveDialogOpen(false);
        setMovieToRemove(null);
      } else {
        // Notificar a todos los clientes y revalidar localmente
        await broadcastMoviesUpdate();
        await mutate(`proposed-movies-${roomId}`);
        toast.success(t("movieRemoved", { title: movieToRemove.title }));
        setRemoving(null);
        setRemoveDialogOpen(false);
        setMovieToRemove(null);
      }
    } catch {
      toast.error(t("removeFailed"));
      setRemoving(null);
      setRemoveDialogOpen(false);
      setMovieToRemove(null);
    }
  };

  const getUserVote = (roomMovie: RoomMovie) => {
    return roomMovie.movie_votes.find((v) => v.user_id === userId);
  };

  const getVoteCount = (roomMovie: RoomMovie) => {
    const upvotes = roomMovie.movie_votes.filter((v) => v.vote).length;
    const downvotes = roomMovie.movie_votes.filter((v) => !v.vote).length;
    return { upvotes, downvotes };
  };

  const handleOpenDetails = (movieId: string) => {
    setSelectedMovieId(movieId);
    setDetailsDialogOpen(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {tCommon("loading")}
        </CardContent>
      </Card>
    );
  }

  if (movies.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          {t("noMoviesYet")}. {t("beFirstToPropose")}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-base md:text-lg">
          {t("proposedMovies")}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0 space-y-3">
        <AnimatePresence>
          {movies.map((roomMovie, index) => {
            if (!roomMovie.movies) return null;

            const userVote = getUserVote(roomMovie);
            const { upvotes, downvotes } = getVoteCount(roomMovie);
            const movie = roomMovie.movies;
            const isImageLoading = loadingImages.has(roomMovie.id);
            const localized = localizedMovies.get(movie.id);
            const displayTitle = localized?.title || movie.title;
            const displayOverview = localized?.overview || movie.overview;

            return (
              <motion.div
                key={roomMovie.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                layout
                className="flex gap-2 md:gap-3 p-2 md:p-3 rounded-lg border bg-card cursor-pointer hover:bg-accent transition-colors"
                onClick={() => handleOpenDetails(movie.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    handleOpenDetails(movie.id);
                  }
                }}
              >
                {movie.poster_url ? (
                  <div className="relative w-16 h-24 md:w-20 md:h-28 shrink-0">
                    {isImageLoading && (
                      <div className="absolute inset-0 bg-muted rounded flex items-center justify-center">
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      </div>
                    )}
                    <img
                      src={movie.poster_url}
                      alt={displayTitle}
                      className={`w-full h-full object-cover rounded ${
                        isImageLoading ? "opacity-0" : "opacity-100"
                      } transition-opacity duration-300`}
                      onLoad={() => handleImageLoad(roomMovie.id)}
                      onError={() => handleImageLoad(roomMovie.id)}
                    />
                  </div>
                ) : (
                  <div className="w-16 h-24 md:w-20 md:h-28 bg-muted rounded flex items-center justify-center flex-shrink-0">
                    <Film className="w-6 h-6 md:w-8 md:h-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1 md:gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm md:text-base truncate">
                        {displayTitle}
                      </h3>
                      {movie.year && (
                        <p className="text-xs md:text-sm text-muted-foreground">
                          {movie.year}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 md:gap-2 shrink-0">
                      {isHost && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={(e) =>
                            handleRemoveMovie(roomMovie.id, displayTitle, e)
                          }
                          disabled={removing === roomMovie.id}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                      <motion.div
                        key={`up-${upvotes}`}
                        initial={{ scale: 1 }}
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 0.3 }}
                      >
                        <Badge
                          variant="secondary"
                          className="gap-0.5 md:gap-1 text-xs md:text-sm px-1.5 md:px-2"
                        >
                          <ThumbsUp className="w-3 h-3" />
                          {upvotes}
                        </Badge>
                      </motion.div>
                      <motion.div
                        key={`down-${downvotes}`}
                        initial={{ scale: 1 }}
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 0.3 }}
                      >
                        <Badge
                          variant="secondary"
                          className="gap-0.5 md:gap-1 text-xs md:text-sm px-1.5 md:px-2"
                        >
                          <ThumbsDown className="w-3 h-3" />
                          {downvotes}
                        </Badge>
                      </motion.div>
                    </div>
                  </div>
                  <p className="text-xs md:text-sm text-muted-foreground mt-1 md:mt-2 line-clamp-2 hidden sm:block">
                    {displayOverview}
                  </p>
                  <div className="flex flex-wrap gap-1.5 md:gap-2 mt-2 md:mt-3">
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        size="sm"
                        variant={
                          userVote?.vote === true ? "default" : "outline"
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVote(roomMovie.id, true);
                        }}
                        disabled={votingFor === roomMovie.id}
                        className="h-8 text-xs md:text-sm"
                      >
                        <ThumbsUp className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
                        <span className="hidden sm:inline">
                          {tCommon("yes")}
                        </span>
                      </Button>
                    </motion.div>
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button
                        size="sm"
                        variant={
                          userVote?.vote === false ? "destructive" : "outline"
                        }
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVote(roomMovie.id, false);
                        }}
                        disabled={votingFor === roomMovie.id}
                        className="h-8 text-xs md:text-sm"
                      >
                        <ThumbsDown className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
                        <span className="hidden sm:inline">
                          {tCommon("no")}
                        </span>
                      </Button>
                    </motion.div>
                    {isHost && (
                      <motion.div
                        className="ml-auto"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <Button
                          size="sm"
                          variant="default"
                          className="h-8 text-xs md:text-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectMovie(roomMovie.id);
                          }}
                          disabled={selecting === roomMovie.id}
                        >
                          <Check className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
                          <span className="hidden md:inline">
                            {selecting === roomMovie.id
                              ? t("selecting")
                              : t("selectAndStart")}
                          </span>
                          <span className="md:hidden">{t("select")}</span>
                        </Button>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </CardContent>

      <MovieDetailsDialog
        movieId={selectedMovieId}
        open={detailsDialogOpen}
        onOpenChange={setDetailsDialogOpen}
      />

      <Dialog
        open={removeDialogOpen}
        onOpenChange={(open) => {
          // Solo permitir cerrar si no está eliminando
          if (!removing) {
            setRemoveDialogOpen(open);
          }
        }}
      >
        <DialogContent
          onPointerDownOutside={(e) => {
            // Prevenir cierre al hacer clic fuera mientras elimina
            if (removing) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            // Prevenir cierre con Escape mientras elimina
            if (removing) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("confirmRemove")}</DialogTitle>
            <DialogDescription>
              {t("confirmRemoveDesc", { title: movieToRemove?.title || "" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRemoveDialogOpen(false)}
              disabled={removing === movieToRemove?.id}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={confirmRemoveMovie}
              disabled={removing === movieToRemove?.id}
            >
              {removing === movieToRemove?.id ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t("removing")}
                </>
              ) : (
                t("remove")
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
