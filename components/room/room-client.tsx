"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Film, LogOut, Crown } from "lucide-react";
import { MovieSearch } from "./movie-search";
import { ProposedMovies } from "./proposed-movies";
import { toast } from "sonner";
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

interface RoomClientProps {
  roomId: string;
  initialRoom: Room;
  initialMembers: Member[];
}

export function RoomClient({
  roomId,
  initialRoom,
  initialMembers,
}: RoomClientProps) {
  const router = useRouter();
  const [room, setRoom] = useState(initialRoom);
  const [members, setMembers] = useState(initialMembers);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Obtener userId del localStorage
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
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new) {
            setRoom(payload.new as Room);

            // Si el estado cambia a quiz, redirigir
            if ((payload.new as Room).status === "quiz") {
              router.push(`/room/${roomId}/quiz`);
            }
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_members",
          filter: `room_id=eq.${roomId}`,
        },
        async () => {
          // Recargar miembros
          const { data } = await supabase
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

          if (data) {
            setMembers(data as Member[]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(roomChannel);
    };
  }, [roomId, router]);

  const isHost = userId === room.host_id;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(room.code);
    setCopied(true);
    toast.success("Room code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeaveRoom = () => {
    localStorage.removeItem("userId");
    localStorage.removeItem("userName");
    router.push("/");
  };

  if (!userId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-black dark:to-gray-900 p-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full">
                  <Film className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Movie Night</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="secondary"
                      className="text-lg font-mono cursor-pointer"
                      onClick={handleCopyCode}
                    >
                      {copied ? "Copied!" : room.code}
                    </Badge>
                    {isHost && (
                      <Badge variant="default" className="gap-1">
                        <Crown className="w-3 h-3" />
                        Host
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="outline" onClick={handleLeaveRoom}>
                <LogOut className="w-4 h-4 mr-2" />
                Leave
              </Button>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Members sidebar */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Members ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                  >
                    <span className="font-medium">
                      {member.users?.name}
                      {member.user_id === userId && " (You)"}
                    </span>
                    {member.user_id === room.host_id && (
                      <Crown className="w-4 h-4 text-yellow-500" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Main content */}
          <div className="lg:col-span-2 space-y-4">
            {room.status === "voting" && (
              <>
                <MovieSearch roomId={roomId} userId={userId} isHost={isHost} />
                <ProposedMovies
                  roomId={roomId}
                  userId={userId}
                  isHost={isHost}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
