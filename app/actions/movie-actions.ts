"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { updateTag, unstable_cache } from "next/cache";

export async function getRoomDetails(roomId: string) {
  return unstable_cache(
    async () => {
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
    },
    [`room-${roomId}`],
    {
      tags: [`room-${roomId}`, `room-members-${roomId}`],
      revalidate: 10, // Cache por 10 segundos
    }
  )();
}

const MAX_MOVIES_PER_GUEST = 3;

export async function getMovieLimitConfig() {
  return { maxMoviesPerGuest: MAX_MOVIES_PER_GUEST };
}

export async function proposeMovie(
  roomId: string,
  movieId: string,
  title: string,
  year: number | null,
  posterUrl: string | null,
  overview: string | null,
  userId: string,
  isHost: boolean = false
) {
  const supabase = createAdminClient();

  // Verificar límite de películas para invitados (no host)
  if (!isHost) {
    const { count, error: countError } = await supabase
      .from("room_movies")
      .select("*", { count: "exact", head: true })
      .eq("room_id", roomId)
      .eq("proposed_by", userId);

    if (countError) {
      return { error: "Failed to check movie limit" };
    }

    if (count !== null && count >= MAX_MOVIES_PER_GUEST) {
      return {
        error: "LIMIT_REACHED",
        limit: MAX_MOVIES_PER_GUEST,
        current: count,
      };
    }
  }

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

  // Revalidar cache de películas de la sala
  updateTag(`room-movies-${roomId}`);

  return { success: true, roomMovie };
}

export async function getUserProposedCount(roomId: string, userId: string) {
  const supabase = createAdminClient();

  const { count, error } = await supabase
    .from("room_movies")
    .select("*", { count: "exact", head: true })
    .eq("room_id", roomId)
    .eq("proposed_by", userId);

  if (error) {
    return { count: 0, error: "Failed to get count" };
  }

  return { count: count || 0, limit: MAX_MOVIES_PER_GUEST };
}

export async function voteForMovie(
  roomMovieId: string,
  userId: string,
  vote: boolean
) {
  const supabase = createAdminClient();

  // Verificar si ya existe un voto igual (para toggle)
  const { data: existingVote } = await supabase
    .from("movie_votes")
    .select("vote")
    .eq("room_movie_id", roomMovieId)
    .eq("user_id", userId)
    .single();

  // Si el voto es igual al existente, eliminar (toggle off)
  if (existingVote && existingVote.vote === vote) {
    const { error } = await supabase
      .from("movie_votes")
      .delete()
      .eq("room_movie_id", roomMovieId)
      .eq("user_id", userId);

    if (error) {
      return { error: "Failed to remove vote" };
    }
  } else {
    // Si no existe o es diferente, upsert
    const { error } = await supabase.from("movie_votes").upsert({
      room_movie_id: roomMovieId,
      user_id: userId,
      vote,
    });

    if (error) {
      return { error: "Failed to vote" };
    }
  }

  // Obtener room_id para revalidar
  const { data: roomMovie } = await supabase
    .from("room_movies")
    .select("room_id")
    .eq("id", roomMovieId)
    .single();

  if (roomMovie) {
    updateTag(`room-movies-${roomMovie.room_id}`);
  }

  return { success: true, removed: existingVote?.vote === vote };
}

export async function removeProposedMovie(roomId: string, roomMovieId: string) {
  const supabase = createAdminClient();

  // Eliminar la película propuesta
  const { error } = await supabase
    .from("room_movies")
    .delete()
    .eq("id", roomMovieId)
    .eq("room_id", roomId);

  if (error) {
    return { error: "Failed to remove movie" };
  }

  // Revalidar cache
  updateTag(`room-movies-${roomId}`);

  return { success: true };
}

export async function getProposedMovies(roomId: string) {
  return unstable_cache(
    async () => {
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
      ),
      users!proposed_by (
        id,
        name
      )
    `
        )
        .eq("room_id", roomId)
        .order("created_at", { ascending: false });

      if (error) {
        return { error: "Failed to load movies" };
      }

      return { movies: roomMovies || [] };
    },
    [`room-movies-${roomId}`],
    {
      tags: [`room-movies-${roomId}`],
      revalidate: 5, // Cache por 5 segundos
    }
  )();
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

  // Revalidar todos los caches relacionados
  updateTag(`room-${roomId}`);
  updateTag(`room-movies-${roomId}`);

  return { success: true };
}
