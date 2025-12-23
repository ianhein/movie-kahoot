import type {
  TMDBMovie,
  TMDBSearchResponse,
  TMDBMovieDetails,
  TMDBCredits,
} from "@/lib/types";

const TMDB_API_KEY =
  process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

// Convert app locale to TMDB language code
function getTMDBLanguage(locale?: string): string {
  const languageMap: Record<string, string> = {
    es: "es-ES",
    en: "en-US",
  };
  return languageMap[locale || "es"] || "es-ES";
}

// Re-export types for convenience
export type { TMDBMovie, TMDBSearchResponse, TMDBMovieDetails, TMDBCredits };
export type { TMDBCast, TMDBCrew } from "@/lib/types";

export async function searchMovies(
  query: string,
  page = 1,
  locale?: string
): Promise<TMDBSearchResponse> {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB API key not configured");
  }

  const url = new URL(`${TMDB_BASE_URL}/search/movie`);
  url.searchParams.append("api_key", TMDB_API_KEY);
  url.searchParams.append("query", query);
  url.searchParams.append("page", page.toString());
  url.searchParams.append("language", getTMDBLanguage(locale));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to search movies");
  }

  return response.json();
}

export async function getPopularMovies(
  page = 1,
  locale?: string
): Promise<TMDBSearchResponse> {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB API key not configured");
  }

  const url = new URL(`${TMDB_BASE_URL}/movie/popular`);
  url.searchParams.append("api_key", TMDB_API_KEY);
  url.searchParams.append("page", page.toString());
  url.searchParams.append("language", getTMDBLanguage(locale));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to get popular movies");
  }

  return response.json();
}

export function getPosterUrl(
  path: string | null,
  size: "w185" | "w342" | "w500" | "original" = "w342"
): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function getBackdropUrl(
  path: string | null,
  size: "w780" | "w1280" | "original" = "w780"
): string | null {
  if (!path) return null;
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export async function getMovieDetails(
  movieId: string,
  locale?: string
): Promise<TMDBMovieDetails> {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB API key not configured");
  }

  const url = new URL(`${TMDB_BASE_URL}/movie/${movieId}`);
  url.searchParams.append("api_key", TMDB_API_KEY);
  url.searchParams.append("language", getTMDBLanguage(locale));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to get movie details");
  }

  return response.json();
}

export async function getMovieCredits(movieId: string): Promise<TMDBCredits> {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB API key not configured");
  }

  const url = new URL(`${TMDB_BASE_URL}/movie/${movieId}/credits`);
  url.searchParams.append("api_key", TMDB_API_KEY);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to get movie credits");
  }

  return response.json();
}

// Obtener todo lo necesario para mostrar info de la película
export async function getMovieQuizData(movieId: string, locale?: string) {
  const [details, credits] = await Promise.all([
    getMovieDetails(movieId, locale),
    getMovieCredits(movieId),
  ]);

  const director = credits.crew.find((c) => c.job === "Director");
  const mainCast = credits.cast.slice(0, 5); // Top 5 actores

  return {
    details,
    director,
    mainCast,
  };
}
