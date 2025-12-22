"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getRoomStatus } from "@/app/actions/room-actions";
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
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Cargar datos de localStorage después del montaje
  useEffect(() => {
    setIsMounted(true);
    setUserId(localStorage.getItem("userId"));
    setUserName(localStorage.getItem("userName"));
  }, []);

  // Redirigir si no hay userId
  useEffect(() => {
    if (isMounted && !userId) {
      router.push("/");
    }
  }, [router, userId, isMounted]);

  useEffect(() => {
    if (!userId) return;

    // Suscribirse a cambios en la sala
    const supabase = createClient();

    // Función para verificar el estado del room usando server action
    const checkRoomStatus = async () => {
      const result = await getRoomStatus(roomId);

      if (result.status && result.status !== room.status) {
        setRoom((prev) => ({ ...prev, status: result.status }));
      }
    };

    // Polling cada 10 segundos como respaldo (Realtime debería manejar la mayoría)
    const pollingInterval = setInterval(checkRoomStatus, 10000);

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
      clearInterval(pollingInterval);
      supabase.removeChannel(roomChannel);
    };
  }, [roomId, router, userId, room.status]);

  // Mostrar loading mientras se monta
  if (!isMounted) {
    return (
      <div
        suppressHydrationWarning
        className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-black dark:to-gray-900 flex items-center justify-center"
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto" />
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

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
