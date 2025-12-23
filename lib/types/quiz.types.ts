// Quiz types
export type Question = {
  id: string;
  text: string;
  options: string[];
  correct_index: number;
  duration_seconds: number;
  published?: boolean;
  question_order?: number;
  created_at?: string;
};

export type Answer = {
  user_id: string;
  user_name: string;
  option_index: number;
  is_correct: boolean;
  answered_at: string | null;
};

export type PlayerScore = {
  userId: string;
  userName: string;
  correctAnswers: number;
  totalQuestions: number;
  score: number;
};
