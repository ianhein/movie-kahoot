"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { mutate } from "swr";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Star, Film } from "lucide-react";
import {
  searchMovies,
  getPopularMovies,
  getPosterUrl,
  type TMDBMovie,
} from "@/lib/tmdb";
import { proposeMovie } from "@/app/actions/movie-actions";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { MovieSearchProps } from "@/lib/types";

export function MovieSearch({
  roomId,
  userId,
  onMovieProposed,
}: MovieSearchProps) {
  const t = useTranslations("movieSearch");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [movies, setMovies] = useState<TMDBMovie[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isProposing, setIsProposing] = useState<number | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const result = await searchMovies(query, 1, locale);
      setMovies(result.results);
    } catch (error) {
      toast.error(t("searchFailed"));
    } finally {
      setIsSearching(false);
    }
  };

  const loadPopular = async () => {
    setIsSearching(true);
    try {
      const result = await getPopularMovies(1, locale);
      setMovies(result.results);
      setQuery("");
    } catch (error) {
      toast.error(t("popularFailed"));
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
        // Limpiar búsqueda
        setMovies([]);
        setQuery("");

        // Enviar broadcast para notificar a todos los clientes
        const supabase = createClient();
        const channel = supabase.channel(`movies-control:${roomId}`);
        await channel.subscribe();
        await channel.send({
          type: "broadcast",
          event: "movies_updated",
          payload: { timestamp: Date.now() },
        });
        supabase.removeChannel(channel);

        // Revalidar SWR localmente
        mutate(`proposed-movies-${roomId}`);

        // Notificar al padre
        onMovieProposed?.();

        toast.success(t("proposed"));
      }
    } catch (error) {
      toast.error(t("proposeFailed"));
    } finally {
      setIsProposing(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            placeholder={t("placeholder")}
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
            {t("popular")}
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
                  // eslint-disable-next-line @next/next/no-img-element
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
                  {isProposing === movie.id ? t("proposing") : t("propose")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
