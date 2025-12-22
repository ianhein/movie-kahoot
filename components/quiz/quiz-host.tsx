"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Users, Trophy } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { createQuestion, finishQuiz } from "@/app/actions/quiz-actions";
import { toast } from "sonner";
import type { Database } from "@/lib/supabase/database.types";

type Room = Database["public"]["Tables"]["rooms"]["Row"];
type Member = {
  user_id: string;
  users: { name: string } | null;
};

interface QuizHostProps {
  roomId: string;
  room: Room;
  members: Member[];
  userId: string;
  userName: string | null;
}

export function QuizHost({ roomId, room, members }: QuizHostProps) {
  const [questionText, setQuestionText] = useState("");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [duration, setDuration] = useState(20);
  const [isCreating, setIsCreating] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`questions:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "questions",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          if (payload.new) {
            setQuestions((prev) => [...prev, payload.new]);
            setCurrentQuestion(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

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
        toast.success("Question created!");
        setQuestionText("");
        setOptions(["", "", "", ""]);
        setCorrectIndex(0);
      }
    } catch (error) {
      toast.error("Failed to create question");
    } finally {
      setIsCreating(false);
    }
  };

  const handleFinishQuiz = async () => {
    if (questions.length === 0) {
      toast.error("Create at least one question first");
      return;
    }

    setIsFinishing(true);
    try {
      const result = await finishQuiz(roomId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Quiz finished! Showing results...");
      }
    } catch (error) {
      toast.error("Failed to finish quiz");
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-gray-900 dark:via-black dark:to-gray-900 p-4">
      <div className="max-w-4xl mx-auto space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl">Quiz Host Panel</CardTitle>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="gap-1">
                    <Users className="w-3 h-3" />
                    {members.length} players
                  </Badge>
                  <Badge variant="secondary">
                    {questions.length} questions created
                  </Badge>
                </div>
              </div>
              <Button
                variant="default"
                onClick={handleFinishQuiz}
                disabled={isFinishing || questions.length === 0}
              >
                <Trophy className="w-4 h-4 mr-2" />
                {isFinishing ? "Finishing..." : "Finish Quiz"}
              </Button>
            </div>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create New Question</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Question</label>
              <Input
                placeholder="What happened in this scene?"
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                disabled={isCreating}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Options</label>
              {options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder={`Option ${index + 1}`}
                    value={option}
                    onChange={(e) => handleOptionChange(index, e.target.value)}
                    disabled={isCreating}
                  />
                  <Button
                    variant={correctIndex === index ? "default" : "outline"}
                    onClick={() => setCorrectIndex(index)}
                    disabled={isCreating}
                  >
                    {correctIndex === index ? "✓ Correct" : "Mark Correct"}
                  </Button>
                  {options.length > 2 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOption(index)}
                      disabled={isCreating}
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
                  disabled={isCreating}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Option
                </Button>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Duration (seconds)</label>
              <Input
                type="number"
                min={5}
                max={60}
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                disabled={isCreating}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleCreateQuestion}
              disabled={isCreating}
            >
              {isCreating ? "Creating..." : "Create Question"}
            </Button>
          </CardContent>
        </Card>

        {currentQuestion && (
          <Card className="border-2 border-purple-500">
            <CardHeader>
              <CardTitle>Current Question</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold mb-4">
                {currentQuestion.text}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {currentQuestion.options.map(
                  (option: string, index: number) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border-2 ${
                        index === currentQuestion.correct_index
                          ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                          : "border-gray-200 dark:border-gray-700"
                      }`}
                    >
                      {option}
                    </div>
                  )
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Players have {currentQuestion.duration_seconds} seconds to
                answer
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
