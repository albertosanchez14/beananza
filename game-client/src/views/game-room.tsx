import { useEffect, useRef, useState } from "react";
import { useAppRouter } from "@/lib/router";
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
  myAvatar?: string;
  gameError: GameError | null;
  clearGameError: () => void;
  isConnected: boolean;
} & GameRoomContext;

export default function GameRoom({
  roomId,
  playerId,
  myAvatar,
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
  const router = useAppRouter();
  const [transientToasts, setTransientToasts] = useState<ToastEntry[]>([]);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  function handleLeaveRoom() {
    sessionStorage.removeItem(`session_token:${roomId}`);
    router.push("/room");
  }

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
          <button
            onClick={() => setShowLeaveConfirm(true)}
            className="absolute top-3 left-3 z-30 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg font-semibold text-xs transition-all"
          >
            Leave
          </button>
          {showLeaveConfirm && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div
                className="overflow-hidden w-60 shadow-xl"
                style={{
                  backgroundImage: "url('/wanted-poster-bg.webp')",
                  backgroundSize: "100% 100%",
                }}
              >
                <div className="px-6 pt-8 pb-6 flex flex-col items-center gap-5">
                  <p
                    className="font-black tracking-widest uppercase text-center"
                    style={{ color: "#5c3a1e", fontSize: "1rem" }}
                  >
                    Leave the game?
                  </p>
                  <p
                    className="text-xs text-center font-semibold"
                    style={{ color: "#7a4f2e" }}
                  >
                    You will be disconnected.
                  </p>
                  <div className="flex gap-3 w-full">
                    <button
                      onClick={() => setShowLeaveConfirm(false)}
                      className="flex-1 py-2 bg-transparent hover:bg-amber-900/20 font-bold uppercase tracking-widest border-2 border-amber-800/60 transition-colors text-xs cursor-pointer"
                      style={{
                        color: "#5c3a1e",
                        textShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }}
                    >
                      Stay
                    </button>
                    <button
                      onClick={handleLeaveRoom}
                      className="flex-1 py-2 bg-red-800 hover:bg-red-700 active:bg-red-900 text-amber-100 font-bold uppercase tracking-widest border-2 border-red-600 transition-colors text-xs cursor-pointer"
                      style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
                    >
                      Leave
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
          <Board />
          {gameState.phase === "finished" && (
            <ResultsScreen
              lobbyResetAt={gameState.lobbyResetAt}
              players={(gameState.rankedPlayers ?? []).map((p) => ({
                playerId: p.playerId,
                playerName: p.playerName,
                playerAvatar:
                  p.playerId === playerId ? myAvatar : p.playerAvatar,
                coins: p.playerCoins,
                isMe: p.playerId === playerId,
              }))}
            />
          )}
        </div>
      </div>
    </GameProvider>
  );
}
