"use client";

import { useState } from "react";
import { CardType, Offer } from "@/schemas/types";
import TradedCards from "@/components/traded-cards";
import Card from "@/components/card";
import InlineOfferTag from "@/components/inline-offer-tag";
import { getOfferSubtree } from "@/utils/offer-tree";

const CARD_H = 144;
const CARD_W = 96;
const LAYER_H = 4;

type Props = {
  phase: string;
  pickedCards: CardType[];
  onCardClick: (card: CardType) => void;
  incomingOffers: Offer[];
  outgoingOffers: Offer[];
  onOfferHover: (id: string | null) => void;
  tagWrapperRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  allOffers: Offer[];
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
  onCounterOffer: (offer: Offer) => void;
  selection: CardType[];
  clearSelection: () => void;
  onRequestDrop: (cards: CardType[]) => void;
  onOpenModal: () => void;
  draftCards?: CardType[];
  draftCardsGroupRef?: React.RefObject<HTMLDivElement | null>;
  draftColor?: string;
};

export default function TradedCardsArea({
  phase,
  pickedCards,
  onCardClick,
  incomingOffers,
  outgoingOffers,
  onOfferHover,
  tagWrapperRefs,
  allOffers,
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
  onOpenModal,
  draftCards,
  draftCardsGroupRef,
  draftColor,
}: Props) {
  // Group draft cards by cardName for stacked rendering.
  const draftGroups: { cardName: string; cards: CardType[] }[] = [];
  if (draftCards && draftCards.length > 0) {
    const idx = new Map<string, number>();
    for (const card of draftCards) {
      const i = idx.get(card.cardName);
      if (i === undefined) {
        idx.set(card.cardName, draftGroups.length);
        draftGroups.push({ cardName: card.cardName, cards: [card] });
      } else {
        draftGroups[i].cards.push(card);
      }
    }
  }
  const [dragOver, setDragOver] = useState(false);
  const isTurnTrade = phase === "turnTrade";
  const rootOffers = [...incomingOffers, ...outgoingOffers];
  const hasContent =
    pickedCards.length > 0 || draftGroups.length > 0 || rootOffers.length > 0;

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
        selection={selection}
        onCardClick={onCardClick}
        phase={phase}
      />

      {draftGroups.length > 0 && (
        <div
          ref={draftCardsGroupRef}
          className="flex items-center gap-2"
          style={{ opacity: 0.6 }}
        >
          {draftGroups.map(({ cardName, cards }) => {
            const count = cards.length;
            const topCard = cards[0];
            const layers = Math.min(count - 1, 6);
            return (
              <div
                key={cardName}
                className="relative select-none"
                style={{ width: CARD_W, height: CARD_H, overflow: "visible" }}
              >
                {/* Face card — always at the top of the container */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    width: CARD_W,
                    zIndex: layers + 1,
                  }}
                >
                  <Card
                    card={topCard}
                    highlightColor={draftColor}
                    noRaise
                    noTransition
                  />
                </div>

                {/* Depth layers — overflow above the face card (bottom-to-top stack) */}
                {Array.from({ length: layers }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute rounded-xl"
                    style={{
                      width: CARD_W,
                      height: CARD_H,
                      top: -(i + 1) * LAYER_H,
                      left: 0,
                      zIndex: layers - i,
                      border: `2px dashed ${draftColor ?? "#38bdf8"}`,
                    }}
                  />
                ))}

                {count > 1 && (
                  <div
                    className="absolute flex items-center justify-center w-6 h-6
                               bg-amber-600 text-white text-xs font-bold rounded-full
                               border-2 border-white shadow-md pointer-events-none"
                    style={{ top: 4, right: 4, zIndex: layers + 2 }}
                  >
                    {count}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {phase === "turnTrade" && (
        <>
          {rootOffers.map((rootOffer) => {
            const subtree = getOfferSubtree(allOffers, rootOffer.id).filter(
              (offer) =>
                offer.status === "pending" &&
                (offer.id === rootOffer.id ||
                  offer.creator_id === myPlayerId ||
                  offer.target_id === myPlayerId ||
                  offer.target_id === ""),
            );
            return (
              <div
                key={rootOffer.id}
                ref={(el) => {
                  if (el) tagWrapperRefs.current.set(rootOffer.id, el);
                  else tagWrapperRefs.current.delete(rootOffer.id);
                }}
              >
                <InlineOfferTag
                  rootOffer={rootOffer}
                  subtree={subtree}
                  myPlayerId={myPlayerId}
                  cardLookup={cardLookup}
                  hand={hand}
                  centerCards={centerCards}
                  isTurnPlayer={isTurnPlayer}
                  tagWrapperRefs={tagWrapperRefs}
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

      {/* Empty-state placeholder: + button + hint text, hidden during drag-over */}
      {isTurnTrade && !hasContent && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 select-none">
          {dragOver ? (
            <span className="text-2xl text-amber-200 pointer-events-none">↓</span>
          ) : (
            <>
              <button
                onClick={onOpenModal}
                className="w-8 h-8 rounded-full bg-black/60 text-white text-2xl font-bold
                  hover:bg-black/80 transition-colors flex items-center justify-center"
              >
                +
              </button>
              <span className="text-sm font-medium text-white/70 pointer-events-none">
                Drop to request
              </span>
            </>
          )}
        </div>
      )}

      {/* Has-content state: compact + button to the right of all items */}
      {isTurnTrade && hasContent && !dragOver && (
        <button
          onClick={onOpenModal}
          className="w-8 h-8 rounded-full bg-black/60 text-white text-lg font-bold
            hover:bg-black/80 transition-colors flex items-center justify-center flex-shrink-0"
        >
          +
        </button>
      )}
    </div>
  );
}
