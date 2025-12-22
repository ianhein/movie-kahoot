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
    const result = await getProposedMovies(roomId);
    if (result.movies) {
      setMovies(result.movies as RoomMovie[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadMovies();

    // Suscribirse a cambios en tiempo real
    const supabase = createClient();

    const channel = supabase
      .channel(`room_movies:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_movies",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          loadMovies();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "movie_votes",
        },
        () => {
          loadMovies();
        }
      )
      .subscribe();

    return () => {
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
      <CardHeader>
        <CardTitle>Proposed Movies</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {movies.map((roomMovie) => {
          if (!roomMovie.movies) return null;

          const userVote = getUserVote(roomMovie);
          const { upvotes, downvotes } = getVoteCount(roomMovie);
          const movie = roomMovie.movies;

          return (
            <div
              key={roomMovie.id}
              className="flex gap-3 p-3 rounded-lg border bg-card"
            >
              {movie.poster_url ? (
                <img
                  src={movie.poster_url}
                  alt={movie.title}
                  className="w-20 h-28 object-cover rounded"
                />
              ) : (
                <div className="w-20 h-28 bg-muted rounded flex items-center justify-center">
                  <Film className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{movie.title}</h3>
                    {movie.year && (
                      <p className="text-sm text-muted-foreground">
                        {movie.year}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <ThumbsUp className="w-3 h-3" />
                      {upvotes}
                    </Badge>
                    <Badge variant="secondary" className="gap-1">
                      <ThumbsDown className="w-3 h-3" />
                      {downvotes}
                    </Badge>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                  {movie.overview}
                </p>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant={userVote?.vote === true ? "default" : "outline"}
                    onClick={() => handleVote(roomMovie.id, true)}
                    disabled={votingFor === roomMovie.id}
                  >
                    <ThumbsUp className="w-4 h-4 mr-1" />
                    Yes
                  </Button>
                  <Button
                    size="sm"
                    variant={
                      userVote?.vote === false ? "destructive" : "outline"
                    }
                    onClick={() => handleVote(roomMovie.id, false)}
                    disabled={votingFor === roomMovie.id}
                  >
                    <ThumbsDown className="w-4 h-4 mr-1" />
                    No
                  </Button>
                  {isHost && (
                    <Button
                      size="sm"
                      variant="default"
                      className="ml-auto"
                      onClick={() => handleSelectMovie(roomMovie.id)}
                      disabled={selecting === roomMovie.id}
                    >
                      <Check className="w-4 h-4 mr-1" />
                      {selecting === roomMovie.id
                        ? "Selecting..."
                        : "Select & Start Quiz"}
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
