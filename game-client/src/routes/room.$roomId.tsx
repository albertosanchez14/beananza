import { createFileRoute } from "@tanstack/react-router";
import RoomPage from "@/views/room-page";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

export const Route = createFileRoute("/room/$roomId")({
  component: RoomRoute,
});

function RoomRoute() {
  const { roomId } = Route.useParams();
  useDocumentTitle("Beananza - Game Room");
  return <RoomPage roomId={roomId} />;
}
