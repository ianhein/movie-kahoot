"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  submitAnswer,
  getPublishedQuestions,
} from "@/app/actions/quiz-actions";
import { toast } from "sonner";
import type { Room, Question } from "@/lib/types";

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

  useEffect(() => {
    const supabase = createClient();

    // Cargar todas las preguntas publicadas
    const loadQuestions = async () => {
      const result = await getPublishedQuestions(roomId);
      if (result.questions && result.questions.length > 0) {
        const sortedQuestions = (result.questions as Question[]).sort(
          (a, b) => (a.question_order ?? 0) - (b.question_order ?? 0)
        );
        setAllQuestions(sortedQuestions);
        setCurrentQuestionIndex(0);
        setTimeLeft(sortedQuestions[0].duration_seconds);
        setHasAnswered(false);
        setSelectedOption(null);
        setShowResult(false);
      }
    };

    loadQuestions();

    // Escuchar cuando las preguntas se publican
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
      .subscribe();

    return () => {
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

      // Avanzar a la siguiente pregunta después de 3 segundos
      setTimeout(() => {
        if (currentQuestionIndex < allQuestions.length - 1) {
          const nextIndex = currentQuestionIndex + 1;
          setCurrentQuestionIndex(nextIndex);
          setTimeLeft(allQuestions[nextIndex].duration_seconds);
          setHasAnswered(false);
          setSelectedOption(null);
          setShowResult(false);
        }
      }, 3000);
    }
  }, [timeLeft, hasAnswered, allQuestions, currentQuestionIndex]);

  const handleSelectOption = async (index: number) => {
    if (hasAnswered || allQuestions.length === 0) return;

    const currentQuestion = allQuestions[currentQuestionIndex];
    setSelectedOption(index);
    setIsSubmitting(true);

    try {
      const result = await submitAnswer(currentQuestion.id, userId, index);

      if (result.error) {
        toast.error(result.error);
        setSelectedOption(null);
      } else {
        setHasAnswered(true);
        setShowResult(true);

        if (index === currentQuestion.correct_index) {
          toast.success("Correct! 🎉");
        } else {
          toast.error("Wrong answer");
        }

        // Avanzar a la siguiente pregunta después de 3 segundos
        setTimeout(() => {
          if (currentQuestionIndex < allQuestions.length - 1) {
            const nextIndex = currentQuestionIndex + 1;
            setCurrentQuestionIndex(nextIndex);
            setTimeLeft(allQuestions[nextIndex].duration_seconds);
            setHasAnswered(false);
            setSelectedOption(null);
            setShowResult(false);
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

  const getOptionStyle = (index: number) => {
    if (!showResult) {
      return selectedOption === index
        ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
        : "border-gray-200 dark:border-gray-700 hover:border-purple-300";
    }

    const currentQuestion = allQuestions[currentQuestionIndex];
    if (index === currentQuestion?.correct_index) {
      return "border-green-500 bg-green-50 dark:bg-green-900/20";
    }

    if (selectedOption === index && index !== currentQuestion?.correct_index) {
      return "border-red-500 bg-red-50 dark:bg-red-900/20";
    }

    return "border-gray-200 dark:border-gray-700 opacity-50";
  };

  if (allQuestions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-black dark:to-gray-900 flex items-center justify-center p-4">
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-black dark:to-gray-900 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-2">
                <Clock className="w-4 h-4" />
                {timeLeft}s
              </Badge>
              <Badge variant="outline">
                Question {currentQuestionIndex + 1} of {allQuestions.length}
              </Badge>
            </div>
            {showResult && (
              <Badge
                variant={
                  selectedOption === currentQuestion.correct_index
                    ? "default"
                    : "destructive"
                }
              >
                {selectedOption === currentQuestion.correct_index ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Correct!
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-1" />
                    Wrong
                  </>
                )}
              </Badge>
            )}
          </div>
          <Progress value={progress} className="mb-4" />
          <CardTitle className="text-2xl">{currentQuestion.text}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {currentQuestion.options.map((option, index) => (
              <Button
                key={index}
                variant="outline"
                className={`h-auto min-h-[60px] text-lg p-4 ${getOptionStyle(index)}`}
                onClick={() => handleSelectOption(index)}
                disabled={hasAnswered || isSubmitting || timeLeft === 0}
              >
                {option}
              </Button>
            ))}
          </div>
          {showResult && (
            <p className="text-center text-muted-foreground mt-4">
              Waiting for next question...
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
