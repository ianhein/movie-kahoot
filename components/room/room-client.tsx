"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import useSWR, { mutate } from "swr";
import { useTranslations, useLocale } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Film,
  LogOut,
  Crown,
  Trophy,
  RotateCcw,
  Popcorn,
} from "lucide-react";
import { MovieSearch } from "./movie-search";
import { ProposedMovies } from "./proposed-movies";
import { toast } from "sonner";
import type { Room, Member } from "@/lib/types";
import {
  getRoomStatus,
  getRoomMembers,
  resetRoomToVoting,
  getWinningMovie,
} from "@/app/actions/room-actions";
import { getMovieDetails, getPosterUrl } from "@/lib/tmdb";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageSwitcher } from "@/components/language-switcher";
import { motion } from "framer-motion";
import { getAvatar } from "@/lib/utils/avatars";
import type { RoomClientProps } from "@/lib/types";

export function RoomClient({
  roomId,
  initialRoom,
  initialMembers,
}: RoomClientProps) {
  const router = useRouter();
  const t = useTranslations("room");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [room, setRoom] = useState(initialRoom);
  const [members, setMembers] = useState(initialMembers);
  const [copied, setCopied] = useState(false);
  const [movieRefreshKey, setMovieRefreshKey] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [winningMovie, setWinningMovie] = useState<{
    id: string;
    title: string;
    year: number | null;
    poster_url: string | null;
    overview: string | null;
  } | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const previousStatusRef = useRef<string>(initialRoom.status);

  // Cargar userId después del montaje para evitar hydration mismatch
  useEffect(() => {
    let isCancelled = false;

    // Simular lectura asíncrona de localStorage
    const initializeUser = () => {
      if (isCancelled) return;
      const storedUserId = localStorage.getItem("userId");
      setUserId(storedUserId);
      setIsMounted(true);
    };

    initializeUser();

    return () => {
      isCancelled = true;
    };
  }, []);

  // Redirigir si no hay userId
  useEffect(() => {
    if (isMounted && !userId) {
      router.push("/");
    }
  }, [router, userId, isMounted]);

  // Cargar película ganadora si el quiz terminó
  useEffect(() => {
    const loadWinningMovie = async () => {
      if (room.status === "finished") {
        const result = await getWinningMovie(roomId);
        if ("movie" in result && result.movie) {
          // Obtener datos actualizados de TMDB en el idioma actual
          try {
            const tmdbDetails = await getMovieDetails(result.movie.id, locale);
            setWinningMovie({
              id: result.movie.id,
              title: tmdbDetails.title,
              year: tmdbDetails.release_date
                ? new Date(tmdbDetails.release_date).getFullYear()
                : null,
              poster_url: getPosterUrl(tmdbDetails.poster_path, "w342"),
              overview: tmdbDetails.overview,
            });
          } catch {
            // Fallback a datos de BD si falla TMDB
            setWinningMovie(result.movie as typeof winningMovie);
          }
        }
      }
    };
    loadWinningMovie();
  }, [room.status, roomId, locale]);

  // Función para reiniciar la sala
  const handleResetRoom = async () => {
    setIsResetting(true);
    try {
      const result = await resetRoomToVoting(roomId);
      if ("error" in result) {
        toast.error(result.error);
      } else {
        setRoom((prev) => ({ ...prev, status: "voting" }));
        setWinningMovie(null);
        setMovieRefreshKey((prev) => prev + 1);
        toast.success(t("roomReset"));
      }
    } catch {
      toast.error(t("resetFailed"));
    } finally {
      setIsResetting(false);
    }
  };

  // SWR para status de la sala - polling automático + revalidación instantánea via broadcast
  const { data: roomStatus } = useSWR(
    userId ? `room-status-${roomId}` : null,
    async () => {
      const result = await getRoomStatus(roomId);
      if ("status" in result && result.status) {
        return result.status;
      }
      return room.status;
    },
    {
      fallbackData: initialRoom.status,
      refreshInterval: 3000, // Polling cada 3s
      revalidateOnFocus: true,
      dedupingInterval: 500,
    }
  );

  // SWR para miembros
  const { data: membersData } = useSWR(
    userId ? `room-members-${roomId}` : null,
    async () => {
      const result = await getRoomMembers(roomId);
      if ("members" in result) {
        return result.members as Member[];
      }
      return members;
    },
    {
      fallbackData: initialMembers,
      refreshInterval: 10000,
      revalidateOnFocus: true,
    }
  );

  // Actualizar estado local cuando SWR obtiene nuevos datos
  useEffect(() => {
    if (roomStatus && roomStatus !== room.status) {
      setRoom((prev) => ({ ...prev, status: roomStatus }));
    }
  }, [roomStatus, room.status]);

  useEffect(() => {
    if (membersData) {
      setMembers(membersData);
    }
  }, [membersData]);

  // Redirigir cuando el status CAMBIA a quiz (no cuando ya era quiz)
  useEffect(() => {
    // Solo redirigir si:
    // 1. El status actual es "quiz"
    // 2. El status anterior NO era "quiz" ni "finished" (evita redirección al volver del scoreboard)
    const prevStatus = previousStatusRef.current;
    if (
      roomStatus === "quiz" &&
      prevStatus !== "quiz" &&
      prevStatus !== "finished"
    ) {
      router.push(`/room/${roomId}/quiz`);
    }
    // Actualizar el ref con el status actual
    if (roomStatus) {
      previousStatusRef.current = roomStatus;
    }
  }, [roomStatus, roomId, router]);

  // Setup de broadcast subscription para revalidación instantánea
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    // Canal para broadcast de control (quiz_started, etc.)
    const controlChannel = supabase
      .channel(`room-control:${roomId}`)
      .on("broadcast", { event: "quiz_started" }, () => {
        // Revalidar inmediatamente el status
        mutate(`room-status-${roomId}`);
      })
      .subscribe();

    // Canal para cambios en la sala via postgres_changes (si está habilitado)
    const roomChannel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        () => {
          // Revalidar SWR cuando hay cambios en la BD
          mutate(`room-status-${roomId}`);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_members",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          mutate(`room-members-${roomId}`);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(controlChannel);
      supabase.removeChannel(roomChannel);
    };
  }, [roomId, userId]);

  const isHost = userId === room.host_id;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    toast.success(t("codeCopied"));
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeaveRoom = () => {
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    router.push("/");
  };

  const handleMovieProposed = () => {
    // Forzar recarga del componente ProposedMovies
    setMovieRefreshKey((prev) => prev + 1);
  };

  // Mostrar loading mientras se monta el componente
  if (!isMounted) {
    return (
      <div
        suppressHydrationWarning
        className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-black dark:to-gray-900 flex items-center justify-center"
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto" />
          <p className="mt-2 text-muted-foreground">{tCommon("loading")}</p>
        </div>
      </div>
    );
  }

  // Redirigir si no hay userId
  if (!userId) {
    return null;
  }

  return (
    <div
      suppressHydrationWarning
      className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-black dark:to-gray-900 p-3 md:p-4"
    >
      <div className="max-w-7xl mx-auto space-y-3 md:space-y-4">
        {/* Header */}
        <Card>
          <CardHeader className="p-4 md:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 md:gap-4 min-w-0">
                <div className="p-2 md:p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full flex-shrink-0">
                  <Film className="w-5 h-5 md:w-6 md:h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-lg md:text-2xl truncate">
                    Kahoovie
                  </CardTitle>
                  <div className="flex items-center gap-1.5 md:gap-2 mt-1 flex-wrap">
                    <Badge
                      variant="secondary"
                      className="text-sm md:text-lg font-mono cursor-pointer"
                      onClick={handleCopyCode}
                    >
                      {copied ? tCommon("copied") : room.code}
                    </Badge>
                    {isHost && (
                      <Badge
                        variant="default"
                        className="gap-1 text-xs md:text-sm"
                      >
                        <Crown className="w-3 h-3" />
                        {tCommon("host")}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <LanguageSwitcher />
                <ThemeToggle />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLeaveRoom}
                  className="h-8 md:h-9"
                >
                  <LogOut className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
                  <span className="hidden sm:inline">{t("leaveRoom")}</span>
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
          {/* Members sidebar */}
          <Card className="lg:col-span-1">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Users className="w-4 h-4 md:w-5 md:h-5" />
                {t("members", { count: members.length })}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="space-y-2">
                {members.map((member) => {
                  const avatar = getAvatar(member.user_id);
                  return (
                    <div
                      key={member.user_id}
                      className="flex items-center gap-3 p-2 md:p-3 rounded-lg bg-muted/50"
                    >
                      <div
                        className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-lg md:text-xl shrink-0 ${avatar.color}`}
                      >
                        {avatar.emoji}
                      </div>
                      <span className="font-medium text-sm md:text-base truncate flex-1">
                        {member.users?.name}
                        {member.user_id === userId && ` (${t("you")})`}
                      </span>
                      {member.user_id === room.host_id && (
                        <Crown className="w-4 h-4 text-yellow-500 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Main content */}
          <div className="lg:col-span-2 space-y-3 md:space-y-4">
            {room.status === "voting" && (
              <>
                <MovieSearch
                  roomId={roomId}
                  userId={userId}
                  isHost={isHost}
                  onMovieProposed={handleMovieProposed}
                />
                <ProposedMovies
                  key={movieRefreshKey}
                  roomId={roomId}
                  userId={userId}
                  isHost={isHost}
                  totalMembers={members.length}
                />
              </>
            )}

            {room.status === "finished" && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Card className="overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6">
                    <div className="flex items-center gap-3">
                      <Trophy className="w-8 h-8" />
                      <CardTitle className="text-xl md:text-2xl">
                        {t("quizFinished")}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="p-6">
                    {winningMovie ? (
                      <div className="flex flex-col md:flex-row gap-6">
                        {winningMovie.poster_url && (
                          <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="flex-shrink-0"
                          >
                            <img
                              src={winningMovie.poster_url}
                              alt={winningMovie.title}
                              className="w-32 md:w-40 rounded-lg shadow-lg mx-auto md:mx-0"
                            />
                          </motion.div>
                        )}
                        <div className="flex-1 space-y-4">
                          <div>
                            <h3 className="text-xl md:text-2xl font-bold flex items-center gap-2">
                              <Popcorn className="w-6 h-6 text-yellow-500" />
                              {t("winningMovie")}
                            </h3>
                            <p className="text-2xl md:text-3xl font-bold text-purple-600 dark:text-purple-400 mt-2">
                              {winningMovie.title}
                              {winningMovie.year && (
                                <span className="text-lg font-normal text-muted-foreground ml-2">
                                  ({winningMovie.year})
                                </span>
                              )}
                            </p>
                          </div>
                          {winningMovie.overview && (
                            <button
                              onClick={() =>
                                setShowFullDescription(!showFullDescription)
                              }
                              className="text-left w-full group"
                            >
                              <p
                                className={`text-muted-foreground ${showFullDescription ? "" : "line-clamp-3"}`}
                              >
                                {winningMovie.overview}
                              </p>
                              <span className="text-sm text-purple-500 dark:text-purple-400 group-hover:underline mt-1 inline-block">
                                {showFullDescription
                                  ? t("showLess")
                                  : t("showMore")}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-lg text-muted-foreground">
                          {t("quizFinished")}
                        </p>
                      </div>
                    )}

                    {isHost && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="mt-6 pt-6 border-t"
                      >
                        <p className="text-sm text-muted-foreground mb-3">
                          {t("pickAnother")}
                        </p>
                        <Button
                          onClick={handleResetRoom}
                          disabled={isResetting}
                          variant="outline"
                          className="gap-2"
                        >
                          <RotateCcw
                            className={`w-4 h-4 ${isResetting ? "animate-spin" : ""}`}
                          />
                          {isResetting ? t("resetting") : t("startVoting")}
                        </Button>
                      </motion.div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
