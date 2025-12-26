// Movie types
export type Movie = {
  id: string;
  title: string;
  year: number | null;
  poster_url: string | null;
  overview: string | null;
};

export type RoomMovie = {
  id: string;
  movie_id: string | null;
  proposed_by: string | null;
  accepted: boolean | null;
  created_at: string | null;
  movies: Movie | null;
  movie_votes: Array<{
    user_id: string;
    vote: boolean;
  }>;
  users: {
    id: string;
    name: string;
  } | null;
};
