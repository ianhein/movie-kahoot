import { GoogleGenerativeAI } from "@google/generative-ai";
import { Question } from "./types";

const apiKey = process.env.GEMINI_API_KEY!;
const genAI = new GoogleGenerativeAI(apiKey);

export type GeneratedQuestion = Omit<Question, "id" | "room_id" | "created_at" | "published" | "question_order">;

export async function generateMovieQuestions(
  movieTitle: string,
  count: number = 5,
  locale: string = "en",
  existingQuestions: string[] = []
): Promise<GeneratedQuestion[]> {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set");
  }

  const model = genAI.getGenerativeModel({
    model: "gemini-flash-latest",
    generationConfig: {
      responseMimeType: "application/json",
    },
  });

  const prompt = `
    Generate ${count} trivia questions about the movie "${movieTitle}".
    
    The response must be a JSON array of objects with this structure:
    {
      "text": "The question text",
      "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
      "correct_index": 0, // The index (0-3) of the correct option
      "duration_seconds": 20
    }

    Requirements:
    - Language: ${locale}
    - Difficulty: Mixed (Easy to Medium)
    - options: EXACTLY 4 options per question.
    - correct_index: MUST be a number between 0 and 3.
    - The correct answer must vary in position (don't always make it index 0).
    
    ${existingQuestions.length > 0 ? `
    IMPORTANT: Do NOT generate questions that are similar or identical to the following existing questions:
    ${existingQuestions.map(q => `- ${q}`).join("\n")}
    ` : ""}
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const questions = JSON.parse(text) as GeneratedQuestion[];
    
    // Validate extra safety
    return questions.map(q => ({
      ...q,
      duration_seconds: q.duration_seconds || 20,
      options: q.options.slice(0, 4), // Ensure max 4
      correct_index: Math.min(Math.max(q.correct_index, 0), 3) // Ensure 0-3
    }));
  } catch (error) {
    console.error("Error generating questions:", error);
    return [];
  }
}
