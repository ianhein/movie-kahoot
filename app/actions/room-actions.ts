"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { nanoid } from "nanoid";
import { randomUUID } from "crypto";
import { updateTag } from "next/cache";

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

    // Revalidar cache de la sala
    updateTag(`room-${room.id}`);
    updateTag(`room-members-${room.id}`);

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

    // Revalidar cache de la sala
    updateTag(`room-${room.id}`);
    updateTag(`room-members-${room.id}`);

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

export async function getRoomStatus(roomId: string) {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("rooms")
      .select("status")
      .eq("id", roomId)
      .single();

    if (error || !data) {
      return { error: "Room not found" };
    }

    return { status: data.status };
  } catch (error) {
    return { error: "Failed to get room status" };
  }
}

export async function getRoomMembers(roomId: string) {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("room_members")
      .select("user_id, joined_at")
      .eq("room_id", roomId);

    if (error) {
      return { error: "Failed to load members" };
    }

    if (!data || data.length === 0) {
      return { members: [] };
    }

    const userIds = data.map((m) => m.user_id);
    const { data: users } = await supabase
      .from("users")
      .select("id, name")
      .in("id", userIds);

    const membersWithUsers = data.map((member) => ({
      ...member,
      users: users?.find((u) => u.id === member.user_id) || null,
    }));

    return { members: membersWithUsers };
  } catch (error) {
    return { error: "Failed to load members" };
  }
}
