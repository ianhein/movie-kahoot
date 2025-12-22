"use server";

import { createClient } from "@/lib/supabase/server";

export async function createQuestion(
  roomId: string,
  text: string,
  options: string[],
  correctIndex: number,
  durationSeconds: number = 20
) {
  const supabase = await createClient();

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
  const supabase = await createClient();

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
  const supabase = await createClient();

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
  const supabase = await createClient();

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
  const supabase = await createClient();

  // Obtener todas las preguntas con respuestas
  const { data: questions, error: questionsError } = await supabase
    .from("questions")
    .select(
      `
      id,
      text,
      correct_index,
      duration_seconds,
      answers (
        user_id,
        option_index,
        answered_at
      )
    `
    )
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });

  if (questionsError || !questions) {
    return { error: "Failed to load results" };
  }

  // Obtener miembros
  const { data: members, error: membersError } = await supabase
    .from("room_members")
    .select(
      `
      user_id,
      users (
        id,
        name
      )
    `
    )
    .eq("room_id", roomId);

  if (membersError || !members) {
    return { error: "Failed to load members" };
  }

  // Calcular puntuaciones
  const scores = members.map((member) => {
    let correctAnswers = 0;
    let totalTime = 0;

    questions.forEach((question) => {
      const userAnswer = question.answers.find(
        (a: any) => a.user_id === member.user_id
      );

      if (userAnswer && userAnswer.option_index === question.correct_index) {
        correctAnswers++;
        // Calcular tiempo de respuesta para bonificación
        const answerTime = new Date(userAnswer.answered_at).getTime();
        const questionTime = new Date().getTime(); // Simplificado
        totalTime += Math.max(
          0,
          question.duration_seconds * 1000 - (answerTime - questionTime)
        );
      }
    });

    const score = correctAnswers * 100; // 100 puntos por respuesta correcta

    return {
      userId: member.user_id,
      userName: member.users?.name || "Unknown",
      correctAnswers,
      totalQuestions: questions.length,
      score,
    };
  });

  // Ordenar por puntuación
  scores.sort((a, b) => b.score - a.score);

  return { scores, questions };
}
