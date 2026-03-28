import { GameProvider } from "@/components/game-context";
import Board from "@/components/board";
import OfferPanel from "@/components/offer-panel";
import GiveCardsModal from "@/components/give-cards-modal";
import RequestCardsModal from "@/components/request-cards-modal";
import { GameRoomContext } from "@/hooks/useGameRoom";
import { CardType, ExternalPlayer, OfferCard } from "@/schemas/types";
import { useState, useEffect } from "react";

type GameRoomProps = { roomId: string; playerId: string } & GameRoomContext;

export default function GameRoom({
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
}: GameRoomProps) {
  const [offerPanelOpen, setOfferPanelOpen] = useState(false);
  const [prevPhase, setPrevPhase] = useState<string>(gameState.phase);
  const [giveModal, setGiveModal] = useState<{
    player: ExternalPlayer;
    cardsToGive: CardType[];
  } | null>(null);
  const [requestModal, setRequestModal] = useState<{
    cardsRequested: CardType[];
  } | null>(null);
  const [rightClickModal, setRightClickModal] = useState<{
    cardRequested: CardType;
    targetPlayerId: string | undefined;
  } | null>(null);

  // Suppress the browser context menu during trade so right-click opens our modal.
  useEffect(() => {
    if (gameState.phase !== "turnTrade") return;
    const handler = (e: MouseEvent) => e.preventDefault();
    document.addEventListener("contextmenu", handler);
    return () => document.removeEventListener("contextmenu", handler);
  }, [gameState.phase]);

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

  const handleCreateOffer = (
    cardsOffered: OfferCard[],
    cardsRequested: OfferCard[],
    targetPlayerId?: string,
  ) => {
    createOffer(cardsOffered, cardsRequested, targetPlayerId);
  };

  const handleCounterOffer = (
    parentOfferId: string,
    cardsOffered: OfferCard[],
    cardsRequested: OfferCard[],
  ) => {
    counterOffer(parentOfferId, cardsOffered, cardsRequested);
  };

  const handleRespondOffer = (
    offerId: string,
    action: "accept" | "reject" | "cancel",
  ) => {
    respondOffer(offerId, action);
  };

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
      onGiveDrop={(player, cardsToGive) =>
        setGiveModal({ player, cardsToGive })
      }
      onRequestDrop={(cardsRequested) => setRequestModal({ cardsRequested })}
      onCardRightClick={(card, targetPlayerId) =>
        setRightClickModal({ cardRequested: card, targetPlayerId })
      }
      onRespondOffer={handleRespondOffer}
      onCounterOffer={handleCounterOffer}
    >
      <div className="flex flex-col h-full w-full overflow-hidden">
        <div className="fixed left-4 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-30">
          {gameState.phase === "turnTrade" && (
            <button
              onClick={() => setOfferPanelOpen(true)}
              className={`relative flex items-center justify-between gap-2 px-3
						py-2 bg-amber-700 hover:bg-amber-600 text-white text-xs font-semibold
						rounded-xl border border-amber-800 shadow transition-colors
						${pendingIncomingCount > 0 ? "animate-pulse [box-shadow:0_0_12px_3px_rgba(234,179,8,0.30)]" : ""}`}
            >
              <span>Trade Offers</span>
              {pendingIncomingCount > 0 && (
                <span className="px-1.5 py-0.5 bg-orange-600 text-white text-xs rounded-full leading-none">
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
          playerTurn={gameState.playerTurn}
          onCreateOffer={handleCreateOffer}
          onCounterOffer={handleCounterOffer}
          onRespondOffer={handleRespondOffer}
        />

        {requestModal && (
          <RequestCardsModal
            cardsRequested={requestModal.cardsRequested}
            myHand={gameState.hand}
            onSubmit={(cardsOffered) => {
              const isTurnPlayer = playerId === gameState.playerTurn;
              const allCenter = requestModal.cardsRequested.every((c) =>
                gameState.centerCards.some((cc) => cc.cardId === c.cardId),
              );
              const useSpecificIds = !isTurnPlayer && allCenter;
              const reqCards = requestModal.cardsRequested.map((c) => ({
                card_type: c.cardName,
                card_id: useSpecificIds ? c.cardId : "",
              }));
              handleCreateOffer(cardsOffered, reqCards, gameState.playerTurn);
              setRequestModal(null);
            }}
            onClose={() => setRequestModal(null)}
          />
        )}

        {rightClickModal && (
          <RequestCardsModal
            cardsRequested={[rightClickModal.cardRequested]}
            myHand={gameState.hand}
            centerCards={
              playerId === gameState.playerTurn
                ? gameState.centerCards
                : undefined
            }
            onSubmit={(cardsOffered) => {
              const reqCards = [
                {
                  card_type: rightClickModal.cardRequested.cardName,
                  card_id: rightClickModal.cardRequested.cardId,
                },
              ];
              handleCreateOffer(
                cardsOffered,
                reqCards,
                rightClickModal.targetPlayerId,
              );
              setRightClickModal(null);
            }}
            onClose={() => setRightClickModal(null)}
          />
        )}

        {giveModal && (
          <GiveCardsModal
            player={giveModal.player}
            cardsToGive={giveModal.cardsToGive}
            onSubmit={(cardsRequested) => {
              const cardsOffered = giveModal.cardsToGive.map((c) => ({
                card_type: c.cardName,
                card_id: c.cardId,
              }));
              handleCreateOffer(
                cardsOffered,
                cardsRequested,
                giveModal.player.playerId,
              );
              setGiveModal(null);
            }}
            onClose={() => setGiveModal(null)}
          />
        )}
      </div>
    </GameProvider>
  );
}
