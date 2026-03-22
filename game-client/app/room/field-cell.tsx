type Room = {
  id: string;
  player_count: number;
  max_players: number;
  session_state: "waiting" | "playing" | "pause";
};

export default function FieldCell({
  room,
  onJoin,
  onCreate,
}: {
  room: Room | null;
  onJoin: (id: string) => void;
  onCreate?: () => void;
}) {
  if (!room) {
    const interactive = !!onCreate;
    return (
      <div
        onClick={interactive ? onCreate : undefined}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        onKeyDown={interactive ? (e) => { if (e.key === "Enter" || e.key === " ") onCreate?.(); } : undefined}
        className={`w-full h-full rounded flex flex-col items-center justify-center gap-1 transition-all border-2 border-dashed border-[rgba(185,148,90,0.35)] bg-[rgba(210,175,110,0.05)] [box-shadow:inset_0_2px_8px_rgba(0,0,0,0.10)] ${interactive ? "group cursor-pointer hover:border-[rgba(210,170,90,0.65)] hover:bg-[rgba(200,160,80,0.13)] hover:[box-shadow:inset_0_2px_8px_rgba(0,0,0,0.10),0_0_10px_2px_rgba(255,255,255,0.08)]" : "opacity-40 cursor-not-allowed"}`}
      >
        {interactive && (
          <span className="hidden group-hover:block font-semibold text-amber-200 text-[clamp(0.5rem,1vw,0.75rem)]">
            + Create
          </span>
        )}
      </div>
    );
  }

  const isActive =
    room.session_state === "playing" || room.session_state === "pause";
  const isFull = room.player_count >= room.max_players;
  const canJoin = room.session_state === "waiting" && !isFull;

  if (isActive) {
    return (
      <div
        className="w-full h-full rounded flex flex-col items-center justify-center gap-0.5 border-2 border-[#b84010] bg-[rgba(80,18,5,0.68)] shadow-[0_0_12px_2px_rgba(184,64,16,0.55)]"
      >
        <span className="font-bold uppercase text-orange-200 text-[clamp(0.45rem,0.9vw,0.7rem)] tracking-widest">
          In Progress
        </span>
        <span className="font-mono text-orange-200 text-[clamp(0.45rem,0.9vw,0.7rem)]">
          {room.id}
        </span>
        <span className="text-orange-200 text-[clamp(0.45rem,0.8vw,0.65rem)]">
          {room.player_count}/{room.max_players}
        </span>
        <button
          disabled
          className="mt-0.5 px-2 py-0.5 rounded font-semibold text-orange-300 border border-orange-700 cursor-not-allowed opacity-60 text-[clamp(0.45rem,0.8vw,0.65rem)]"
        >
          Watch
        </button>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full rounded flex flex-col items-center justify-center gap-0.5 border-2 border-[#d4903a] bg-[rgba(65,32,5,0.62)] shadow-[0_0_14px_3px_rgba(212,144,58,0.55)]"
    >
      <span className="font-bold uppercase text-amber-200 text-[clamp(0.45rem,0.9vw,0.7rem)] tracking-widest">
        Waiting
      </span>
      <span className="font-mono text-amber-200 text-[clamp(0.45rem,0.9vw,0.7rem)]">
        {room.id}
      </span>
      <span className="text-amber-200 text-[clamp(0.45rem,0.8vw,0.65rem)]">
        {room.player_count}/{room.max_players}
      </span>
      <button
        onClick={() => onJoin(room.id)}
        disabled={!canJoin}
        className="mt-0.5 px-2 py-0.5 rounded font-bold text-stone-900 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-[clamp(0.45rem,0.8vw,0.65rem)]"
      >
        Join
      </button>
    </div>
  );
}
