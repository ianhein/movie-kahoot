"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createRoom, joinRoom } from "@/app/actions/room-actions";
import { Film, Users } from "lucide-react";
import { toast } from "sonner";

export function HomeClient() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [createName, setCreateName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    setIsLoading(true);
    try {
      const result = await createRoom(createName);
      if (result.error) {
        toast.error(result.error);
      } else if (result.success) {
        // Guardar info en localStorage
        localStorage.setItem("userId", result.userId!);
        localStorage.setItem("userName", createName);
        toast.success(`Room created! Code: ${result.roomCode}`);
        router.push(`/room/${result.roomId}`);
      }
    } catch (error) {
      toast.error("Failed to create room");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinName.trim() || !roomCode.trim()) {
      toast.error("Please enter your name and room code");
      return;
    }

    setIsLoading(true);
    try {
      const result = await joinRoom(joinName, roomCode);
      if (result.error) {
        toast.error(result.error);
      } else if (result.success) {
        // Guardar info en localStorage
        localStorage.setItem("userId", result.userId!);
        localStorage.setItem("userName", joinName);
        toast.success("Joined room successfully!");
        router.push(`/room/${result.roomId}`);
      }
    } catch (error) {
      toast.error("Failed to join room");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-black dark:to-gray-900 p-4">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-purple-100 dark:bg-purple-900/20 rounded-full">
              <Film className="w-12 h-12 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Movie Kahoot</h1>
          <p className="text-muted-foreground">
            Watch movies with friends and compete with fun quizzes!
          </p>
        </div>

        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Create Room</TabsTrigger>
            <TabsTrigger value="join">Join Room</TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <Card>
              <CardHeader>
                <CardTitle>Create a New Room</CardTitle>
                <CardDescription>
                  Start a movie night and invite your friends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateRoom} className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      placeholder="Your name"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      disabled={isLoading}
                      maxLength={50}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    <Users className="w-4 h-4 mr-2" />
                    {isLoading ? "Creating..." : "Create Room"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="join">
            <Card>
              <CardHeader>
                <CardTitle>Join a Room</CardTitle>
                <CardDescription>
                  Enter the room code to join your friends
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleJoinRoom} className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      placeholder="Your name"
                      value={joinName}
                      onChange={(e) => setJoinName(e.target.value)}
                      disabled={isLoading}
                      maxLength={50}
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      placeholder="Room code"
                      value={roomCode}
                      onChange={(e) =>
                        setRoomCode(e.target.value.toUpperCase())
                      }
                      disabled={isLoading}
                      maxLength={6}
                      className="uppercase text-center text-lg font-mono"
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Joining..." : "Join Room"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
