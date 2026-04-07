import { useState, useEffect } from "react";

import { GameRoomContext } from "@/hooks/useGameRoom";
import { CardType, OfferCard } from "@/schemas/types";

function enrichWithCenterIds(
  reqCards: OfferCard[],
  centerCards: CardType[],
  isTurnPlayer: boolean,
): OfferCard[] {
  if (isTurnPlayer) return reqCards;
  const usedIds = new Set<string>();
  return reqCards.map((c) => {
    const match = centerCards.find(
      (cc) => cc.cardName === c.card_type && !usedIds.has(cc.cardId),
    );
    if (match) {
      usedIds.add(match.cardId);
      return { ...c, card_id: match.cardId };
    }
    return c;
  });
}

import { GameProvider } from "@/components/game-context";
import Board from "@/components/board";
import OfferPanel from "@/components/offer-panel";
import RequestCardsModal from "@/components/request-cards-modal";

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
  const [offerPanelOpen, setOfferPanelOpen] = useState(false);
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

  const pendingIncomingCount = gameState.offers.filter(
    (o) =>
      o.status === "pending" &&
      o.creator_id !== playerId &&
      (o.target_id === "" || o.target_id === playerId),
  ).length;

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
      onRequestDrop={(cardsRequested) => setRequestModal({ cardsRequested })}
      onCardRightClick={(card, targetPlayerId) =>
        setRightClickModal({ cardRequested: card, targetPlayerId })
      }
      onCreateOffer={createOffer}
      onRespondOffer={respondOffer}
      onCounterOffer={counterOffer}
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
          onCreateOffer={createOffer}
          onCounterOffer={counterOffer}
          onRespondOffer={respondOffer}
        />

        {requestModal && (
          <RequestCardsModal
            cardsRequested={requestModal.cardsRequested}
            myHand={gameState.hand}
            centerCards={
              playerId === gameState.playerTurn
                ? gameState.centerCards
                : undefined
            }
            isTurnPlayer={playerId === gameState.playerTurn}
            players={gameState.players.filter((p) => p.playerId !== playerId)}
            defaultTargetId={
              playerId !== gameState.playerTurn
                ? gameState.playerTurn
                : undefined
            }
            onSubmit={(cardsOffered, _, targetPlayerId) => {
              const isTurnPlayer = playerId === gameState.playerTurn;
              const allCenter = requestModal.cardsRequested.every((c) =>
                gameState.centerCards.some((cc) => cc.cardId === c.cardId),
              );
              const useSpecificIds = !isTurnPlayer && allCenter;
              const reqCards = requestModal.cardsRequested.map((c) => ({
                card_type: c.cardName,
                card_id: useSpecificIds ? c.cardId : "",
              }));
              createOffer(cardsOffered, reqCards, targetPlayerId);
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
            isTurnPlayer={playerId === gameState.playerTurn}
            players={gameState.players.filter((p) => p.playerId !== playerId)}
            defaultTargetId={rightClickModal.targetPlayerId}
            onSubmit={(cardsOffered, reqCards, targetPlayerId) => {
              createOffer(
                cardsOffered,
                enrichWithCenterIds(
                  reqCards,
                  gameState.centerCards,
                  playerId === gameState.playerTurn,
                ),
                targetPlayerId,
              );
              setRightClickModal(null);
            }}
            onClose={() => setRightClickModal(null)}
          />
        )}

      </div>
    </GameProvider>
  );
}
