import { Suspense } from "react";
import { QuizClient } from "@/components/quiz/quiz-client";
import { getRoomDetails } from "@/app/actions/movie-actions";
import { redirect } from "next/navigation";

export default async function QuizPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getRoomDetails(id);

  if (result.error || !result.room) {
    redirect("/");
  }

  if (result.room.status !== "quiz" && result.room.status !== "finished") {
    redirect(`/room/${id}`);
  }

  return (
    <Suspense fallback={<div>Loading quiz...</div>}>
      <QuizClient
        roomId={id}
        initialRoom={result.room}
        initialMembers={result.members}
      />
    </Suspense>
  );
}
