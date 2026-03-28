"use client";

import { useState } from "react";
import { CardType, ExternalPlayer, Offer, OfferCard } from "@/schemas/types";
import TradedCards from "@/components/traded-cards";
import InlineOfferTag from "@/components/inline-offer-tag";

type Props = {
  phase: string;
  pickedCards: CardType[];
  selectedCard: CardType | null;
  onCardClick: (card: CardType) => void;
  incomingOffers: Offer[];
  outgoingOffers: Offer[];
  onOfferHover: (id: string | null) => void;
  tagWrapperRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  allOffers: Offer[];
  players: ExternalPlayer[];
  myPlayerId: string;
  cardLookup: Map<string, CardType>;
  hand: CardType[];
  centerCards: CardType[];
  isTurnPlayer: boolean;
  onRespondOffer: (
    offerId: string,
    action: "accept" | "reject" | "cancel",
  ) => void;
  onAcceptOffer: (offer: Offer) => void;
  onCounterOffer: (
    parentId: string,
    offered: OfferCard[],
    requested: OfferCard[],
  ) => void;
  selection: CardType[];
  clearSelection: () => void;
  onRequestDrop: (cards: CardType[]) => void;
};

export default function TradedCardsArea({
  phase,
  pickedCards,
  selectedCard,
  onCardClick,
  incomingOffers,
  outgoingOffers,
  onOfferHover,
  tagWrapperRefs,
  allOffers,
  players,
  myPlayerId,
  cardLookup,
  hand,
  centerCards,
  isTurnPlayer,
  onRespondOffer,
  onAcceptOffer,
  onCounterOffer,
  selection,
  clearSelection,
  onRequestDrop,
}: Props) {
  const [dragOver, setDragOver] = useState(false);
  const isTurnTrade = phase === "turnTrade";

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const raw = e.dataTransfer.getData("application/card");
    if (!raw) return;
    try {
      const dragged = JSON.parse(raw) as CardType;
      const isDraggedInSelection = selection.some(
        (c) => c.cardId === dragged.cardId,
      );
      const cardsToRequest = isDraggedInSelection ? [...selection] : [dragged];
      clearSelection();
      onRequestDrop(cardsToRequest);
    } catch {
      // ignore malformed payload
    }
  };

  return (
    <div
      onDragOver={
        isTurnTrade
          ? (e) => {
              e.preventDefault();
              setDragOver(true);
            }
          : undefined
      }
      onDragLeave={isTurnTrade ? () => setDragOver(false) : undefined}
      onDrop={isTurnTrade ? handleDrop : undefined}
      className={[
        "relative flex flex-row items-center gap-2 px-2 rounded-xl transition-all",
        isTurnTrade ? "min-w-48 min-h-36 border-2" : "",
        isTurnTrade
          ? dragOver
            ? "border-dashed border-amber-300 scale-105 shadow-lg shadow-amber-400/40"
            : "border-dashed border-white/70"
          : "",
      ].join(" ")}
      style={{ height: 160 }}
    >
      <TradedCards
        pickedCards={pickedCards}
        selectedCard={selectedCard}
        onCardClick={onCardClick}
        phase={phase}
      />

      {phase === "turnTrade" && (
        <>
          {incomingOffers.map((offer) => (
            <div
              key={offer.id}
              ref={(el) => {
                if (el) tagWrapperRefs.current.set(offer.id, el);
                else tagWrapperRefs.current.delete(offer.id);
              }}
            >
              <InlineOfferTag
                offer={offer}
                allOffers={allOffers}
                players={players}
                myPlayerId={myPlayerId}
                cardLookup={cardLookup}
                hand={hand}
                centerCards={centerCards}
                isTurnPlayer={isTurnPlayer}
                offerIndex={0}
                onRespond={onRespondOffer}
                onAccept={onAcceptOffer}
                onCounter={onCounterOffer}
                onHover={onOfferHover}
              />
            </div>
          ))}
          {outgoingOffers.map((offer) => {
            const specificIdx = outgoingOffers
              .slice(0, outgoingOffers.indexOf(offer))
              .filter((o) => o.target_id !== "").length;
            return (
            <div
              key={offer.id}
              ref={(el) => {
                if (el) tagWrapperRefs.current.set(offer.id, el);
                else tagWrapperRefs.current.delete(offer.id);
              }}
            >
              <InlineOfferTag
                offer={offer}
                allOffers={allOffers}
                players={players}
                myPlayerId={myPlayerId}
                cardLookup={cardLookup}
                hand={hand}
                centerCards={centerCards}
                isTurnPlayer={isTurnPlayer}
                offerIndex={specificIdx}
                onRespond={onRespondOffer}
                onAccept={onAcceptOffer}
                onCounter={onCounterOffer}
                onHover={onOfferHover}
              />
            </div>
            );
          })}
        </>
      )}

      {isTurnTrade && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 select-none pointer-events-none -z-10">
          <span
            className={`text-2xl transition-colors ${dragOver ? "text-amber-200" : "text-white/70"}`}
          >
            {dragOver ? "↓" : "+"}
          </span>
          {!dragOver && (
            <span className="text-sm font-medium text-white/70">
              Drop to request
            </span>
          )}
        </div>
      )}
    </div>
  );
}
