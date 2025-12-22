"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { nanoid } from "nanoid";
import { randomUUID } from "crypto";

export async function createRoom(userName: string) {
  try {
    const supabase = createAdminClient();

    // Generar un ID único para el usuario
    const userId = randomUUID();

    console.log("Creating user with ID:", userId);

    // Crear usuario
    const { data: user, error: userError } = await supabase
      .from("users")
      .insert({ id: userId, name: userName })
      .select()
      .single();

    if (userError) {
      console.error("User creation error:", userError);
      return { error: `Error creating user: ${userError.message}` };
    }

    if (!user) {
      return { error: "No user data returned" };
    }

    console.log("User created:", user.id);

    // Generar código único para la sala
    const code = nanoid(6).toUpperCase();

    console.log("Attempting to create room with host_id:", userId);

    // Crear sala
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({
        code,
        host_id: userId,
        status: "voting",
      })
      .select()
      .single();

    if (roomError) {
      console.error("Room creation error:", roomError);
      return { error: `Error creating room: ${roomError.message}` };
    }

    if (!room) {
      return { error: "No room data returned" };
    }

    // Agregar host como miembro
    const { error: memberError } = await supabase.from("room_members").insert({
      room_id: room.id,
      user_id: userId,
    });

    if (memberError) {
      console.error("Member insert error:", memberError);
      return { error: `Error adding member: ${memberError.message}` };
    }

    return {
      success: true,
      roomCode: code,
      userId: userId,
      roomId: room.id,
    };
  } catch (error) {
    console.error("Unexpected error:", error);
    return { error: "Unexpected error occurred" };
  }
}

export async function joinRoom(userName: string, roomCode: string) {
  try {
    const supabase = createAdminClient();

    // Generar un ID único para el usuario
    const userId = randomUUID();

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
      .insert({ id: userId, name: userName })
      .select()
      .single();

    if (userError || !user) {
      return { error: "Error creating user" };
    }

    // Agregar usuario como miembro
    const { error: memberError } = await supabase.from("room_members").insert({
      room_id: room.id,
      user_id: userId,
    });

    if (memberError) {
      return { error: "Error joining room" };
    }

    return {
      success: true,
      roomId: room.id,
      userId: userId,
      roomCode: room.code,
    };
  } catch (error) {
    console.error("Unexpected error:", error);
    return { error: "Unexpected error occurred" };
  }
}
