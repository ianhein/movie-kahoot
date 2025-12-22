"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { updateTag, unstable_cache } from "next/cache";

export async function getAllQuestions(roomId: string) {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (error) {
      return { questions: [] };
    }

    return { questions: data || [] };
  } catch {
    return { questions: [] };
  }
}

export async function getQuestionAnswers(questionId: string) {
  try {
    const supabase = createAdminClient();

    // Obtener la pregunta para saber el correct_index
    const { data: question, error: questionError } = await supabase
      .from("questions")
      .select("correct_index")
      .eq("id", questionId)
      .single();

    if (questionError || !question) {
      return { answers: [] };
    }

    // Obtener todas las respuestas
    const { data: answers, error: answersError } = await supabase
      .from("answers")
      .select("user_id, option_index, answered_at")
      .eq("question_id", questionId);

    if (answersError || !answers) {
      return { answers: [] };
    }

    // Obtener nombres de usuarios
    const userIds = answers.map((a) => a.user_id);
    const { data: users } = await supabase
      .from("users")
      .select("id, name")
      .in("id", userIds);

    // Combinar datos
    const answersWithUsers = answers.map((answer) => {
      const user = users?.find((u) => u.id === answer.user_id);
      return {
        user_id: answer.user_id,
        user_name: user?.name || "Unknown",
        option_index: answer.option_index,
        is_correct: answer.option_index === question.correct_index,
        answered_at: answer.answered_at,
      };
    });

    return { answers: answersWithUsers };
  } catch {
    return { answers: [] };
  }
}

export async function getPublishedQuestions(roomId: string) {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("room_id", roomId)
      .eq("published", true)
      .order("question_order", { ascending: true });

    if (error) {
      return { questions: [] };
    }

    return { questions: data || [] };
  } catch {
    return { questions: [] };
  }
}

export async function publishQuestions(roomId: string) {
  try {
    const supabase = createAdminClient();

    // Obtener todas las preguntas de la sala
    const { data: questions, error: fetchError } = await supabase
      .from("questions")
      .select("id")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });

    if (fetchError || !questions || questions.length === 0) {
      return { error: "No questions to publish" };
    }

    // Actualizar todas las preguntas como publicadas con su orden
    const updates = questions.map((q, index) =>
      supabase
        .from("questions")
        .update({ published: true, question_order: index })
        .eq("id", q.id)
    );

    await Promise.all(updates);

    updateTag(`quiz-questions-${roomId}`);

    return { success: true };
  } catch {
    return { error: "Failed to publish questions" };
  }
}

export async function getLatestQuestion(roomId: string) {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("questions")
      .select("*")
      .eq("room_id", roomId)
      .eq("published", true)
      .order("question_order", { ascending: true })
      .limit(1)
      .single();

    if (error) {
      // No hay preguntas publicadas aún
      return { question: null };
    }

    return { question: data };
  } catch {
    return { question: null };
  }
}

export async function createQuestion(
  roomId: string,
  text: string,
  options: string[],
  correctIndex: number,
  durationSeconds: number = 20
) {
  const supabase = createAdminClient();

  // Verificar cuántas preguntas ya existen
  const { data: existingQuestions } = await supabase
    .from("questions")
    .select("id")
    .eq("room_id", roomId);

  if (existingQuestions && existingQuestions.length >= 15) {
    return { error: "Maximum of 15 questions reached" };
  }

  const { data: question, error } = await supabase
    .from("questions")
    .insert({
      room_id: roomId,
      text,
      options,
      correct_index: correctIndex,
      duration_seconds: durationSeconds,
      published: false,
    })
    .select()
    .single();

  if (error) {
    return { error: "Failed to create question" };
  }

  return { success: true, question };
}

export async function submitAnswer(
  questionId: string,
  userId: string,
  optionIndex: number
) {
  const supabase = createAdminClient();

  const { error } = await supabase.from("answers").insert({
    question_id: questionId,
    user_id: userId,
    option_index: optionIndex,
  });

  if (error) {
    return { error: "Failed to submit answer" };
  }

  // Obtener room_id para revalidar
  const { data: question } = await supabase
    .from("questions")
    .select("room_id")
    .eq("id", questionId)
    .single();

  if (question) {
    updateTag(`quiz-results-${question.room_id}`);
  }

  return { success: true };
}

export async function getQuestions(roomId: string) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();

      const { data: questions, error } = await supabase
        .from("questions")
        .select(
          `
      id,
      text,
      options,
      correct_index,
      duration_seconds,
      created_at,
      answers (
        user_id,
        option_index,
        answered_at
      )
    `
        )
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (error) {
        return { error: "Failed to load questions" };
      }

      return { questions: questions || [] };
    },
    [`quiz-questions-${roomId}`],
    {
      tags: [`quiz-questions-${roomId}`],
      revalidate: 5,
    }
  )();
}

export async function finishQuiz(roomId: string) {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("rooms")
    .update({ status: "finished" })
    .eq("id", roomId);

  if (error) {
    return { error: "Failed to finish quiz" };
  }

  // Revalidar cache de la sala
  updateTag(`room-${roomId}`);
  updateTag(`quiz-results-${roomId}`);

  return { success: true };
}

export async function getQuizResults(roomId: string) {
  return unstable_cache(
    async () => {
      const supabase = createAdminClient();

      // Obtener todas las preguntas
      const { data: questions, error: questionsError } = await supabase
        .from("questions")
        .select("id, text, correct_index, duration_seconds, created_at")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });

      if (questionsError || !questions) {
        return { error: "Failed to load results" };
      }

      // Obtener todas las respuestas por separado
      const questionIds = questions.map((q) => q.id);
      const { data: answers } = await supabase
        .from("answers")
        .select("question_id, user_id, option_index, answered_at")
        .in("question_id", questionIds);

      // Obtener miembros
      const { data: roomMembers, error: membersError } = await supabase
        .from("room_members")
        .select("user_id")
        .eq("room_id", roomId);

      if (membersError || !roomMembers) {
        return { error: "Failed to load members" };
      }

      // Obtener nombres de usuarios
      const userIds = roomMembers.map((m) => m.user_id);
      const { data: users } = await supabase
        .from("users")
        .select("id, name")
        .in("id", userIds);

      // Calcular puntuaciones
      const scores = roomMembers.map((member) => {
        let correctAnswers = 0;

        questions.forEach((question) => {
          const userAnswer = answers?.find(
            (a) => a.user_id === member.user_id && a.question_id === question.id
          );

          if (
            userAnswer &&
            userAnswer.option_index === question.correct_index
          ) {
            correctAnswers++;
          }
        });

        const score = correctAnswers * 100; // 100 puntos por respuesta correcta
        const user = users?.find((u) => u.id === member.user_id);

        return {
          userId: member.user_id,
          userName: user?.name || "Unknown",
          correctAnswers,
          totalQuestions: questions.length,
          score,
        };
      });

      // Ordenar por puntuación
      scores.sort((a, b) => b.score - a.score);

      return { scores, questions };
    },
    [`quiz-results-${roomId}`],
    {
      tags: [`quiz-results-${roomId}`],
      revalidate: 10,
    }
  )();
}
