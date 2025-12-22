import { Database } from "@/lib/supabase/database.types";

// Room types
export type Room = Database["public"]["Tables"]["rooms"]["Row"];

// Member types
export type Member = {
  user_id: string;
  joined_at: string | null;
  users: {
    id: string;
    name: string;
  };
};

export type QuizMember = {
  user_id: string;
  users: { name: string } | null;
};
