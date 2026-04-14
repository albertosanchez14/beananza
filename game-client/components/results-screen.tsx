import { ExternalPlayer } from "@/schemas/types";

type ResultsPlayer = {
  playerId: string;
  playerName: string;
  playerAvatar?: string;
  coins: number;
  isMe?: boolean;
};

type ResultsScreenProps = {
  players: ResultsPlayer[];
};

export default function ResultsScreen({ players }: ResultsScreenProps) {
  const sorted = [...players].sort((a, b) => b.coins - a.coins);
  const winner = sorted[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="flex flex-col items-center gap-6 rounded-2xl bg-gray-900/95 px-10 py-8 shadow-2xl min-w-[320px]">
        <h1 className="text-2xl font-bold text-yellow-300 tracking-wide">
          Game Over
        </h1>

        {winner && (
          <p className="text-base text-white">
            <span className="font-semibold text-yellow-200">{winner.playerName}</span>{" "}
            wins with{" "}
            <span className="font-semibold text-yellow-200">{winner.coins}</span>{" "}
            coins!
          </p>
        )}

        <div className="w-full flex flex-col gap-2">
          {sorted.map((p, i) => (
            <div
              key={p.playerId}
              className="flex items-center justify-between gap-4 rounded-lg bg-gray-800 px-4 py-2"
            >
              <span className="text-gray-400 font-bold w-5 text-right">
                {i + 1}.
              </span>
              {p.playerAvatar && (
                <img
                  src={p.playerAvatar}
                  alt={p.playerName}
                  className="w-8 h-8 rounded-full object-contain"
                />
              )}
              <span className="flex-1 text-sm font-medium text-white truncate">
                {p.playerName}
                {p.isMe && (
                  <span className="ml-1 text-blue-300 font-normal text-xs">
                    (you)
                  </span>
                )}
              </span>
              <span className="text-yellow-300 font-semibold tabular-nums">
                {p.coins}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
