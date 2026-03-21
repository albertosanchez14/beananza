import { Suspense } from "react";
import { getRooms, type Room } from "@/lib/getRooms";
import FieldGrid from "./field-grid";
import Link from "next/link";

const IMG_W = 1843;
const IMG_H = 1228;

export default function Page() {
  const roomsPromise = getRooms()
    .then((rooms) => ({ rooms, error: false }))
    .catch(() => ({ rooms: [] as Room[], error: true }));

  return (
    <div className="fixed inset-0 overflow-x-auto overflow-y-hidden z-1 flex items-end">
      <div
        className="relative shrink-0 "
        style={{
          width: `max(100%, calc(100vh * ${IMG_W / IMG_H}))`,
          aspectRatio: IMG_W / IMG_H,
        }}
      >
        <img src="/fields/field6.jpeg" alt="" className="block w-full h-full" />

        <div className="fixed top-0 left-0 right-0 flex items-center justify-center px-4 py-3">
          <Link
            href="/"
            className="absolute left-4 text-amber-200 font-bold text-sm uppercase 
						tracking-widest hover:text-amber-100 transition-colors [text-shadow:0_1px_4px_#000]"
          >
            ← Back
          </Link>
          <span className="text-xl font-bold uppercase text-amber-200 tracking-[0.2em] [text-shadow:0_1px_4px_#000]">
            Lobby
          </span>
        </div>

        <Suspense fallback={null}>
          <FieldGrid roomsPromise={roomsPromise} />
        </Suspense>
      </div>
    </div>
  );
}
