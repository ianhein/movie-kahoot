"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, Trophy, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  submitAnswer,
  getPublishedQuestions,
} from "@/app/actions/quiz-actions";
import { toast } from "sonner";
import type { Room, Question } from "@/lib/types";
import { ThemeToggle } from "@/components/theme-toggle";
import { useConfetti } from "@/lib/hooks/use-confetti";

interface QuizPlayerProps {
  roomId: string;
  room: Room;
  userId: string;
  userName: string | null;
}

export function QuizPlayer({ roomId, userId }: QuizPlayerProps) {
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [showCorrectAnimation, setShowCorrectAnimation] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  // Mapeo de índices mezclados para cada pregunta: shuffledIndexes[questionId] = [2, 0, 3, 1]
  // Significa que la opción en posición 0 visual es la opción original 2, etc.
  const [shuffledIndexes, setShuffledIndexes] = useState<
    Record<string, number[]>
  >({});
  const { fireCorrectAnswer } = useConfetti();

  // Función para mezclar un array y devolver los índices originales en orden mezclado
  const shuffleOptions = (length: number): number[] => {
    const indexes = Array.from({ length }, (_, i) => i);
    for (let i = indexes.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
    }
    return indexes;
  };

  useEffect(() => {
    const supabase = createClient();

    // Cargar todas las preguntas publicadas
    const loadQuestions = async () => {
      const result = await getPublishedQuestions(roomId);
      if (result.questions && result.questions.length > 0) {
        const sortedQuestions = (result.questions as Question[]).sort(
          (a, b) => (a.question_order ?? 0) - (b.question_order ?? 0)
        );
        // Solo actualizar si hay preguntas nuevas o cambios
        setAllQuestions((prev) => {
          if (prev.length === 0 && sortedQuestions.length > 0) {
            setCurrentQuestionIndex(0);
            setTimeLeft(sortedQuestions[0].duration_seconds);
            setHasAnswered(false);
            setSelectedOption(null);
            setShowResult(false);

            // Generar índices mezclados para cada pregunta
            const newShuffledIndexes: Record<string, number[]> = {};
            sortedQuestions.forEach((q) => {
              newShuffledIndexes[q.id] = shuffleOptions(q.options.length);
            });
            setShuffledIndexes(newShuffledIndexes);
          }
          return sortedQuestions;
        });
      }
    };

    loadQuestions();

    // Polling cada 10 segundos como respaldo para cuando Realtime no funcione
    const pollingInterval = setInterval(loadQuestions, 10000);

    // Escuchar cuando las preguntas se publican (UPDATE para cuando published cambia a true)
    const channel = supabase
      .channel(`player:${roomId}:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "questions",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          loadQuestions();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "questions",
          filter: `room_id=eq.${roomId}`,
        },
        () => {
          loadQuestions();
        }
      )
      .subscribe();

    return () => {
      clearInterval(pollingInterval);
      supabase.removeChannel(channel);
    };
  }, [roomId, userId]);

  useEffect(() => {
    if (timeLeft > 0 && !hasAnswered) {
      const timer = setTimeout(() => {
        setTimeLeft(timeLeft - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (timeLeft === 0 && allQuestions.length > 0 && !hasAnswered) {
      // Tiempo agotado
      toast.error("Time's up!");
      setShowResult(true);

      // Avanzar a la siguiente pregunta después de 3 segundos con animación
      setTimeout(() => {
        if (currentQuestionIndex < allQuestions.length - 1) {
          setIsTransitioning(true);
          setTimeout(() => {
            const nextIndex = currentQuestionIndex + 1;
            setCurrentQuestionIndex(nextIndex);
            setTimeLeft(allQuestions[nextIndex].duration_seconds);
            setHasAnswered(false);
            setSelectedOption(null);
            setShowResult(false);
            setIsTransitioning(false);
          }, 300);
        }
      }, 3000);
    }
  }, [timeLeft, hasAnswered, allQuestions, currentQuestionIndex]);

  const handleSelectOption = async (visualIndex: number) => {
    if (hasAnswered || allQuestions.length === 0) return;

    const currentQuestion = allQuestions[currentQuestionIndex];
    // Convertir índice visual a índice original
    const shuffle = shuffledIndexes[currentQuestion.id];
    const originalIndex = shuffle ? shuffle[visualIndex] : visualIndex;

    setSelectedOption(visualIndex);
    setIsSubmitting(true);

    try {
      const result = await submitAnswer(
        currentQuestion.id,
        userId,
        originalIndex
      );

      if (result.error) {
        toast.error(result.error);
        setSelectedOption(null);
      } else {
        setHasAnswered(true);
        setShowResult(true);

        if (originalIndex === currentQuestion.correct_index) {
          // Calcular puntos basados en tiempo restante
          const timeBonus = Math.floor(timeLeft * 10);
          const streakBonus = streak * 50;
          const points = 100 + timeBonus + streakBonus;

          setScore((prev) => prev + points);
          setStreak((prev) => prev + 1);
          setShowCorrectAnimation(true);
          fireCorrectAnswer();

          toast.success(`+${points} points! 🎉`, {
            description:
              streak > 0 ? `${streak + 1} answer streak! 🔥` : undefined,
          });

          setTimeout(() => setShowCorrectAnimation(false), 1000);
        } else {
          setStreak(0);
          toast.error("Wrong answer");
        }

        // Avanzar a la siguiente pregunta después de 3 segundos con animación
        setTimeout(() => {
          if (currentQuestionIndex < allQuestions.length - 1) {
            setIsTransitioning(true);
            setTimeout(() => {
              const nextIndex = currentQuestionIndex + 1;
              setCurrentQuestionIndex(nextIndex);
              setTimeLeft(allQuestions[nextIndex].duration_seconds);
              setHasAnswered(false);
              setSelectedOption(null);
              setShowResult(false);
              setIsTransitioning(false);
            }, 300);
          }
        }, 3000);
      }
    } catch {
      toast.error("Failed to submit answer");
      setSelectedOption(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getOptionStyle = (visualIndex: number) => {
    if (!showResult) {
      return selectedOption === visualIndex
        ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
        : "border-gray-200 dark:border-gray-700 hover:border-purple-300";
    }

    const currentQuestion = allQuestions[currentQuestionIndex];
    const shuffle = shuffledIndexes[currentQuestion.id];
    const originalIndex = shuffle ? shuffle[visualIndex] : visualIndex;

    // Encontrar cuál es la posición visual de la respuesta correcta
    const correctVisualIndex = shuffle
      ? shuffle.indexOf(currentQuestion.correct_index)
      : currentQuestion.correct_index;

    if (visualIndex === correctVisualIndex) {
      return "border-green-500 bg-green-50 dark:bg-green-900/20";
    }

    if (
      selectedOption === visualIndex &&
      originalIndex !== currentQuestion?.correct_index
    ) {
      return "border-red-500 bg-red-50 dark:bg-red-900/20";
    }

    return "border-gray-200 dark:border-gray-700 opacity-50";
  };

  if (allQuestions.length === 0) {
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
            <Clock className="w-16 h-16 mx-auto mb-4 text-muted-foreground animate-pulse" />
            <h2 className="text-2xl font-bold mb-2">
              Waiting for questions...
            </h2>
            <p className="text-muted-foreground">
              The host will start the quiz soon
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentQuestion = allQuestions[currentQuestionIndex];
  const progress = (timeLeft / currentQuestion.duration_seconds) * 100;

  // Determinar color del timer basado en tiempo restante
  const getTimerColor = () => {
    if (timeLeft <= 5) return "bg-red-500 text-white animate-pulse";
    if (timeLeft <= 10) return "bg-orange-500 text-white";
    return "bg-secondary";
  };

  // Color de la barra de progreso
  const getProgressBarColor = () => {
    if (timeLeft <= 5) return "bg-gradient-to-r from-red-600 to-red-400";
    if (timeLeft <= 10) return "bg-gradient-to-r from-orange-500 to-yellow-400";
    return "bg-gradient-to-r from-purple-600 via-pink-500 to-purple-400";
  };

  // Color del fondo de la barra
  const getProgressBgColor = () => {
    if (timeLeft <= 5) return "bg-red-200 dark:bg-red-900/30";
    if (timeLeft <= 10) return "bg-orange-200 dark:bg-orange-900/30";
    return "bg-purple-100 dark:bg-purple-900/20";
  };

  return (
    <div
      suppressHydrationWarning
      className={`min-h-screen bg-linear-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-black dark:to-gray-900 flex items-center justify-center p-4 transition-all duration-300 ${showCorrectAnimation ? "bg-green-100 dark:bg-green-900/20" : ""}`}
    >
      {/* Score display en la esquina superior izquierda */}
      <div className="absolute top-4 left-4 flex flex-col gap-2">
        <motion.div
          key={score}
          initial={{ scale: 1 }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 0.3 }}
        >
          <Badge variant="secondary" className="gap-2 text-lg px-3 py-1">
            <Trophy className="w-5 h-5 text-yellow-500" />
            {score} pts
          </Badge>
        </motion.div>
        <AnimatePresence>
          {streak > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <Badge
                variant="default"
                className="gap-1 bg-orange-500 hover:bg-orange-600"
              >
                <Zap className="w-4 h-4" />
                {streak} streak 🔥
              </Badge>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, x: isTransitioning ? -50 : 50 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -50 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="max-w-2xl w-full"
        >
          <Card
            className={`transition-all duration-300 ${showCorrectAnimation ? "ring-4 ring-green-500 ring-opacity-50" : ""}`}
          >
            <CardHeader>
              {/* Progress bar con colores dinámicos */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <Badge variant="outline" className="font-semibold">
                    Question {currentQuestionIndex + 1} of {allQuestions.length}
                  </Badge>
                  <motion.div
                    animate={timeLeft <= 5 ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 0.5, repeat: Infinity }}
                  >
                    <Badge
                      className={`gap-2 text-lg font-bold ${getTimerColor()}`}
                    >
                      <Clock
                        className={`w-5 h-5 ${timeLeft <= 5 ? "animate-spin" : ""}`}
                      />
                      {timeLeft}s
                    </Badge>
                  </motion.div>
                </div>
                {/* Barra de progreso mejorada */}
                <div className="relative overflow-hidden rounded-full">
                  <div
                    className={`h-4 rounded-full overflow-hidden ${getProgressBgColor()}`}
                  >
                    <motion.div
                      className={`h-full rounded-full ${getProgressBarColor()}`}
                      initial={{ width: "100%" }}
                      animate={{
                        width: `${progress}%`,
                        boxShadow:
                          timeLeft <= 5
                            ? [
                                "0 0 10px rgba(239, 68, 68, 0.5)",
                                "0 0 20px rgba(239, 68, 68, 0.8)",
                                "0 0 10px rgba(239, 68, 68, 0.5)",
                              ]
                            : timeLeft <= 10
                              ? "0 0 10px rgba(249, 115, 22, 0.5)"
                              : "0 0 5px rgba(147, 51, 234, 0.3)",
                      }}
                      transition={{
                        width: { duration: 0.3 },
                        boxShadow: {
                          duration: 0.5,
                          repeat: timeLeft <= 5 ? Infinity : 0,
                        },
                      }}
                    />
                  </div>
                  {/* Brillo animado */}
                  {timeLeft > 5 && (
                    <motion.div
                      className="absolute top-0 left-0 h-full w-1/4 bg-linear-to-r from-transparent via-white/30 to-transparent rounded-full"
                      animate={{ x: ["-100%", "500%"] }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                    />
                  )}
                </div>
              </div>

              {/* Resultado después de responder */}
              {showResult &&
                (() => {
                  const shuffle = shuffledIndexes[currentQuestion.id];
                  const selectedOriginalIndex =
                    shuffle && selectedOption !== null
                      ? shuffle[selectedOption]
                      : selectedOption;
                  const isCorrect =
                    selectedOriginalIndex === currentQuestion.correct_index;
                  return (
                    <div
                      className={`mb-4 p-4 rounded-lg text-center ${
                        isCorrect
                          ? "bg-green-100 dark:bg-green-900/30 border-2 border-green-500"
                          : "bg-red-100 dark:bg-red-900/30 border-2 border-red-500"
                      }`}
                    >
                      {isCorrect ? (
                        <div className="flex items-center justify-center gap-2">
                          <CheckCircle className="w-8 h-8 text-green-600" />
                          <span className="text-2xl font-bold text-green-600">
                            Correct!
                          </span>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-2">
                          <XCircle className="w-8 h-8 text-red-600" />
                          <span className="text-2xl font-bold text-red-600">
                            Wrong!
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}

              <CardTitle className="text-2xl">{currentQuestion.text}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(
                  shuffledIndexes[currentQuestion.id] ||
                  currentQuestion.options.map((_, i) => i)
                ).map((originalIndex, visualIndex) => (
                  <motion.div
                    key={visualIndex}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: visualIndex * 0.1, duration: 0.3 }}
                    whileHover={{ scale: hasAnswered ? 1 : 1.02 }}
                    whileTap={{ scale: hasAnswered ? 1 : 0.98 }}
                  >
                    <Button
                      variant="outline"
                      className={`w-full h-auto min-h-15 text-lg p-4 ${getOptionStyle(visualIndex)}`}
                      onClick={() => handleSelectOption(visualIndex)}
                      disabled={hasAnswered || isSubmitting || timeLeft === 0}
                    >
                      {currentQuestion.options[originalIndex]}
                    </Button>
                  </motion.div>
                ))}
              </div>
              {showResult && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center text-muted-foreground mt-4"
                >
                  Waiting for next question...
                </motion.p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
