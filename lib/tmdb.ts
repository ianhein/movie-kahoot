const TMDB_API_KEY =
  process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

export interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  vote_average: number;
  popularity: number;
}

export interface TMDBSearchResponse {
  page: number;
  results: TMDBMovie[];
  total_pages: number;
  total_results: number;
}

export async function searchMovies(
  query: string,
  page = 1
): Promise<TMDBSearchResponse> {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB API key not configured");
  }

  const url = new URL(`${TMDB_BASE_URL}/search/movie`);
  url.searchParams.append("api_key", TMDB_API_KEY);
  url.searchParams.append("query", query);
  url.searchParams.append("page", page.toString());
  url.searchParams.append("language", "es-ES");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to search movies");
  }

  return response.json();
}

export async function getPopularMovies(page = 1): Promise<TMDBSearchResponse> {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB API key not configured");
  }

  const url = new URL(`${TMDB_BASE_URL}/movie/popular`);
  url.searchParams.append("api_key", TMDB_API_KEY);
  url.searchParams.append("page", page.toString());
  url.searchParams.append("language", "es-ES");

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

// Movie Details
export interface TMDBMovieDetails extends TMDBMovie {
  budget: number;
  genres: Array<{ id: number; name: string }>;
  imdb_id: string | null;
  production_companies: Array<{ id: number; name: string }>;
  production_countries: Array<{ iso_3166_1: string; name: string }>;
  revenue: number;
  runtime: number | null;
  spoken_languages: Array<{ iso_639_1: string; name: string }>;
  status: string;
  tagline: string | null;
}

export async function getMovieDetails(
  movieId: string
): Promise<TMDBMovieDetails> {
  if (!TMDB_API_KEY) {
    throw new Error("TMDB API key not configured");
  }

  const url = new URL(`${TMDB_BASE_URL}/movie/${movieId}`);
  url.searchParams.append("api_key", TMDB_API_KEY);
  url.searchParams.append("language", "es-ES");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error("Failed to get movie details");
  }

  return response.json();
}

// Movie Credits (Cast & Crew)
export interface TMDBCast {
  id: number;
  name: string;
  character: string;
  profile_path: string | null;
  order: number;
}

export interface TMDBCrew {
  id: number;
  name: string;
  job: string;
  department: string;
  profile_path: string | null;
}

export interface TMDBCredits {
  id: number;
  cast: TMDBCast[];
  crew: TMDBCrew[];
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
export async function getMovieQuizData(movieId: string) {
  const [details, credits] = await Promise.all([
    getMovieDetails(movieId),
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
