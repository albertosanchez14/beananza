import { Coins, Leaf } from "lucide-react";
import Image from "next/image";
import { ReactNode, useEffect, useRef, useState } from "react";

import DisconnectCountdown from "@/components/disconnect-countdown";

type WaitingPlayerProps = {
  playerId: string;
  playerName: string;
  playerAvatar?: string;
  playerStatus: "waiting";
  playerReady: boolean;
  playerConnected?: boolean;
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
  playerConnected?: boolean;
  playerDisconnectDeadline?: string | null;
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
  playerConnected = true,
  isMe = false,
}: WaitingPlayerProps) {
  // "Me" player: normal vertical layout
  return (
    <div className="flex flex-col items-center gap-0.5 transition-all duration-200">
      <div
        className="relative"
        style={{
          opacity: playerConnected ? 1 : 0.4,
          transition: "opacity 0.3s ease",
        }}
      >
        <div
          style={{
            filter: playerReady
              ? "drop-shadow(0 0 8px #4ade80) drop-shadow(0 0 3px #4ade80)"
              : "drop-shadow(0 0 6px #9ca3af) drop-shadow(0 0 2px #9ca3af)",
            transition: "filter 0.3s ease",
          }}
        >
          {playerAvatar && (
            <Image
              src={playerAvatar}
              alt={playerName}
              width={110}
              height={110}
              style={{
                maxWidth: "none",
                borderRadius: "50%",
                objectFit: "contain",
              }}
            />
          )}
        </div>
        {!isMe && (
          <span
            className="absolute bottom-1 right-1 block w-3 h-3 rounded-full border-2 border-black"
            style={{ background: playerConnected ? "#4ade80" : "#ef4444" }}
          />
        )}
      </div>

      <p
        className="text-[10px] font-bold text-white leading-tight max-w-18 text-center truncate"
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
  playerConnected = true,
  playerDisconnectDeadline,
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

  const prevConnectedRef = useRef(playerConnected);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    if (!prevConnectedRef.current && playerConnected) {
      const showId = setTimeout(() => setShowReconnected(true), 0);
      const hideId = setTimeout(() => setShowReconnected(false), 2000);
      prevConnectedRef.current = playerConnected;
      return () => {
        clearTimeout(showId);
        clearTimeout(hideId);
      };
    }
    prevConnectedRef.current = playerConnected;
  }, [playerConnected]);

  const avatarFilter = (() => {
    if (showReconnected)
      return "drop-shadow(0 0 10px #4ade80) drop-shadow(0 0 4px #4ade80)";
    if (isDragTarget)
      return dragBlockMessage
        ? "drop-shadow(0 0 8px #ef4444) drop-shadow(0 0 3px #ef4444)"
        : "drop-shadow(0 0 8px #4ade80) drop-shadow(0 0 3px #4ade80)";
    if (isCurrentTurn)
      return "drop-shadow(0 0 7px #facc15) drop-shadow(0 0 3px #facc15)";
    return undefined;
  })();

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
          {!playerConnected && (
            <div className="flex flex-col items-center">
              {playerDisconnectDeadline && (
                <span
                  className="text-2xl font-light text-red-200 leading-none"
                  style={{ letterSpacing: "0.1em" }}
                >
                  <DisconnectCountdown deadline={playerDisconnectDeadline} />
                </span>
              )}
              <span className="text-sm font-light text-red-300 leading-none whitespace-nowrap">
                Disconnected
              </span>
            </div>
          )}
          {showReconnected && (
            <span className="text-sm font-light text-green-300 leading-none whitespace-nowrap">
              Reconnected
            </span>
          )}

          <p className="text-sm font-bold text-white leading-tight tracking-widest max-w-18 text-center truncate">
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
          className="relative mb-6"
          style={{
            opacity: playerConnected ? 1 : 0.4,
            transition: "opacity 0.3s ease, filter 0.3s ease",
          }}
        >
          {playerAvatar && (
            <Image
              src={playerAvatar}
              alt={playerName}
              width={110}
              height={110}
              style={{
                maxWidth: "none",
                borderRadius: "50%",
                objectFit: "contain",
                filter: avatarFilter,
                transition: "filter 0.3s ease",
              }}
            />
          )}
          <span
            className="absolute bottom-1 right-1 block w-3 h-3 rounded-full border-2 border-black"
            style={{ background: playerConnected ? "#4ade80" : "#ef4444" }}
          />
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
