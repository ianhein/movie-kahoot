"use server";

import { generateMovieQuestions } from "@/lib/gemini";
import { getWinningMovie } from "./room-actions";

export async function generateQuestionsAction(
  roomId: string, 
  movieTitle?: string, 
  count: number = 5, 
  locale: string = "en",
  existingQuestions: string[] = []
) {
  try {
    let targetMovie = movieTitle;

    // If no movie provided, try to find the room's winning movie
    if (!targetMovie) {
      const { movie } = await getWinningMovie(roomId);
      if (movie) {
        targetMovie = movie.title;
      }
    }

    if (!targetMovie) {
      return { error: "No movie selected for this room. Please provide a topic or vote for a movie first." };
    }

    const questions = await generateMovieQuestions(targetMovie, count, locale, existingQuestions);
    
    if (!questions || questions.length === 0) {
      return { error: "Failed to generate questions. Please try again." };
    }

    return { 
      success: true, 
      questions,
      source: targetMovie
    };
  } catch (error) {
    console.error("Generate action error:", error);
    return { error: "Failed to generate questions" };
  }
}
