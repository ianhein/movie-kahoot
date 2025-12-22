import { Suspense } from "react";
import { RoomClient } from "@/components/room/room-client";
import { getRoomDetails } from "@/app/actions/movie-actions";
import { redirect } from "next/navigation";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await getRoomDetails(id);

  if (result.error || !result.room) {
    redirect("/");
  }

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RoomClient
        roomId={id}
        initialRoom={result.room}
        initialMembers={result.members}
      />
    </Suspense>
  );
}
