"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Trash2,
  Users,
  Trophy,
  Send,
  Check,
  Clock,
  Wifi,
  WifiOff,
  AlertCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createQuestion,
  finishQuiz,
  publishQuestions,
  getAllQuestions,
  getQuestionAnswers,
} from "@/app/actions/quiz-actions";
import { toast } from "sonner";
import type { Question, Answer, QuizHostProps, Room } from "@/lib/types";
import { ThemeToggle } from "@/components/theme-toggle";

// Helper para formatear tiempo
const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export function QuizHost({
  roomId,
  members,
  room: initialRoom,
}: QuizHostProps) {
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [duration, setDuration] = useState(20);
  const [isCreating, setIsCreating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [arePublished, setArePublished] = useState(false);
  const [questionAnswers, setQuestionAnswers] = useState<
    Record<string, Answer[]>
  >({});
  const [room, setRoom] = useState(initialRoom);
  const [showFinishDialog, setShowFinishDialog] = useState(false);
  const [publishedAt, setPublishedAt] = useState<Date | null>(null);
  const [elapsedTime, setElapsedTime] = useState(0);

  // Timer para mostrar el tiempo transcurrido desde que se publicó
  useEffect(() => {
    if (!arePublished || !publishedAt) return;

    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - publishedAt.getTime()) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [arePublished, publishedAt]);

  // Cargar preguntas existentes
  useEffect(() => {
    const loadQuestions = async () => {
      const result = await getAllQuestions(roomId);
      if (result.questions) {
        setQuestions(result.questions as unknown as Question[]);
        const firstQuestion = result.questions[0] as Question | undefined;
        setArePublished(
          result.questions.length > 0 && firstQuestion?.published === true
        );
      }
    };

    loadQuestions();

    const supabase = createClient();

    // Escuchar cambios en el room
    const roomChannel = supabase
      .channel(`room-status:${roomId}`)
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

    // Escuchar cambios en preguntas
    const questionsChannel = supabase
      .channel(`questions:${roomId}`)
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
      supabase.removeChannel(roomChannel);
      supabase.removeChannel(questionsChannel);
    };
  }, [roomId]);

  // Cargar respuestas cuando las preguntas están publicadas
  useEffect(() => {
    if (!arePublished || questions.length === 0) return;

    const loadAnswers = async () => {
      const answersData: Record<string, Answer[]> = {};

      for (const question of questions) {
        const result = await getQuestionAnswers(question.id);
        if (result.answers) {
          answersData[question.id] = result.answers;
        }
      }

      setQuestionAnswers(answersData);
    };

    loadAnswers();

    // Escuchar nuevas respuestas en tiempo real
    const supabase = createClient();
    const channel = supabase
      .channel(`answers:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "answers",
        },
        () => {
          loadAnswers();
        }
      )
      .subscribe();

    // Polling cada 15 segundos como respaldo (Realtime debería manejar la mayoría)
    const interval = setInterval(loadAnswers, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [arePublished, questions, roomId]);

  const handleAddOption = () => {
    if (options.length < 6) {
      setOptions([...options, ""]);
    }
  };

  const handleRemoveOption = (index: number) => {
    if (options.length > 2) {
      setOptions(options.filter((_, i) => i !== index));
      if (correctIndex >= options.length - 1) {
        setCorrectIndex(options.length - 2);
      }
    }
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const handleCreateQuestion = async () => {
    if (!questionText.trim()) {
      toast.error("Please enter a question");
      return;
    }

    const validOptions = options.filter((o) => o.trim());
    if (validOptions.length < 2) {
      toast.error("Please add at least 2 options");
      return;
    }

    if (questions.length >= 15) {
      toast.error("Maximum of 15 questions reached");
      return;
    }

    setIsCreating(true);
    try {
      const result = await createQuestion(
        roomId,
        questionText,
        validOptions,
        correctIndex,
        duration
      );

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Question added!");
        // Agregar la pregunta al estado inmediatamente
        if (result.question) {
          setQuestions((prev) => [...prev, result.question as Question]);
        }
        setQuestionText("");
        setOptions(["", "", "", ""]);
        setCorrectIndex(0);
      }
    } catch {
      toast.error("Failed to create question");
    } finally {
      setIsCreating(false);
    }
  };

  const handlePublishQuestions = async () => {
    if (questions.length === 0) {
      toast.error("Create at least one question first");
      return;
    }

    if (members.length === 0) {
      toast.error("No players connected! Wait for players to join.");
      return;
    }

    setIsPublishing(true);
    try {
      const result = await publishQuestions(roomId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Questions published! Players can now answer.");
        setArePublished(true);
        setPublishedAt(new Date());
      }
    } catch {
      toast.error("Failed to publish questions");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleFinishQuiz = async () => {
    if (!arePublished) {
      toast.error("Publish questions first");
      return;
    }

    setShowFinishDialog(false);
    setIsFinishing(true);
    try {
      const result = await finishQuiz(roomId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Quiz finished! Showing results...");
        // Actualizar el estado del room localmente para mostrar resultados
        setRoom((prev) => ({ ...prev, status: "finished" }));
      }
    } catch {
      toast.error("Failed to finish quiz");
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <TooltipProvider>
      <div
        suppressHydrationWarning
        className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-black dark:to-gray-900 p-4"
      >
        <div className="max-w-4xl mx-auto space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-2xl mb-2">
                      Quiz Host Panel
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant={
                          members.length === 0 ? "destructive" : "secondary"
                        }
                        className="gap-1"
                      >
                        {members.length === 0 ? (
                          <WifiOff className="w-3 h-3" />
                        ) : (
                          <Users className="w-3 h-3" />
                        )}
                        {members.length} players
                      </Badge>
                      <Badge variant="secondary">
                        {questions.length}/15 questions
                      </Badge>
                      {arePublished && (
                        <>
                          <Badge variant="default" className="gap-1">
                            <Check className="w-3 h-3" />
                            Published
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(elapsedTime)}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                    <ThemeToggle />
                    {!arePublished && questions.length > 0 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="default"
                            onClick={handlePublishQuestions}
                            disabled={isPublishing || members.length === 0}
                            className="whitespace-nowrap"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            {isPublishing ? "Publishing..." : "Publish Quiz"}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Send questions to all connected players</p>
                        </TooltipContent>
                      </Tooltip>
                    )}
                    {arePublished && room.status !== "finished" && (
                      <Button
                        variant="default"
                        onClick={() => setShowFinishDialog(true)}
                        disabled={isFinishing}
                        className="whitespace-nowrap"
                      >
                        <Trophy className="w-4 h-4 mr-2" />
                        {isFinishing ? "Finishing..." : "Finish Quiz"}
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
          </Card>

          {!arePublished && (
            <Card>
              <CardHeader>
                <CardTitle>Create Question {questions.length + 1}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Question</label>
                  <Input
                    placeholder="What happened in this scene?"
                    value={questionText}
                    onChange={(e) => setQuestionText(e.target.value)}
                    disabled={isCreating || questions.length >= 15}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Options</label>
                  {options.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder={`Option ${index + 1}`}
                        value={option}
                        onChange={(e) =>
                          handleOptionChange(index, e.target.value)
                        }
                        disabled={isCreating || questions.length >= 15}
                      />
                      <Button
                        variant={correctIndex === index ? "default" : "outline"}
                        onClick={() => setCorrectIndex(index)}
                        disabled={isCreating || questions.length >= 15}
                        className="min-w-[120px]"
                      >
                        {correctIndex === index ? "✓ Correct" : "Mark Correct"}
                      </Button>
                      {options.length > 2 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveOption(index)}
                          disabled={isCreating || questions.length >= 15}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {options.length < 6 && (
                    <Button
                      variant="outline"
                      onClick={handleAddOption}
                      disabled={isCreating || questions.length >= 15}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Option
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Duration (seconds)
                  </label>
                  <Input
                    type="number"
                    min={5}
                    max={60}
                    value={duration}
                    onChange={(e) => setDuration(parseInt(e.target.value))}
                    disabled={isCreating || questions.length >= 15}
                  />
                </div>

                <Button
                  className="w-full"
                  onClick={handleCreateQuestion}
                  disabled={isCreating || questions.length >= 15}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {isCreating
                    ? "Creating..."
                    : questions.length >= 15
                      ? "Maximum questions reached"
                      : "Add Question"}
                </Button>
              </CardContent>
            </Card>
          )}

          {questions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Questions Created ({questions.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {questions.map((q, index) => {
                  const answers = questionAnswers[q.id] || [];
                  const correctAnswers = answers.filter((a) => a.is_correct);
                  const wrongAnswers = answers.filter((a) => !a.is_correct);

                  return (
                    <Card key={q.id} className="border">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <Badge variant="outline">Question {index + 1}</Badge>
                          <div className="flex gap-2">
                            <Badge variant="secondary">
                              {q.duration_seconds}s
                            </Badge>
                            {arePublished && (
                              <Badge variant="outline">
                                {answers.length}/{members.length} answered
                              </Badge>
                            )}
                          </div>
                        </div>
                        <p className="font-semibold mb-2">{q.text}</p>
                        <div className="grid grid-cols-2 gap-2 mb-3">
                          {q.options.map((option, optIndex) => (
                            <div
                              key={optIndex}
                              className={`p-2 rounded text-sm ${
                                optIndex === q.correct_index
                                  ? "bg-green-100 dark:bg-green-900/30 border border-green-300"
                                  : "bg-gray-100 dark:bg-gray-800"
                              }`}
                            >
                              {option}
                            </div>
                          ))}
                        </div>

                        {arePublished && answers.length > 0 && (
                          <div className="mt-3 pt-3 border-t space-y-2">
                            <div className="text-sm font-medium">Answers:</div>

                            {correctAnswers.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-xs font-semibold text-green-600 dark:text-green-400">
                                  ✓ Correct ({correctAnswers.length}):
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {correctAnswers.map((answer) => (
                                    <Badge
                                      key={answer.user_id}
                                      variant="outline"
                                      className="bg-green-50 dark:bg-green-900/20 border-green-300"
                                    >
                                      {answer.user_name}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {wrongAnswers.length > 0 && (
                              <div className="space-y-1">
                                <div className="text-xs font-semibold text-red-600 dark:text-red-400">
                                  ✗ Wrong ({wrongAnswers.length}):
                                </div>
                                <div className="flex flex-wrap gap-1">
                                  {wrongAnswers.map((answer) => (
                                    <Badge
                                      key={answer.user_id}
                                      variant="outline"
                                      className="bg-red-50 dark:bg-red-900/20 border-red-300"
                                    >
                                      {answer.user_name}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        <Dialog open={showFinishDialog} onOpenChange={setShowFinishDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Finish Quiz?</DialogTitle>
              <DialogDescription>
                This will end the quiz and show the final results to all
                players. Players will no longer be able to answer questions.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowFinishDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                onClick={handleFinishQuiz}
                disabled={isFinishing}
              >
                {isFinishing ? "Finishing..." : "Finish Quiz"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
