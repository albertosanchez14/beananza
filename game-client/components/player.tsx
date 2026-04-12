import { Coins, Leaf } from "lucide-react";
import { ReactNode } from "react";

type WaitingPlayerProps = {
  playerId: string;
  playerName: string;
  playerAvatar?: string;
  playerStatus: "waiting";
  playerReady: boolean;
  isMe?: boolean;
  field?: ReactNode;
};

type ActivePlayerProps = {
  playerId: string;
  playerName: string;
  playerAvatar?: string;
  playerStatus: "active";
  playerCoins?: number;
  playerPickedCardsCount?: number;
  isCurrentTurn?: boolean;
  gamePhase?: string;
  field?: ReactNode;
  hand?: ReactNode;
  isDragTarget?: boolean;
  dragBlockMessage?: string;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
};

type PlayerProps = WaitingPlayerProps | ActivePlayerProps;

export default function Player(props: PlayerProps) {
  if (props.playerStatus === "waiting") {
    return <WaitingPlayer {...props} />;
  }

  return <ActivePlayer {...props} />;
}

function WaitingPlayer({
  playerName,
  playerAvatar,
  playerReady = false,
  isMe = false,
}: WaitingPlayerProps) {
  // "Me" player: normal vertical layout
  return (
    <div className="flex flex-col items-center gap-0.5 transition-all duration-200">
      <div
        style={{
          filter: playerReady
            ? "drop-shadow(0 0 8px #4ade80) drop-shadow(0 0 3px #4ade80)"
            : "drop-shadow(0 0 6px #9ca3af) drop-shadow(0 0 2px #9ca3af)",
          transition: "filter 0.3s ease",
        }}
      >
        {playerAvatar && (
          <img
            src={playerAvatar}
            alt={playerName}
            style={{
              width: 110,
              height: 110,
              maxWidth: "none",
              borderRadius: "50%",
              objectFit: "contain",
            }}
          />
        )}
      </div>

      <p
        className="text-[10px] font-bold text-white leading-tight max-w-[72px] text-center truncate"
        style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}
      >
        {playerName}
        {isMe && (
          <span className="ml-0.5 text-blue-300 font-normal">(you)</span>
        )}
      </p>

      <span
        className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${
          playerReady
            ? "bg-green-500/80 text-white"
            : "bg-gray-700/80 text-gray-300"
        }`}
      >
        {playerReady ? "Ready" : "Waiting"}
      </span>
    </div>
  );
}

function ActivePlayer({
  playerName,
  playerAvatar,
  playerCoins,
  playerPickedCardsCount,
  isCurrentTurn = false,
  gamePhase,
  field,
  hand,
  isDragTarget = false,
  dragBlockMessage,
  onDragOver,
  onDragLeave,
  onDrop,
}: ActivePlayerProps) {
  const showPickedCards =
    gamePhase === "plantTrade" && (playerPickedCardsCount ?? 0) > 0;

  return (
    <div
      className="flex flex-col items-center gap-0.5 transition-all duration-200"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="relative flex flex-col items-center">
        <div
          className="absolute left-1/2 flex flex-col items-center gap-0.5"
          style={{
            bottom: "100%",
            transform: "translateX(-50%)",
            paddingBottom: 2,
          }}
        >
          <p
            className="text-sm font-bold text-white leading-tight tracking-widest max-w-18 text-center truncate"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}
          >
            {playerName}
          </p>

          <div className="flex items-center gap-2">
            {playerCoins !== undefined && (
              <div className="flex items-center gap-1 text-sm text-gray-200">
                <Coins
                  size={9}
                  strokeWidth={2}
                  className="text-yellow-300 shrink-0"
                />
                <span
                  className="font-medium tabular-nums"
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
                >
                  {playerCoins}
                </span>
              </div>
            )}

            {showPickedCards && (
              <div className="flex items-center gap-1 text-[10px] text-emerald-300 font-semibold">
                <Leaf size={9} strokeWidth={2} className="shrink-0" />
                <span
                  className="tabular-nums"
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
                >
                  {playerPickedCardsCount}
                </span>
              </div>
            )}
          </div>
        </div>

        <div
          className="mb-6"
          style={
            isDragTarget
              ? {
                  filter: dragBlockMessage
                    ? "drop-shadow(0 0 8px #ef4444) drop-shadow(0 0 3px #ef4444)"
                    : "drop-shadow(0 0 8px #4ade80) drop-shadow(0 0 3px #4ade80)",
                  transition: "filter 0.15s",
                }
              : undefined
          }
        >
          {playerAvatar && (
            <img
              src={playerAvatar}
              alt={playerName}
              style={{
                width: 110,
                height: 110,
                maxWidth: "none",
                borderRadius: "50%",
                objectFit: "contain",
                filter: isCurrentTurn
                  ? "drop-shadow(0 0 7px #facc15) drop-shadow(0 0 3px #facc15)"
                  : undefined,
                transition: "filter 0.3s ease",
              }}
            />
          )}
        </div>

        {dragBlockMessage && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1 z-50 pointer-events-none">
            <span className="whitespace-nowrap rounded bg-red-900/90 px-2 py-1 text-[10px] text-red-200 shadow">
              {dragBlockMessage}
            </span>
          </div>
        )}

        {hand && (
          <div
            className="absolute left-1/2"
            style={{ bottom: -6, transform: "translateX(-50%)", zIndex: 10 }}
          >
            {hand}
          </div>
        )}
      </div>

      {field && <div style={{ marginTop: 18 }}>{field}</div>}
    </div>
  );
}
