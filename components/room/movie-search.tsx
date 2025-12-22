"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Star } from "lucide-react";
import {
  searchMovies,
  getPopularMovies,
  getPosterUrl,
  type TMDBMovie,
} from "@/lib/tmdb";
import { proposeMovie } from "@/app/actions/movie-actions";
import { toast } from "sonner";

interface MovieSearchProps {
  roomId: string;
  userId: string;
  isHost: boolean;
}

export function MovieSearch({ roomId, userId, isHost }: MovieSearchProps) {
  const [query, setQuery] = useState("");
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isProposing, setIsProposing] = useState<number | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const result = await searchMovies(query);
      setMovies(result.results);
    } catch (error) {
      toast.error("Failed to search movies");
    } finally {
      setIsSearching(false);
    }
  };

  const loadPopular = async () => {
    setIsSearching(true);
    try {
      const result = await getPopularMovies();
      setMovies(result.results);
      setQuery("");
    } catch (error) {
      toast.error("Failed to load popular movies");
    } finally {
      setIsSearching(false);
    }
  };

  const handlePropose = async (movie: TMDBMovie) => {
    setIsProposing(movie.id);
    try {
      const year = movie.release_date
        ? new Date(movie.release_date).getFullYear()
        : null;
      const result = await proposeMovie(
        roomId,
        movie.id.toString(),
        movie.title,
        year,
        getPosterUrl(movie.poster_path),
        movie.overview,
        userId
      );

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Movie proposed!");
        setMovies([]);
        setQuery("");
      }
    } catch (error) {
      toast.error("Failed to propose movie");
    } finally {
      setIsProposing(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Search Movies</CardTitle>
        <CardDescription>Find a movie to watch together</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder="Search for a movie..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={isSearching}
          />
          <Button type="submit" disabled={isSearching}>
            <Search className="w-4 h-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={loadPopular}
            disabled={isSearching}
          >
            Popular
          </Button>
        </form>

        {movies.length > 0 && (
          <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
            {movies.map((movie) => (
              <div
                key={movie.id}
                className="flex gap-3 p-3 rounded-lg border bg-card hover:bg-accent transition-colors"
              >
                {movie.poster_path ? (
                  <img
                    src={getPosterUrl(movie.poster_path, "w185") || ""}
                    alt={movie.title}
                    className="w-16 h-24 object-cover rounded"
                  />
                ) : (
                  <div className="w-16 h-24 bg-muted rounded flex items-center justify-center">
                    <Film className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold line-clamp-1">{movie.title}</h3>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                    {movie.release_date && (
                      <span>{new Date(movie.release_date).getFullYear()}</span>
                    )}
                    {movie.vote_average > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span>{movie.vote_average.toFixed(1)}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {movie.overview}
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handlePropose(movie)}
                  disabled={isProposing === movie.id}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  {isProposing === movie.id ? "..." : "Propose"}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
