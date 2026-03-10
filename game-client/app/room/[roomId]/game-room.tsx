import { GameProvider } from "@/components/game-context";
import Board from "@/components/board";
import OfferPanel from "@/components/offer-panel";
import { GameState } from "@/hooks/state";
import { CardType, OfferCard } from "@/schemas/types";
import { useState } from "react";

type GameRoomProp = {
  roomId: string;
  playerId: string;
  gameState: GameState;
  cardsPerTurn?: number;
  cardLookup: Map<string, CardType>;
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
  cardsPerTurn,
  cardLookup: cardLookupFromConfig,
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

  // Build a name→CardType lookup.
  // Start from the config-sourced catalog so every card type always has images,
  // then overlay live cards (which carry real cardIds and up-to-date data).
  const { hand, pickedCards, centerCards, discardTopCard } = gameState;
  const cardLookup = new Map<string, CardType>(cardLookupFromConfig);
  for (const c of [...hand, ...pickedCards, ...centerCards]) {
    cardLookup.set(c.cardName, c);
  }
  if (discardTopCard) cardLookup.set(discardTopCard.cardName, discardTopCard);

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
    <GameProvider
      gameState={gameState}
      cardsPerTurn={cardsPerTurn}
      cardLookup={cardLookup}
      onPlantBean={handlePlantBean}
      onHarvestField={handleHarvestField}
      onTurnOverBean={handleTurnOverBean}
      onDrawCards={handleDrawCards}
    >
      <div className="flex flex-col h-full w-full overflow-hidden">
        <div className="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-30">
          {gameState.phase === "turnTrade" && (
            <button
              onClick={() => setOfferPanelOpen(true)}
              className="relative flex items-center justify-between gap-2 px-3 
						py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold
						rounded-xl shadow transition-colors"
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
          <Board />
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
    </GameProvider>
  );
}
