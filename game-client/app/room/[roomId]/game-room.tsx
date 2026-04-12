import { useEffect } from "react";

import { GameRoomContext } from "@/hooks/useGameRoom";
import { GameError } from "@/hooks/useRoomConnection";
import { GameProvider } from "@/components/game-context";
import Board from "@/components/board";

type GameRoomProps = {
  roomId: string;
  playerId: string;
  gameError: GameError | null;
  clearGameError: () => void;
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
}: GameRoomProps) {
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
        {gameError && (
          <div
            className="absolute top-10 left-1/2 -translate-x-1/2 z-50 
						rounded-md bg-red-600 px-4 py-2 text-sm text-white shadow-lg"
          >
            {gameError.message}
          </div>
        )}
        <div className="flex-1 min-h-0">
          <Board />
        </div>
      </div>
    </GameProvider>
  );
}
