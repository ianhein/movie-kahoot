"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { QuizHost } from "./quiz-host";
import { QuizPlayer } from "./quiz-player";
import { QuizResults } from "./quiz-results";
import type { Database } from "@/lib/supabase/database.types";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Member = {
  user_id: string;
  joined_at: string;
  users: {
    id: string;
    name: string;
  } | null;
};

interface QuizClientProps {
  roomId: string;
  initialRoom: Room;
  initialMembers: Member[];
}

export function QuizClient({
  roomId,
  initialRoom,
  initialMembers,
}: QuizClientProps) {
  const router = useRouter();
  const [room, setRoom] = useState(initialRoom);
  const [members, setMembers] = useState(initialMembers);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);

  useEffect(() => {
    const storedUserId = localStorage.getItem("userId");
    const storedUserName = localStorage.getItem("userName");

    if (!storedUserId) {
      router.push("/");
      return;
    }

    setUserId(storedUserId);
    setUserName(storedUserName);

    // Suscribirse a cambios en la sala
    const supabase = createClient();

    const roomChannel = supabase
      .channel(`quiz:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new) {
            setRoom(payload.new as Room);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [roomId, router]);

  if (!userId) {
    return null;
  }

  const isHost = userId === room.host_id;

  if (room.status === "finished") {
    return <QuizResults roomId={roomId} members={members} />;
  }

  if (isHost) {
    return (
      <QuizHost
        roomId={roomId}
        room={room}
        members={members}
        userId={userId}
        userName={userName}
      />
    );
  }

  return (
    <QuizPlayer
      roomId={roomId}
      room={room}
      userId={userId}
      userName={userName}
    />
  );
}
