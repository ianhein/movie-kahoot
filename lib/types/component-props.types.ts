// Component props types
import type { Room, Member } from "./database.types";

// Room components
export interface RoomClientProps {
  roomId: string;
  initialRoom: Room;
  initialMembers: Member[];
}

export interface ProposedMoviesProps {
  roomId: string;
  userId: string;
  isHost: boolean;
  totalMembers: number;
}

export interface MovieSearchProps {
  roomId: string;
  userId: string;
  isHost: boolean;
  onMovieProposed?: () => void;
}

// Quiz components
export interface QuizClientProps {
  roomId: string;
  initialRoom: Room;
  initialMembers: Member[];
}

export interface QuizPlayerProps {
  roomId: string;
  room: Room;
  userId: string;
  userName: string | null;
}

export interface QuizHostProps {
  roomId: string;
  room: Room;
  members: Array<{
    user_id: string;
    users: { name: string } | null;
  }>;
  userId: string;
  userName: string | null;
}

export interface QuizResultsProps {
  roomId: string;
  members: Member[];
}

// Movie components
export interface MovieDetailsDialogProps {
  movieId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
