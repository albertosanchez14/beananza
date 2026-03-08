import Board from "@/components/board";
import OfferPanel from "@/components/offer-panel";
import { GameState } from "@/hooks/state";
import { OfferCard } from "@/schemas/types";
import { useState } from "react";

type GameRoomProp = {
  roomId: string;
  playerId: string;
  gameState: GameState;
  plantBean: (
    roomId: string,
    playerId: string,
    cardId: string,
    slotId: string,
  ) => boolean;
  harvestField: (roomId: string, playerId: string, slotId: string) => boolean;
  turnOverBean: (roomId: string) => boolean;
  drawCards: (roomId: string) => boolean;
  createOffer: (
    roomId: string,
    cardsOffered: OfferCard[],
    cardsRequested: OfferCard[],
    targetPlayerId?: string,
  ) => boolean;
  counterOffer: (
    roomId: string,
    parentOfferId: string,
    cardsOffered: OfferCard[],
    cardsRequested: OfferCard[],
  ) => boolean;
  respondOffer: (
    roomId: string,
    offerId: string,
    action: "accept" | "reject" | "cancel",
  ) => boolean;
};

export default function GameRoom({
  roomId,
  playerId,
  gameState,
  plantBean,
  harvestField,
  turnOverBean,
  drawCards,
  createOffer,
  counterOffer,
  respondOffer,
}: GameRoomProp) {
  const [offerPanelOpen, setOfferPanelOpen] = useState(false);
  const [prevPhase, setPrevPhase] = useState<string>(gameState.phase);

  if (gameState.phase !== prevPhase) {
    setPrevPhase(gameState.phase);
    if (gameState.phase === "turnTrade" && prevPhase !== "turnTrade") {
      const hasPendingIncoming = gameState.offers.some(
        (o) =>
          o.status === "pending" &&
          o.creator_id !== playerId &&
          (o.target_id === "" || o.target_id === playerId),
      );
      if (hasPendingIncoming) setOfferPanelOpen(true);
    }
  }
  const pendingIncomingCount = gameState.offers.filter(
    (o) =>
      o.status === "pending" &&
      o.creator_id !== playerId &&
      (o.target_id === "" || o.target_id === playerId),
  ).length;

  const handlePlantBean = (cardId: string, slotId: string) => {
    plantBean(roomId, playerId, cardId, slotId);
  };

  const handleHarvestField = (slotId: string) => {
    harvestField(roomId, playerId, slotId);
  };

  const handleTurnOverBean = () => {
    turnOverBean(roomId);
  };

  const handleDrawCards = () => {
    drawCards(roomId);
  };

  const handleCreateOffer = (
    cardsOffered: OfferCard[],
    cardsRequested: OfferCard[],
    targetPlayerId?: string,
  ) => {
    createOffer(roomId, cardsOffered, cardsRequested, targetPlayerId);
  };

  const handleCounterOffer = (
    parentOfferId: string,
    cardsOffered: OfferCard[],
    cardsRequested: OfferCard[],
  ) => {
    counterOffer(roomId, parentOfferId, cardsOffered, cardsRequested);
  };

  const handleRespondOffer = (
    offerId: string,
    action: "accept" | "reject" | "cancel",
  ) => {
    respondOffer(roomId, offerId, action);
  };

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div className="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-30">
        <div
          className="flex flex-col gap-1 bg-white dark:bg-gray-900 border border-gray-200
                dark:border-gray-700 rounded-xl px-3 py-3 shadow text-xs text-gray-600 dark:text-gray-400 min-w-30"
        >
          <span className="font-semibold text-gray-800 dark:text-gray-200 truncate">
            {playerId}
          </span>
          <span>
            Turn:{" "}
            <span
              className={
                gameState.playerTurn === playerId
                  ? "text-green-600 dark:text-green-400 font-semibold"
                  : ""
              }
            >
              {gameState.playerTurn === playerId
                ? "yours"
                : gameState.playerTurn}
            </span>
          </span>
          <span>
            Phase:{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {gameState.phase}
            </span>
          </span>
        </div>

        {gameState.phase === "turnTrade" && (
          <button
            onClick={() => setOfferPanelOpen(true)}
            className="relative flex items-center justify-between gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow transition-colors"
          >
            <span>Trade Offers</span>
            {pendingIncomingCount > 0 && (
              <span className="px-1.5 py-0.5 bg-red-500 text-white text-xs rounded-full leading-none">
                {pendingIncomingCount}
              </span>
            )}
          </button>
        )}
      </div>

      <div className="flex-1 min-h-0">
        <Board
          myHand={gameState.hand}
          myPickedCards={gameState.pickedCards}
          myField={gameState.field}
          players={gameState.players}
          centerCards={gameState.centerCards}
          deckSize={gameState.deckSize}
          discardPileSize={gameState.discardPileSize}
          discardTopCard={gameState.discardTopCard}
          currentTurnPlayerId={gameState.playerTurn}
          gamePhase={gameState.phase}
          cardsPerTurn={gameState.cardsPerTurn}
          onPlantBean={handlePlantBean}
          onHarvestField={handleHarvestField}
          onTurnOverBean={handleTurnOverBean}
          onDrawCards={handleDrawCards}
        />
      </div>

      <OfferPanel
        isOpen={offerPanelOpen}
        onClose={() => setOfferPanelOpen(false)}
        offers={gameState.offers}
        myHand={gameState.hand}
        centerCards={gameState.centerCards}
        myPlayerId={playerId}
        players={gameState.players}
        gamePhase={gameState.phase}
        onCreateOffer={handleCreateOffer}
        onCounterOffer={handleCounterOffer}
        onRespondOffer={handleRespondOffer}
      />
    </div>
  );
}
