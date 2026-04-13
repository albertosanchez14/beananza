import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";

import { ToastEntry } from "@/schemas/types";
import { GameRoomContext } from "@/hooks/useGameRoom";
import { GameError } from "@/hooks/useRoomConnection";

import { GameProvider } from "@/components/game-context";
import Board from "@/components/board";
import ResultsScreen from "@/components/results-screen";
import Toast from "@/components/toast";

type GameRoomProps = {
  roomId: string;
  playerId: string;
  gameError: GameError | null;
  clearGameError: () => void;
  isConnected: boolean;
} & GameRoomContext;

export default function GameRoom({
  playerId,
  gameState,
  cardsPerTurn,
  cardLookup,
  plantBean,
  harvestField,
  turnOverBean,
  drawCards,
  createOffer,
  counterOffer,
  respondOffer,
  gameError,
  clearGameError,
  isConnected,
}: GameRoomProps) {
  const [transientToasts, setTransientToasts] = useState<ToastEntry[]>([]);
  const toasts: ToastEntry[] = [
    ...(!isConnected
      ? [
          {
            id: "connection-lost",
            message: "Connection lost. Reconnecting…",
            type: "error" as const,
          },
        ]
      : []),
    ...transientToasts,
  ];

  const prevConnectedRef = useRef(isConnected);
  const handledErrorRef = useRef<GameError | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (gameState.phase !== "turnTrade") return;
    const handler = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, [gameState.phase]);

  useEffect(() => {
    if (isConnected && !prevConnectedRef.current) {
      const reconnectedId = `reconnected-${Date.now()}`;
      const showTimer = setTimeout(() => {
        setTransientToasts((prev) => [
          ...prev,
          {
            id: reconnectedId,
            message: "Reconnected!",
            type: "success" as const,
          },
        ]);
      }, 0);
      const hideTimer = setTimeout(() => {
        setTransientToasts((prev) =>
          prev[prev.length - 1]?.id === reconnectedId
            ? []
            : prev.filter((t) => t.id !== reconnectedId),
        );
      }, 2000);
      prevConnectedRef.current = true;
      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    }
    prevConnectedRef.current = isConnected;

    if (gameError && gameError !== handledErrorRef.current) {
      handledErrorRef.current = gameError;
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      const errorId = `error-${Date.now()}`;
      setTimeout(() => {
        setTransientToasts((prev) => [
          ...prev,
          { id: errorId, message: gameError.message, type: "error" as const },
        ]);
      }, 0);
      errorTimerRef.current = setTimeout(() => {
        setTransientToasts((prev) =>
          prev[prev.length - 1]?.id === errorId
            ? []
            : prev.filter((t) => t.id !== errorId),
        );
        clearGameError();
        errorTimerRef.current = null;
      }, 3000);
    } else if (!gameError) {
      handledErrorRef.current = null;
    }
  }, [isConnected, gameError, clearGameError]);

  return (
    <GameProvider
      gameState={gameState}
      cardsPerTurn={cardsPerTurn}
      cardLookup={cardLookup}
      myPlayerId={playerId}
      onPlantBean={(cardId, slotId) => plantBean(cardId, slotId)}
      onHarvestField={(slotId) => harvestField(slotId)}
      onTurnOverBean={() => turnOverBean()}
      onDrawCards={() => drawCards()}
      onCreateOffer={createOffer}
      onRespondOffer={respondOffer}
      onCounterOffer={counterOffer}
    >
      <div className="relative flex flex-col h-full w-full overflow-hidden">
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50 w-64 pointer-events-none"
          style={{ top: -10, aspectRatio: "5 / 3" }}
        >
          <AnimatePresence>
            {toasts.map((toast, i) => (
              <Toast
                key={toast.id}
                message={toast.message}
                type={toast.type}
                depth={toasts.length - 1 - i}
              />
            ))}
          </AnimatePresence>
        </div>
        <div className="relative flex-1 min-h-0">
          {!isConnected && (
            <div className="absolute inset-0 z-40 pointer-events-auto" />
          )}
          <Board />
          {gameState.phase === "finished" && (
            <ResultsScreen
              players={[
                {
                  playerId,
                  playerName: "You",
                  coins: gameState.coins,
                  isMe: true,
                },
                ...gameState.players.map((p) => ({
                  playerId: p.playerId,
                  playerName: p.playerName,
                  playerAvatar: p.playerAvatar,
                  coins: p.playerCoins,
                })),
              ]}
            />
          )}
        </div>
      </div>
    </GameProvider>
  );
}
