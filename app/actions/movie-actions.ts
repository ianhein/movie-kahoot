"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function getRoomDetails(roomId: string) {
  const supabase = createAdminClient();

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (roomError || !room) {
    return { error: "Room not found" };
  }

  const { data: members, error: membersError } = await supabase
    .from("room_members")
    .select(
      `
      user_id,
      joined_at,
      users (
        id,
        name
      )
    `
    )
    .eq("room_id", roomId);

  if (membersError) {
    return { error: "Failed to load members" };
  }

  return {
    room,
    members: members || [],
    isHost: false, // Se actualizará en el cliente con el userId
  };
}

export async function proposeMovie(
  roomId: string,
  movieId: string,
  title: string,
  year: number | null,
  posterUrl: string | null,
  overview: string | null,
  userId: string
) {
  const supabase = createAdminClient();

  // Primero insertar o actualizar la película
  const { error: movieError } = await supabase.from("movies").upsert({
    id: movieId,
    title,
    year,
    poster_url: posterUrl,
    overview,
  });

  if (movieError) {
    return { error: "Failed to save movie" };
  }

  // Luego proponer la película en la sala
  const { data: roomMovie, error: proposalError } = await supabase
    .from("room_movies")
    .insert({
      room_id: roomId,
      movie_id: movieId,
      proposed_by: userId,
      accepted: null,
    })
    .select()
    .single();

  if (proposalError) {
    return { error: "Failed to propose movie" };
  }

  return { success: true, roomMovie };
}

export async function voteForMovie(
  roomMovieId: string,
  userId: string,
  vote: boolean
) {
  const supabase = createAdminClient();

  const { error } = await supabase.from("movie_votes").upsert({
    room_movie_id: roomMovieId,
    user_id: userId,
    vote,
  });

  if (error) {
    return { error: "Failed to vote" };
  }

  return { success: true };
}

export async function getProposedMovies(roomId: string) {
  const supabase = createAdminClient();

  const { data: roomMovies, error } = await supabase
    .from("room_movies")
    .select(
      `
      id,
      movie_id,
      proposed_by,
      accepted,
      created_at,
      movies (
        id,
        title,
        year,
        poster_url,
        overview
      ),
      movie_votes (
        user_id,
        vote
      )
    `
    )
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });

  if (error) {
    return { error: "Failed to load movies" };
  }

  return { movies: roomMovies || [] };
}

export async function selectMovie(roomId: string, roomMovieId: string) {
  const supabase = createAdminClient();

  // Marcar esta película como aceptada
  const { error: updateError } = await supabase
    .from("room_movies")
    .update({ accepted: true })
    .eq("id", roomMovieId)
    .eq("room_id", roomId);

  if (updateError) {
    return { error: "Failed to select movie" };
  }

  // Cambiar el estado de la sala a "quiz"
  const { error: statusError } = await supabase
    .from("rooms")
    .update({ status: "quiz" })
    .eq("id", roomId);

  if (statusError) {
    return { error: "Failed to update room status" };
  }

  return { success: true };
}
