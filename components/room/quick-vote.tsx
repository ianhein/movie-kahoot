"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ThumbsUp,
  ThumbsDown,
  Zap,
  RotateCcw,
  CheckCircle,
  Film,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { RoomMovie } from "@/lib/types";

interface QuickVoteProps {
  movies: RoomMovie[];
  userId: string;
  localizedMovies: Map<string, { title: string; overview: string | null }>;
  onVote: (roomMovieId: string, vote: boolean) => Promise<void>;
  onBack: () => void;
}

export function QuickVote({
  movies,
  userId,
  localizedMovies,
  onVote,
  onBack,
}: QuickVoteProps) {
  const t = useTranslations("room");

  // Filtrar películas no votadas por el usuario
  const unvotedMovies = useMemo(() => {
    return movies.filter(
      (movie) => !movie.movie_votes.some((v) => v.user_id === userId)
    );
  }, [movies, userId]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVoting, setIsVoting] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [exitDirection, setExitDirection] = useState<"left" | "right" | null>(
    null
  );

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  // Indicadores visuales de swipe
  const leftIndicatorOpacity = useTransform(x, [-100, 0], [1, 0]);
  const rightIndicatorOpacity = useTransform(x, [0, 100], [0, 1]);

  const currentMovie = unvotedMovies[currentIndex];

  const handleVote = async (vote: boolean) => {
    if (!currentMovie || isVoting) return;

    setIsVoting(true);
    setExitDirection(vote ? "right" : "left");

    try {
      await onVote(currentMovie.id, vote);

      // Mostrar transición mientras carga la siguiente
      setTimeout(() => {
        setIsTransitioning(true);
        setExitDirection(null);
        x.set(0);

        // Pequeño delay para mostrar el loader
        setTimeout(() => {
          if (currentIndex < unvotedMovies.length - 1) {
            setCurrentIndex((prev) => prev + 1);
          }
          setIsTransitioning(false);
          setIsVoting(false);
        }, 200);
      }, 300);
    } catch {
      toast.error(t("voteFailed"));
      setExitDirection(null);
      x.set(0);
      setIsVoting(false);
    }
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const threshold = 100;
    if (info.offset.x > threshold) {
      handleVote(true); // Swipe right = Yes
    } else if (info.offset.x < -threshold) {
      handleVote(false); // Swipe left = No
    }
  };

  const resetVoting = () => {
    setCurrentIndex(0);
    x.set(0);
  };

  // Si no hay películas sin votar
  if (unvotedMovies.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Zap className="w-5 h-5 text-yellow-500" />
            {t("quickVote")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 gap-4">
          <CheckCircle className="w-16 h-16 text-green-500" />
          <p className="text-center text-muted-foreground">
            {t("allMoviesVoted")}
          </p>
          <Button variant="outline" onClick={onBack}>
            {t("backToList")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Si ya votó todas
  if (currentIndex >= unvotedMovies.length) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Zap className="w-5 h-5 text-yellow-500" />
            {t("quickVote")}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 gap-4">
          <CheckCircle className="w-16 h-16 text-green-500" />
          <p className="text-center text-muted-foreground font-medium">
            {t("votingComplete")}
          </p>
          <p className="text-center text-sm text-muted-foreground">
            {t("votedCount", { count: unvotedMovies.length })}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={resetVoting}>
              <RotateCcw className="w-4 h-4 mr-2" />
              {t("voteAgain")}
            </Button>
            <Button onClick={onBack}>{t("backToList")}</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const movie = currentMovie.movies;
  if (!movie) return null;

  const localized = localizedMovies.get(movie.id);
  const displayTitle = localized?.title || movie.title;
  const displayOverview = localized?.overview || movie.overview;
  const posterUrl = movie.poster_url;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base md:text-lg">
            <Zap className="w-5 h-5 text-yellow-500" />
            {t("quickVote")}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {currentIndex + 1} / {unvotedMovies.length}
            </Badge>
            <Button variant="ghost" size="sm" onClick={onBack}>
              {t("backToList")}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col items-center pb-6">
        {/* Instrucciones */}
        <p className="text-xs text-center text-muted-foreground mb-4">
          {t("swipeInstructions")}
        </p>

        {/* Contenedor de la tarjeta */}
        <div className="relative w-full max-w-[300px] mx-auto">
          {/* Indicadores de swipe */}
          <motion.div
            className="absolute -left-12 top-1/2 -translate-y-1/2 z-50 pointer-events-none"
            style={{ opacity: leftIndicatorOpacity }}
          >
            <div className="bg-red-500 text-white rounded-full p-3 shadow-xl">
              <ThumbsDown className="w-6 h-6" />
            </div>
          </motion.div>
          <motion.div
            className="absolute -right-12 top-1/2 -translate-y-1/2 z-50 pointer-events-none"
            style={{ opacity: rightIndicatorOpacity }}
          >
            <div className="bg-green-500 text-white rounded-full p-3 shadow-xl">
              <ThumbsUp className="w-6 h-6" />
            </div>
          </motion.div>

          {/* Loader de transición */}
          {isTransitioning && (
            <div className="absolute inset-0 flex items-center justify-center bg-card rounded-lg z-20">
              <Loader2 className="w-12 h-12 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Tarjeta swipeable */}
          <motion.div
            className="cursor-grab active:cursor-grabbing"
            style={{ x, rotate, opacity }}
            drag={isVoting ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.7}
            onDragEnd={handleDragEnd}
            animate={
              exitDirection === "right"
                ? { x: 300, opacity: 0 }
                : exitDirection === "left"
                  ? { x: -300, opacity: 0 }
                  : {}
            }
            transition={{ duration: 0.3 }}
          >
            <Card className="overflow-hidden shadow-xl">
              {/* Poster */}
              <div className="relative aspect-[2/3] bg-muted">
                {posterUrl ? (
                  <img
                    src={posterUrl}
                    alt={displayTitle}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Film className="w-16 h-16 text-muted-foreground" />
                  </div>
                )}
                {/* Overlay con título */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4">
                  <h3 className="text-white font-bold text-lg leading-tight">
                    {displayTitle}
                  </h3>
                  {movie.year && (
                    <p className="text-white/70 text-sm">{movie.year}</p>
                  )}
                </div>
              </div>

              {/* Descripción */}
              <div className="p-4">
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {displayOverview || t("noDescription")}
                </p>
              </div>
            </Card>
          </motion.div>
        </div>

        {/* Botones de votación */}
        <div className="flex justify-center gap-6 mt-6">
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full w-16 h-16 p-0 border-2 border-red-500 hover:bg-red-500 hover:text-white"
              onClick={() => handleVote(false)}
              disabled={isVoting}
            >
              {isVoting && exitDirection === "left" ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                <ThumbsDown className="w-8 h-8 text-red-500 hover:text-white" />
              )}
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full w-16 h-16 p-0 border-2 border-green-500 hover:bg-green-500 hover:text-white"
              onClick={() => handleVote(true)}
              disabled={isVoting}
            >
              {isVoting && exitDirection === "right" ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : (
                <ThumbsUp className="w-8 h-8 text-green-500 hover:text-white" />
              )}
            </Button>
          </motion.div>
        </div>
      </CardContent>
    </Card>
  );
}
