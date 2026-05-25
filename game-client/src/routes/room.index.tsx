import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AppImage as Image } from "@/components/app-image";
import { getRooms } from "@/lib/getRooms";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import FieldGrid from "@/views/field-grid";

const IMG_W = 1843;
const IMG_H = 1228;

export const Route = createFileRoute("/room/")({
  component: RoomIndexRoute,
});

function RoomIndexRoute() {
  useDocumentTitle("Beananza - Rooms");

  const roomsQuery = useQuery({
    queryKey: ["rooms"],
    queryFn: getRooms,
    refetchInterval: 5_000,
  });

  return (
    <div
      className="fixed inset-x-0 top-0 z-1 flex items-end overflow-x-auto overflow-y-hidden"
      style={{ height: "100dvh" }}
    >
      <div
        className="relative shrink-0"
        style={{
          width: `max(100%, calc(100dvh * ${IMG_W / IMG_H}))`,
          aspectRatio: IMG_W / IMG_H,
        }}
      >
        <Image
          src="/fields/field6.jpeg"
          alt=""
          fill
          sizes="100vw"
          style={{ objectFit: "cover" }}
          priority
        />

        <div className="fixed top-0 right-0 left-0 flex items-center justify-center px-4 py-3">
          <Link
            to="/"
            className="absolute left-4 text-sm font-bold tracking-widest text-amber-200 uppercase transition-colors [text-shadow:0_1px_4px_#000] hover:text-amber-100"
          >
            Back
          </Link>
          <span className="text-xl font-bold tracking-[0.2em] text-amber-200 uppercase [text-shadow:0_1px_4px_#000]">
            Lobby
          </span>
        </div>

        <FieldGrid
          rooms={roomsQuery.data ?? []}
          error={roomsQuery.isError}
          loading={roomsQuery.isPending}
        />
      </div>
    </div>
  );
}
