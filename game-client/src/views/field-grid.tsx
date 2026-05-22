import { useAppRouter } from "@/lib/router";
import { type Room } from "@/lib/getRooms";
import FieldCell from "./field-cell";

// TODO: Paginate and add to the server
const TOTAL_SLOTS = 15;
const ROOM_IDS = [
  "ROOM01",
  "ROOM02",
  "ROOM03",
  "ROOM04",
  "ROOM05",
  "ROOM06",
  "ROOM07",
  "ROOM08",
  "ROOM09",
  "ROOM10",
  "ROOM11",
  "ROOM12",
  "ROOM13",
  "ROOM14",
  "ROOM15",
];
const CELL_POSITIONS: { left: number; top: number; w: number; h: number }[] = [
  // row 0
  { left: 12, top: 37, w: 13, h: 13 },
  { left: 30, top: 37, w: 13, h: 13 },
  { left: 48.5, top: 37, w: 11.5, h: 13 },
  { left: 62.2, top: 37, w: 11, h: 13 },
  { left: 75, top: 37, w: 11, h: 13 },
  // row 1
  { left: 11.5, top: 54, w: 13, h: 14 },
  { left: 30, top: 54, w: 13, h: 14 },
  { left: 48.5, top: 54, w: 12, h: 14 },
  { left: 62.5, top: 54, w: 11, h: 14 },
  { left: 75.5, top: 54, w: 11, h: 14 },
  // row 2
  { left: 11.1, top: 72, w: 13.5, h: 15 },
  { left: 30, top: 72, w: 13.5, h: 15 },
  { left: 48.7, top: 72, w: 12, h: 15 },
  { left: 62.7, top: 72, w: 11, h: 15 },
  { left: 76, top: 72, w: 11, h: 15 },
];

export default function FieldGrid({
  rooms,
  error,
  loading,
}: {
  rooms: Room[];
  error: boolean;
  loading: boolean;
}) {
  const router = useAppRouter();

  const handleCreate = (slotIndex: number) => {
    router.push(`/room/${ROOM_IDS[slotIndex]}`);
  };

  const handleJoin = (roomId: string) => {
    router.push(`/room/${roomId}`);
  };

  const truncated = rooms.slice(0, TOTAL_SLOTS);
  const slots: (Room | null)[] = Array.from({ length: TOTAL_SLOTS }, (_, i) =>
    i < truncated.length ? truncated[i] : null,
  );

  return (
    <div>
      {error && (
        <div
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
					px-4 py-2 rounded bg-red-900/80 border border-red-500 text-red-200 
					text-sm font-semibold whitespace-nowrap [text-shadow:0_1px_3px_#000]"
        >
          Could not load rooms
        </div>
      )}
      {loading && (
        <div
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
          rounded bg-black/60 px-4 py-2 text-sm font-semibold whitespace-nowrap
          text-amber-100 [text-shadow:0_1px_3px_#000]"
        >
          Loading rooms...
        </div>
      )}
      {slots.map((room, i) => {
        const p = CELL_POSITIONS[i];
        return (
          <div
            key={ROOM_IDS[i]}
            style={{
              position: "absolute",
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.w}%`,
              height: `${p.h}%`,
            }}
          >
            <FieldCell
              room={room}
              onJoin={handleJoin}
              onCreate={error ? undefined : () => handleCreate(i)}
            />
          </div>
        );
      })}
    </div>
  );
}
