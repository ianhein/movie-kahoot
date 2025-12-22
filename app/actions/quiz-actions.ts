"use server";

import { createAdminClient } from "@/lib/supabase/admin";

export async function createQuestion(
  roomId: string,
  text: string,
  options: string[],
  correctIndex: number,
  durationSeconds: number = 20
) {
  const supabase = createAdminClient();

  const { data: question, error } = await supabase
    .from("questions")
    .insert({
      room_id: roomId,
      text,
      options,
      correct_index: correctIndex,
      duration_seconds: durationSeconds,
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

  return { success: true };
}

export async function getQuestions(roomId: string) {
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

  return { success: true };
}

export async function getQuizResults(roomId: string) {
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

      if (userAnswer && userAnswer.option_index === question.correct_index) {
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
}
