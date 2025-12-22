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
import { testConnection } from "@/app/actions/test-connection";
import { Film, Users, TestTube } from "lucide-react";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/theme-toggle";

export function HomeClient() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [createName, setCreateName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [roomCode, setRoomCode] = useState("");

  const handleTestConnection = async () => {
    setIsLoading(true);
    try {
      const result = await testConnection();
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(`Connection failed: ${result.error}`);
        console.error("Connection test details:", result.details);
      }
    } catch (error) {
      toast.error("Test failed");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createName.trim()) {
      toast.error("Please enter your name");
      return;
    }

    setIsLoading(true);
    try {
      const result = await createRoom(createName);
      console.log("Create room result:", result);

      if (result.error) {
        toast.error(result.error);
      } else if (result.success) {
        // Guardar info en localStorage
        localStorage.setItem("userId", result.userId!);
        localStorage.setItem("userName", createName);
        toast.success(`Room created! Code: ${result.roomCode}`);
        router.push(`/room/${result.roomId}`);
      }
    } catch {
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
    } catch {
      toast.error("Failed to join room");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      suppressHydrationWarning
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-black dark:to-gray-900 p-3 md:p-4"
    >
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-lg space-y-6 md:space-y-8">
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-3 md:mb-4">
            <div className="p-3 md:p-4 bg-purple-100 dark:bg-purple-900/20 rounded-full">
              <Film className="w-10 h-10 md:w-12 md:h-12 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Movie Kahoot
          </h1>
          <p className="text-sm md:text-base text-muted-foreground px-4">
            Watch movies with friends and compete with fun quizzes!
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTestConnection}
            disabled={isLoading}
            className="mt-2"
          >
            <TestTube className="w-4 h-4 mr-2" />
            Test Connection
          </Button>
        </div>

        <Tabs defaultValue="create" className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-auto">
            <TabsTrigger
              value="create"
              className="text-sm md:text-base py-2 md:py-2.5"
            >
              Create Room
            </TabsTrigger>
            <TabsTrigger
              value="join"
              className="text-sm md:text-base py-2 md:py-2.5"
            >
              Join Room
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create">
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="text-lg md:text-xl">
                  Create a New Room
                </CardTitle>
                <CardDescription className="text-sm">
                  Start a movie night and invite your friends
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                <form
                  onSubmit={handleCreateRoom}
                  className="space-y-3 md:space-y-4"
                >
                  <div className="space-y-2">
                    <Input
                      placeholder="Your name"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      disabled={isLoading}
                      maxLength={50}
                      className="h-11 md:h-10"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 md:h-10"
                    disabled={isLoading}
                  >
                    <Users className="w-4 h-4 mr-2" />
                    {isLoading ? "Creating..." : "Create Room"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="join">
            <Card>
              <CardHeader className="p-4 md:p-6">
                <CardTitle className="text-lg md:text-xl">
                  Join a Room
                </CardTitle>
                <CardDescription className="text-sm">
                  Enter the room code to join your friends
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                <form
                  onSubmit={handleJoinRoom}
                  className="space-y-3 md:space-y-4"
                >
                  <div className="space-y-2">
                    <Input
                      placeholder="Your name"
                      value={joinName}
                      onChange={(e) => setJoinName(e.target.value)}
                      disabled={isLoading}
                      maxLength={50}
                      className="h-11 md:h-10"
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
                      className="uppercase text-center text-lg md:text-xl font-mono h-11 md:h-10"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full h-11 md:h-10"
                    disabled={isLoading}
                  >
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
