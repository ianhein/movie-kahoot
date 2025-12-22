"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, ThumbsDown, Check, Film } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  getProposedMovies,
  voteForMovie,
  selectMovie,
} from "@/app/actions/movie-actions";
import { toast } from "sonner";

interface ProposedMoviesProps {
  roomId: string;
  userId: string;
  isHost: boolean;
}

type Movie = {
  id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  overview: string | null;
};

type RoomMovie = {
  id: string;
  movie_id: string;
  proposed_by: string | null;
  accepted: boolean | null;
  created_at: string;
  movies: Movie | null;
  movie_votes: Array<{
    user_id: string;
    vote: boolean;
  }>;
};

export function ProposedMovies({
  roomId,
  userId,
  isHost,
}: ProposedMoviesProps) {
  const [movies, setMovies] = useState<RoomMovie[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [votingFor, setVotingFor] = useState<string | null>(null);
  const [selecting, setSelecting] = useState<string | null>(null);

  const loadMovies = async () => {
    console.log("Loading movies for room:", roomId);
    const result = await getProposedMovies(roomId);
    console.log("Loaded movies result:", result);
    if (result.movies) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMovies(result.movies as any);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadMovies();

    // Polling cada 5 segundos como fallback si Realtime no está disponible
    const pollingInterval = setInterval(() => {
      loadMovies();
    }, 5000);

    // Suscribirse a cambios en tiempo real (si está habilitado)
    const supabase = createClient();

    const channel = supabase
      .channel(`room_movies_${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_movies",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log("Room movie inserted:", payload);
          loadMovies();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "room_movies",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log("Room movie updated:", payload);
          loadMovies();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "movie_votes",
        },
        (payload) => {
          console.log("Vote inserted:", payload);
          loadMovies();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "movie_votes",
        },
        (payload) => {
          console.log("Vote updated:", payload);
          loadMovies();
        }
      )
      .subscribe((status) => {
        console.log("Subscription status:", status);
      });

    return () => {
      clearInterval(pollingInterval);
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const handleVote = async (roomMovieId: string, vote: boolean) => {
    setVotingFor(roomMovieId);
    try {
      const result = await voteForMovie(roomMovieId, userId, vote);
      if (result.error) {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error("Failed to vote");
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
      } else {
        toast.success("Movie selected! Starting quiz...");
      }
    } catch (error) {
      toast.error("Failed to select movie");
    } finally {
      setSelecting(null);
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

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Loading proposed movies...
        </CardContent>
      </Card>
    );
  }

  if (movies.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No movies proposed yet. Search and propose a movie!
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-base md:text-lg">Proposed Movies</CardTitle>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0 space-y-3">
        {movies.map((roomMovie) => {
          if (!roomMovie.movies) return null;

          const userVote = getUserVote(roomMovie);
          const { upvotes, downvotes } = getVoteCount(roomMovie);
          const movie = roomMovie.movies;

          return (
            <div
              key={roomMovie.id}
              className="flex gap-2 md:gap-3 p-2 md:p-3 rounded-lg border bg-card"
            >
              {movie.poster_url ? (
                <img
                  src={movie.poster_url}
                  alt={movie.title}
                  className="w-16 h-24 md:w-20 md:h-28 object-cover rounded flex-shrink-0"
                />
              ) : (
                <div className="w-16 h-24 md:w-20 md:h-28 bg-muted rounded flex items-center justify-center flex-shrink-0">
                  <Film className="w-6 h-6 md:w-8 md:h-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-1 md:gap-2">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-sm md:text-base truncate">
                      {movie.title}
                    </h3>
                    {movie.year && (
                      <p className="text-xs md:text-sm text-muted-foreground">
                        {movie.year}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1 md:gap-2 flex-shrink-0">
                    <Badge
                      variant="secondary"
                      className="gap-0.5 md:gap-1 text-xs md:text-sm px-1.5 md:px-2"
                    >
                      <ThumbsUp className="w-3 h-3" />
                      {upvotes}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className="gap-0.5 md:gap-1 text-xs md:text-sm px-1.5 md:px-2"
                    >
                      <ThumbsDown className="w-3 h-3" />
                      {downvotes}
                    </Badge>
                  </div>
                </div>
                <p className="text-xs md:text-sm text-muted-foreground mt-1 md:mt-2 line-clamp-2 hidden sm:block">
                  {movie.overview}
                </p>
                <div className="flex flex-wrap gap-1.5 md:gap-2 mt-2 md:mt-3">
                  <Button
                    size="sm"
                    variant={userVote?.vote === true ? "default" : "outline"}
                    onClick={() => handleVote(roomMovie.id, true)}
                    disabled={votingFor === roomMovie.id}
                    className="h-8 text-xs md:text-sm"
                  >
                    <ThumbsUp className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
                    <span className="hidden sm:inline">Yes</span>
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      userVote?.vote === false ? "destructive" : "outline"
                    }
                    onClick={() => handleVote(roomMovie.id, false)}
                    disabled={votingFor === roomMovie.id}
                    className="h-8 text-xs md:text-sm"
                  >
                    <ThumbsDown className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
                    <span className="hidden sm:inline">No</span>
                  </Button>
                  {isHost && (
                    <Button
                      size="sm"
                      variant="default"
                      className="ml-auto h-8 text-xs md:text-sm"
                      onClick={() => handleSelectMovie(roomMovie.id)}
                      disabled={selecting === roomMovie.id}
                    >
                      <Check className="w-3 h-3 md:w-4 md:h-4 md:mr-1" />
                      <span className="hidden md:inline">
                        {selecting === roomMovie.id
                          ? "Selecting..."
                          : "Select & Start Quiz"}
                      </span>
                      <span className="md:hidden">Select</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
