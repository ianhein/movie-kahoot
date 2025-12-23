"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Clock, Calendar, User, Film } from "lucide-react";
import {
  getMovieDetails,
  getMovieCredits,
  getPosterUrl,
  getBackdropUrl,
} from "@/lib/tmdb";
import { toast } from "sonner";
import type {
  MovieDetailsDialogProps,
  TMDBMovieDetails,
  TMDBCredits,
} from "@/lib/types";

export function MovieDetailsDialog({
  movieId,
  open,
  onOpenChange,
}: MovieDetailsDialogProps) {
  const t = useTranslations("movieDetails");
  const locale = useLocale();
  const [details, setDetails] = useState<TMDBMovieDetails | null>(null);
  const [credits, setCredits] = useState<TMDBCredits | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadMovieData = useCallback(
    async (id: string) => {
      setIsLoading(true);
      try {
        const [detailsData, creditsData] = await Promise.all([
          getMovieDetails(id, locale),
          getMovieCredits(id),
        ]);
        setDetails(detailsData);
        setCredits(creditsData);
      } catch {
        toast.error(t("loadFailed"));
        onOpenChange(false);
      } finally {
        setIsLoading(false);
      }
    },
    [onOpenChange, locale, t]
  );

  useEffect(() => {
    if (open && movieId) {
      loadMovieData(movieId);
    } else if (!open) {
      // Limpiar datos cuando se cierra el dialog
      setDetails(null);
      setCredits(null);
    }
  }, [open, movieId, loadMovieData]);

  const director = credits?.crew.find((c) => c.job === "Director");
  const mainCast = credits?.cast.slice(0, 5);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        {isLoading ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("loading")}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </>
        ) : details ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {details.title}
                {details.release_date && (
                  <span className="text-muted-foreground ml-2">
                    ({new Date(details.release_date).getFullYear()})
                  </span>
                )}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {/* Backdrop o Poster */}
              {(details.backdrop_path || details.poster_path) && (
                <div className="relative w-full h-64 rounded-lg overflow-hidden bg-muted">
                  <img
                    src={
                      getBackdropUrl(details.backdrop_path, "w1280") ||
                      getPosterUrl(details.poster_path, "w500") ||
                      ""
                    }
                    alt={details.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}

              {/* Información básica */}
              <div className="flex flex-wrap gap-3">
                {details.vote_average > 0 && (
                  <Badge variant="secondary" className="gap-1.5">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    {details.vote_average.toFixed(1)}/10
                  </Badge>
                )}

                {details.runtime && (
                  <Badge variant="outline" className="gap-1.5">
                    <Clock className="w-4 h-4" />
                    {details.runtime} min
                  </Badge>
                )}

                {details.release_date && (
                  <Badge variant="outline" className="gap-1.5">
                    <Calendar className="w-4 h-4" />
                    {new Date(details.release_date).toLocaleDateString(
                      locale === "es" ? "es-ES" : "en-US",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      }
                    )}
                  </Badge>
                )}
              </div>

              {/* Géneros */}
              {details.genres && details.genres.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {details.genres.map((genre) => (
                    <Badge key={genre.id} variant="default">
                      {genre.name}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Tagline */}
              {details.tagline && (
                <p className="text-lg italic text-muted-foreground">
                  &ldquo;{details.tagline}&rdquo;
                </p>
              )}

              {/* Descripción */}
              {details.overview && (
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">{t("overview")}</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {details.overview}
                  </p>
                </div>
              )}

              {/* Director */}
              {director && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Film className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold">{t("director")}:</span>
                    <span className="text-muted-foreground">
                      {director.name}
                    </span>
                  </div>
                </div>
              )}

              {/* Reparto principal */}
              {mainCast && mainCast.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold">{t("cast")}:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {mainCast.map((actor) => (
                      <Badge key={actor.id} variant="outline">
                        {actor.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
