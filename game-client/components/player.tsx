import { ExternalPlayer } from "@/schemas/types";
import Field from "@/components/field";

type PlayerProps = {
  player: ExternalPlayer;
  onClick?: (playerId: string) => void;
  isClickable?: boolean;
  isCurrentTurn?: boolean;
  gamePhase?: string;
};

export default function Player({
  player,
  onClick,
  isClickable = false,
  isCurrentTurn = false,
  gamePhase,
}: PlayerProps) {
  const handleClick = () => {
    if (isClickable && onClick) {
      onClick(player.playerId);
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`flex flex-col items-center gap-2 transition-all duration-200
        ${isClickable ? "cursor-pointer hover:ring-4 hover:ring-blue-400 rounded-lg" : ""}
        ${isCurrentTurn ? "ring-4 ring-yellow-400 rounded-lg" : ""}
      `}
    >
      {/* Player Info Card */}
      <div className="bg-gray-200 dark:bg-gray-800 rounded-lg px-3 py-2 min-w-[160px]">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-sm font-semibold truncate">{player.playerName}</p>
          {isCurrentTurn && <span className="text-xs">🎯</span>}
        </div>

        <div className="flex items-center justify-between gap-3 text-xs text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <span>🃏</span>
            <span>{player.playerHandSize}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>💰</span>
            <span>{player.playerCoins}</span>
          </div>
          {gamePhase === "plantTrade" && (player.playerPickedCardsCount ?? 0) > 0 && (
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-semibold">
              <span>🌱</span>
              <span>{player.playerPickedCardsCount}</span>
            </div>
          )}
        </div>

        {/* Status indicator */}
        {player.playerStatus !== "active" && (
          <div className="mt-1">
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-300 dark:bg-gray-600">
              {player.playerStatus}
            </span>
          </div>
        )}
      </div>

      {/* Player Field - Compact version */}
      <div className="scale-75 origin-top">
        <Field field={player.playerField} highlightEmpty={false} />
      </div>
    </div>
  );
}
