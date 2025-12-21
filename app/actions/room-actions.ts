"use server";

import { createClient } from "@/lib/supabase/server";
import { nanoid } from "nanoid";

export async function createRoom(userName: string) {
  const supabase = await createClient();

  // Crear usuario
  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({ name: userName })
    .select()
    .single();

  if (userError || !user) {
    return { error: "Error creating user" };
  }

  // Generar código único para la sala
  const code = nanoid(6).toUpperCase();

  // Crear sala
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .insert({
      code,
      host_id: user.id,
      status: "voting",
    })
    .select()
    .single();

  if (roomError || !room) {
    return { error: "Error creating room" };
  }

  // Agregar host como miembro
  await supabase.from("room_members").insert({
    room_id: room.id,
    user_id: user.id,
  });

  return {
    success: true,
    roomCode: code,
    userId: user.id,
    roomId: room.id,
  };
}

export async function joinRoom(userName: string, roomCode: string) {
  const supabase = await createClient();

  // Buscar sala
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select()
    .eq("code", roomCode.toUpperCase())
    .single();

  if (roomError || !room) {
    return { error: "Room not found" };
  }

  // Crear usuario
  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({ name: userName })
    .select()
    .single();

  if (userError || !user) {
    return { error: "Error creating user" };
  }

  // Agregar usuario como miembro
  const { error: memberError } = await supabase.from("room_members").insert({
    room_id: room.id,
    user_id: user.id,
  });

  if (memberError) {
    return { error: "Error joining room" };
  }

  return {
    success: true,
    roomId: room.id,
    userId: user.id,
    roomCode: room.code,
  };
}
