"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Star, Home } from "lucide-react";
import { getQuizResults } from "@/app/actions/quiz-actions";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

interface QuizResultsProps {
  roomId: string;
  members: any[];
}

type PlayerScore = {
  userId: string;
  userName: string;
  correctAnswers: number;
  totalQuestions: number;
  score: number;
};

export function QuizResults({ roomId }: QuizResultsProps) {
  const router = useRouter();
  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, [roomId]);

  const loadResults = async () => {
    const result = await getQuizResults(roomId);
    if (result.scores) {
      setScores(result.scores);
    }
    setIsLoading(false);
  };

  const getMedalIcon = (position: number) => {
    switch (position) {
      case 0:
        return <Trophy className="w-8 h-8 text-yellow-500" />;
      case 1:
        return <Medal className="w-8 h-8 text-gray-400" />;
      case 2:
        return <Medal className="w-8 h-8 text-amber-600" />;
      default:
        return <Star className="w-6 h-6 text-muted-foreground" />;
    }
  };

  const getMedalColor = (position: number) => {
    switch (position) {
      case 0:
        return "from-yellow-400 to-yellow-600";
      case 1:
        return "from-gray-300 to-gray-500";
      case 2:
        return "from-amber-400 to-amber-600";
      default:
        return "from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-black dark:to-gray-900 flex items-center justify-center p-4">
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <p className="text-lg">Calculating results...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-black dark:to-gray-900 p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="max-w-3xl mx-auto space-y-6 py-8">
        <Card className="text-center">
          <CardHeader>
            <div className="flex justify-center mb-4">
              <Trophy className="w-16 h-16 text-yellow-500" />
            </div>
            <CardTitle className="text-4xl">Quiz Complete!</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Final Scores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {scores.map((player, index) => (
              <div
                key={player.userId}
                className={`relative overflow-hidden rounded-lg border-2 p-4 bg-gradient-to-r ${getMedalColor(index)}`}
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">{getMedalIcon(index)}</div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-lg">{player.userName}</h3>
                      <Badge variant="secondary" className="text-lg font-bold">
                        {player.score} pts
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {player.correctAnswers} / {player.totalQuestions} correct
                    </p>
                  </div>
                  <div className="text-2xl font-bold text-muted-foreground">
                    #{index + 1}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Button className="w-full" size="lg" onClick={() => router.push("/")}>
          <Home className="w-4 h-4 mr-2" />
          Back to Home
        </Button>
      </div>
    </div>
  );
}
