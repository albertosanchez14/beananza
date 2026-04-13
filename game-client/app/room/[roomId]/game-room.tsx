import { useEffect, useRef, useState } from "react";

import { GameRoomContext } from "@/hooks/useGameRoom";
import { GameError } from "@/hooks/useRoomConnection";
import { GameProvider } from "@/components/game-context";
import Board from "@/components/board";
import ResultsScreen from "@/components/results-screen";

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
  const [showReconnected, setShowReconnected] = useState(false);
  const prevConnectedRef = useRef(isConnected);

  useEffect(() => {
    if (gameState.phase !== "turnTrade") return;
    const handler = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, [gameState.phase]);

  useEffect(() => {
    if (!gameError) return;
    const timer = setTimeout(clearGameError, 3000);
    return () => clearTimeout(timer);
  }, [gameError, clearGameError]);

  useEffect(() => {
    if (!prevConnectedRef.current && isConnected) {
      prevConnectedRef.current = true;
      const showTimer = setTimeout(() => setShowReconnected(true), 0);
      const hideTimer = setTimeout(() => setShowReconnected(false), 2000);
      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
      };
    }
    prevConnectedRef.current = isConnected;
  }, [isConnected]);

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
        {!isConnected && (
          <div
            className="absolute top-10 left-1/2 -translate-x-1/2 z-50 
						rounded-md bg-red-600 px-4 py-2 
						text-sm font-light text-white"
          >
            Connection lost. Reconnecting…
          </div>
        )}
        {showReconnected && (
          <div
            className="absolute top-10 left-1/2 -translate-x-1/2 z-50 
						rounded-md bg-green-600 px-4 py-2 
						text-sm text-white"
          >
            Reconnected
          </div>
        )}
        {gameError && (
          <div
            className="absolute top-10 left-1/2 -translate-x-1/2 z-50
						rounded-md bg-red-600 px-4 py-2 
						text-sm text-white"
          >
            {gameError.message}
          </div>
        )}
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
