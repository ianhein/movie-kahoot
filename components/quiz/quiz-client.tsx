"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { QuizHost } from "./quiz-host";
import { QuizPlayer } from "./quiz-player";
import { QuizResults } from "./quiz-results";
import type { Room, Member } from "@/lib/types";

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
  const [members] = useState(initialMembers);
  const [userId] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("userId");
    }
    return null;
  });
  const [userName] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("userName");
    }
    return null;
  });

  useEffect(() => {
    if (!userId) {
      router.push("/");
      return;
    }

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
  }, [roomId, router, userId]);

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
