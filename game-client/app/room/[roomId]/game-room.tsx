import { useEffect } from "react";

import { GameRoomContext } from "@/hooks/useGameRoom";
import { GameProvider } from "@/components/game-context";
import Board from "@/components/board";

type GameRoomProps = { roomId: string; playerId: string } & GameRoomContext;

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
}: GameRoomProps) {
  // Suppress the browser context menu during trade so right-click opens our modal.
  useEffect(() => {
    if (gameState.phase !== "turnTrade") return;
    const handler = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, [gameState.phase]);

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
      <div className="flex flex-col h-full w-full overflow-hidden">
        <div className="flex-1 min-h-0">
          <Board />
        </div>
      </div>
    </GameProvider>
  );
}
