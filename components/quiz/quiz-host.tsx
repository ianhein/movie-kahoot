"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
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
  deleteQuestion,
} from "@/app/actions/quiz-actions";
import { generateQuestionsAction } from "@/app/actions/ai-actions";
import { toast } from "sonner";
import type { Question, Answer, QuizHostProps, Room } from "@/lib/types";
import { GeneratedQuestion } from "@/lib/gemini";
import { Sparkles, Loader2 } from "lucide-react";
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [generatedQuestions, setGeneratedQuestions] = useState<GeneratedQuestion[]>([]);
  // New state for suggestion cycling
  const [activeSuggestions, setActiveSuggestions] = useState<GeneratedQuestion[]>([]);
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);

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
        // Remove used suggestion from activeSuggestions if applicable
        if (activeSuggestions.length > 0) {
            const newSuggestions = activeSuggestions.filter((_, i) => i !== currentSuggestionIndex);
            setActiveSuggestions(newSuggestions);
            
            if (newSuggestions.length === 0) {
                // No more suggestions
                setQuestionText("");
                setOptions(["", "", "", ""]);
                setCorrectIndex(0);
                setCurrentSuggestionIndex(0);
                toast.success("All suggestions used!");
            } else {
                 // Move to next available or stay at index
                 let newIndex = currentSuggestionIndex;
                 if (newIndex >= newSuggestions.length) {
                     newIndex = newSuggestions.length - 1;
                 }
                 setCurrentSuggestionIndex(newIndex);
                 
                 // Auto-load next suggestion
                 const nextQ = newSuggestions[newIndex];
                 setQuestionText(nextQ.text);
                 setOptions(nextQ.options);
                 setCorrectIndex(nextQ.correct_index);
            }
        } else {
            setQuestionText("");
            setOptions(["", "", "", ""]);
            setCorrectIndex(0);
        }
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

  const handleGenerateQuestions = async () => {
    setIsGenerating(true);
    try {
      // Intentar generar preguntas sobre la película ganadora
      const existingQuestionTexts = questions.map(q => q.text);
      const result = await generateQuestionsAction(
          roomId, 
          undefined, 
          3, 
          "en", // TODO: Usar el locale real
          existingQuestionTexts
      );

      if (result.error) {
        toast.error(result.error);
      } else if (result.questions) {
        setGeneratedQuestions(result.questions);

        setShowGenerateDialog(true);
        toast.success(`Generated questions about "${result.source}"`);
      }
    } catch {
      toast.error("Failed to generate questions");
    } finally {
      setIsGenerating(false);
    }
  };



  const handleDeleteQuestion = async () => {
    if (!questionToDelete) return;

    setIsDeleting(true);
    try {
      const result = await deleteQuestion(roomId, questionToDelete);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Question deleted");
        setQuestions((prev) => prev.filter((q) => q.id !== questionToDelete));
        setQuestionToDelete(null);
      }
    } catch {
      toast.error("Failed to delete question");
    } finally {
      setIsDeleting(false);
    }
  };

  const loadSuggestionsToEditor = () => {
     if (generatedQuestions.length === 0) return;
     setActiveSuggestions(generatedQuestions);
     setCurrentSuggestionIndex(0);
     loadSuggestionIntoForm(generatedQuestions[0]);
     setShowGenerateDialog(false);
     toast.success("Loaded 3 generated questions! Cycle through them to edit/add.");
  };

  const loadSuggestionIntoForm = (q: GeneratedQuestion) => {
    setQuestionText(q.text);
    setOptions(q.options);
    setCorrectIndex(q.correct_index);
  };

  const handleNextSuggestion = () => {
    const nextIndex = (currentSuggestionIndex + 1) % activeSuggestions.length;
    setCurrentSuggestionIndex(nextIndex);
    loadSuggestionIntoForm(activeSuggestions[nextIndex]);
  };

  const handlePrevSuggestion = () => {
    const prevIndex = (currentSuggestionIndex - 1 + activeSuggestions.length) % activeSuggestions.length;
    setCurrentSuggestionIndex(prevIndex);
    loadSuggestionIntoForm(activeSuggestions[prevIndex]);
  };

  const handleDiscardSuggestions = () => {
    setActiveSuggestions([]);
    setCurrentSuggestionIndex(0);
    setQuestionText("");
    setOptions(["", "", "", ""]);
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
            {/* Lobby Avatar Grid */}
            {!arePublished && members.length > 0 && (
              <CardContent className="border-t bg-gray-50/50 dark:bg-gray-900/50">
                <div className="mb-2 text-sm text-muted-foreground font-medium">
                  Lobby ({members.length} players ready)
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
                  <AnimatePresence>
                    {members.map((member: any) => {
                      const name = member.users?.name || "Unknown";
                      return (
                        <motion.div
                          key={member.user_id}
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          className="flex flex-col items-center gap-2"
                        >
                           <div className="relative">
                              <div className="w-16 h-16 rounded-full overflow-hidden border-4 border-white dark:border-gray-800 shadow-md bg-purple-100">
                                <img 
                                  src={`https://api.dicebear.com/9.x/avataaars/svg?seed=${name}&backgroundColor=b6e3f4,c0aede,d1d4f9`} 
                                  alt={name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                           </div>
                           <span className="text-xs font-medium text-center truncate w-full px-1">
                              {name}
                           </span>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </CardContent>
            )}
          </Card>

          {!arePublished && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Create Question {questions.length + 1}</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateQuestions}
                    disabled={isGenerating || questions.length >= 15}
                    className="gap-2 bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300"
                  >
                    {isGenerating ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                    Generate with AI
                  </Button>
                </div>
                
                {/* Suggestion Toolbar */}
                {activeSuggestions.length > 0 && (
                    <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                                Suggestion {currentSuggestionIndex + 1} of {activeSuggestions.length}
                            </span>
                         </div>
                         <div className="flex items-center gap-2">
                             <Button size="sm" variant="outline" onClick={handlePrevSuggestion} className="h-8">
                                &lt; Prev
                             </Button>
                             <Button size="sm" variant="outline" onClick={handleNextSuggestion} className="h-8">
                                Next &gt;
                             </Button>
                             <div className="w-px h-4 bg-gray-300 dark:bg-gray-700 mx-1" />
                             <Button size="sm" variant="ghost" onClick={handleDiscardSuggestions} className="h-8 text-red-500 hover:text-red-600 hover:bg-red-50">
                                Discard All
                             </Button>
                         </div>
                    </div>
                )}
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
                          {!arePublished && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => setQuestionToDelete(q.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
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
        <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-500" />
                Review Generated Questions
              </DialogTitle>
              <DialogDescription>
                Select the questions you want to add to the quiz.
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 my-4">
              {generatedQuestions.map((q, index) => (
                <div 
                  key={index} 
                  className="p-4 border rounded-lg bg-purple-50 dark:bg-purple-900/10 border-purple-200 dark:border-purple-800"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-2">
                       <p className="font-medium">{q.text}</p>
                      <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                        {q.options.map((opt, i) => (
                          <div key={i} className={`px-2 py-1 rounded border ${
                            i === q.correct_index 
                              ? 'bg-green-100 dark:bg-green-900/30 border-green-200' 
                              : 'bg-background border-transparent'
                          }`}>
                            {opt}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowGenerateDialog(false)}
              >
                Close
              </Button>
               <Button
                onClick={loadSuggestionsToEditor}
                className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
              >
                <Sparkles className="w-4 h-4" />
                Load All to Editor
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!questionToDelete} onOpenChange={(open) => !open && setQuestionToDelete(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Question?</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this question? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setQuestionToDelete(null)}
                disabled={isDeleting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleDeleteQuestion}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Question"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
