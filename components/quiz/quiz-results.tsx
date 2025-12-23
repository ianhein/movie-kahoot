"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Star, ArrowLeft } from "lucide-react";
import { getQuizResults } from "@/app/actions/quiz-actions";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { useConfetti } from "@/lib/hooks/use-confetti";
import { getAvatar } from "@/lib/utils/avatars";
import type { QuizResultsProps, PlayerScore } from "@/lib/types";

export function QuizResults({ roomId }: QuizResultsProps) {
  const router = useRouter();
  const t = useTranslations("quiz");
  const [scores, setScores] = useState<PlayerScore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { fireWinnerConfetti } = useConfetti();

  useEffect(() => {
    let isCancelled = false;
    const fetchResults = async () => {
      const result = await getQuizResults(roomId);
      if (isCancelled) return;
      if (result.scores) {
        setScores(result.scores);
        // Fire confetti when results load
        setTimeout(() => {
          if (!isCancelled) fireWinnerConfetti();
        }, 500);
      }
      setIsLoading(false);
    };
    fetchResults();
    return () => {
      isCancelled = true;
    };
  }, [roomId, fireWinnerConfetti]);

  const getMedalIcon = (position: number) => {
    switch (position) {
      case 0:
        return <Trophy className="w-8 h-8 text-yellow-900 drop-shadow-md" />;
      case 1:
        return <Medal className="w-8 h-8 text-gray-700 drop-shadow-md" />;
      case 2:
        return <Medal className="w-8 h-8 text-amber-900 drop-shadow-md" />;
      default:
        return <Star className="w-6 h-6 text-muted-foreground" />;
    }
  };

  const getMedalColor = (position: number) => {
    switch (position) {
      case 0:
        return "from-yellow-400 to-yellow-600 text-yellow-950";
      case 1:
        return "from-gray-300 to-gray-500 text-gray-900";
      case 2:
        return "from-amber-400 to-amber-600 text-amber-950";
      default:
        return "from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 text-foreground";
    }
  };

  if (isLoading) {
    return (
      <div
        suppressHydrationWarning
        className="min-h-screen bg-linear-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-black dark:to-gray-900 flex items-center justify-center p-4"
      >
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <p className="text-lg">{t("calculatingResults")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div
      suppressHydrationWarning
      className="min-h-screen bg-linear-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-black dark:to-gray-900 p-4"
    >
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="max-w-3xl mx-auto space-y-6 py-8">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
        >
          <Card className="text-center">
            <CardHeader>
              <motion.div
                className="flex justify-center mb-4"
                animate={{
                  rotate: [0, -10, 10, -10, 10, 0],
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  repeatDelay: 2,
                }}
              >
                <Trophy className="w-16 h-16 text-yellow-500" />
              </motion.div>
              <CardTitle className="text-4xl">{t("complete")}</CardTitle>
            </CardHeader>
          </Card>
        </motion.div>

        <Card>
          <CardHeader>
            <CardTitle>{t("finalScores")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <AnimatePresence>
              {scores.map((player, index) => (
                <motion.div
                  key={player.userId}
                  initial={{ opacity: 0, x: -50 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.2, duration: 0.4 }}
                  whileHover={{ scale: 1.02 }}
                  className={`relative overflow-hidden rounded-lg border-2 p-3 sm:p-4 bg-linear-to-r ${getMedalColor(index)}`}
                >
                  {index === 0 && (
                    <motion.div
                      className="absolute inset-0 bg-linear-to-r from-yellow-400/20 to-transparent"
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        repeatDelay: 1,
                      }}
                    />
                  )}
                  <div className="flex flex-col gap-2 relative z-10">
                    {/* Top row: Position + Avatar + Name */}
                    <div className="flex items-center gap-3">
                      {/* Position number for mobile */}
                      <div className="text-lg font-bold opacity-60 w-6 text-center">
                        #{index + 1}
                      </div>
                      {/* Medal icon */}
                      <motion.div
                        className="shrink-0"
                        animate={index === 0 ? { rotate: [0, 10, -10, 0] } : {}}
                        transition={{
                          duration: 0.5,
                          repeat: Infinity,
                          repeatDelay: 2,
                        }}
                      >
                        {getMedalIcon(index)}
                      </motion.div>
                      {/* Avatar del jugador */}
                      <div
                        className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-lg sm:text-xl shrink-0 ${getAvatar(player.userId).color} ring-2 ring-white/50`}
                      >
                        {getAvatar(player.userId).emoji}
                      </div>
                      {/* Name - truncated on small screens */}
                      <h3 className="font-bold text-sm sm:text-base truncate flex-1 min-w-0">
                        {player.userName}
                      </h3>
                    </div>
                    {/* Bottom row: Score + Correct answers */}
                    <div className="flex items-center justify-between pl-9">
                      <p className="text-xs sm:text-sm opacity-75">
                        {player.correctAnswers} / {player.totalQuestions}{" "}
                        {t("correct")}
                      </p>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{
                          delay: index * 0.2 + 0.3,
                          type: "spring",
                        }}
                      >
                        <Badge
                          variant="secondary"
                          className="text-sm sm:text-base font-bold"
                        >
                          {player.score} {t("pts")}
                        </Badge>
                      </motion.div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </CardContent>
        </Card>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Button
            className="w-full"
            size="lg"
            onClick={() => router.push(`/room/${roomId}`)}
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("backToRoom")}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
