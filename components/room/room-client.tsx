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
  const [copied, setCopied] = useState(false);
  const [movieRefreshKey, setMovieRefreshKey] = useState(0);

  // Obtener userId del localStorage de forma segura
  const userId =
    typeof window !== "undefined" ? localStorage.getItem("userId") : null;

  useEffect(() => {
    // Validar userId
    if (!userId) {
      router.push("/");
      return;
    }

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
          // Recargar miembros sin la relación compleja
          const { data } = await supabase
            .from("room_members")
            .select("user_id, joined_at")
            .eq("room_id", roomId);

          if (data) {
            // Obtener nombres de usuarios por separado
            const userIds = data.map((m) => m.user_id);
            const { data: users } = await supabase
              .from("users")
              .select("id, name")
              .in("id", userIds);

            const membersWithUsers = data.map((member) => ({
              ...member,
              users: users?.find((u) => u.id === member.user_id) || null,
            }));

            setMembers(membersWithUsers as any);
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

  const handleMovieProposed = () => {
    // Forzar recarga del componente ProposedMovies
    setMovieRefreshKey((prev) => prev + 1);
  };

  if (!userId) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-black dark:to-gray-900 p-3 md:p-4">
      <div className="max-w-7xl mx-auto space-y-3 md:space-y-4">
        {/* Header */}
        <Card>
          <CardHeader className="p-4 md:p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 md:gap-4 min-w-0">
                <div className="p-2 md:p-3 bg-purple-100 dark:bg-purple-900/20 rounded-full flex-shrink-0">
                  <Film className="w-5 h-5 md:w-6 md:h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-lg md:text-2xl truncate">
                    Movie Night
                  </CardTitle>
                  <div className="flex items-center gap-1.5 md:gap-2 mt-1 flex-wrap">
                    <Badge
                      variant="secondary"
                      className="text-sm md:text-lg font-mono cursor-pointer"
                      onClick={handleCopyCode}
                    >
                      {copied ? "Copied!" : room.code}
                    </Badge>
                    {isHost && (
                      <Badge
                        variant="default"
                        className="gap-1 text-xs md:text-sm"
                      >
                        <Crown className="w-3 h-3" />
                        Host
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleLeaveRoom}
                className="flex-shrink-0"
              >
                <LogOut className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Leave</span>
              </Button>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
          {/* Members sidebar */}
          <Card className="lg:col-span-1">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Users className="w-4 h-4 md:w-5 md:h-5" />
                Members ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              <div className="space-y-2">
                {members.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between p-2 md:p-3 rounded-lg bg-muted/50"
                  >
                    <span className="font-medium text-sm md:text-base truncate">
                      {member.users?.name}
                      {member.user_id === userId && " (You)"}
                    </span>
                    {member.user_id === room.host_id && (
                      <Crown className="w-4 h-4 text-yellow-500 flex-shrink-0 ml-2" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Main content */}
          <div className="lg:col-span-2 space-y-3 md:space-y-4">
            {room.status === "voting" && (
              <>
                <MovieSearch
                  roomId={roomId}
                  userId={userId}
                  isHost={isHost}
                  onMovieProposed={handleMovieProposed}
                />
                <ProposedMovies
                  key={movieRefreshKey}
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
