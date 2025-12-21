export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      rooms: {
        Row: {
          id: string
          code: string
          host_id: string | null
          status: 'voting' | 'quiz' | 'finished'
          created_at: string
        }
        Insert: {
          id?: string
          code: string
          host_id?: string | null
          status?: 'voting' | 'quiz' | 'finished'
          created_at?: string
        }
        Update: {
          id?: string
          code?: string
          host_id?: string | null
          status?: 'voting' | 'quiz' | 'finished'
          created_at?: string
        }
      }
      room_members: {
        Row: {
          room_id: string
          user_id: string
          joined_at: string
        }
        Insert: {
          room_id: string
          user_id: string
          joined_at?: string
        }
        Update: {
          room_id?: string
          user_id?: string
          joined_at?: string
        }
      }
      movies: {
        Row: {
          id: string
          title: string
          year: number | null
          poster_url: string | null
          overview: string | null
        }
        Insert: {
          id: string
          title: string
          year?: number | null
          poster_url?: string | null
          overview?: string | null
        }
        Update: {
          id?: string
          title?: string
          year?: number | null
          poster_url?: string | null
          overview?: string | null
        }
      }
      room_movies: {
        Row: {
          id: string
          room_id: string
          movie_id: string
          proposed_by: string | null
          accepted: boolean | null
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          movie_id: string
          proposed_by?: string | null
          accepted?: boolean | null
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          movie_id?: string
          proposed_by?: string | null
          accepted?: boolean | null
          created_at?: string
        }
      }
      movie_votes: {
        Row: {
          room_movie_id: string
          user_id: string
          vote: boolean
          voted_at: string
        }
        Insert: {
          room_movie_id: string
          user_id: string
          vote: boolean
          voted_at?: string
        }
        Update: {
          room_movie_id?: string
          user_id?: string
          vote?: boolean
          voted_at?: string
        }
      }
      questions: {
        Row: {
          id: string
          room_id: string
          text: string
          options: string[]
          correct_index: number
          duration_seconds: number
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          text: string
          options: string[]
          correct_index: number
          duration_seconds?: number
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          text?: string
          options?: string[]
          correct_index?: number
          duration_seconds?: number
          created_at?: string
        }
      }
      answers: {
        Row: {
          question_id: string
          user_id: string
          option_index: number
          answered_at: string
        }
        Insert: {
          question_id: string
          user_id: string
          option_index: number
          answered_at?: string
        }
        Update: {
          question_id?: string
          user_id?: string
          option_index?: number
          answered_at?: string
        }
      }
    }
  }
}
