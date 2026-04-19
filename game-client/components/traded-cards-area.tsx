"use client";

import { useState } from "react";
import { CardType, Offer } from "@/schemas/types";
import TradedCards from "@/components/traded-cards";
import Card from "@/components/card";
import InlineOfferTag from "@/components/inline-offer-tag";
import { getOfferSubtree } from "@/utils/offer-tree";

const CARD_H = 144;
const CARD_W = 96;

type Props = {
  phase: string;
  pickedCards: CardType[];
  incomingOffers: Offer[];
  outgoingOffers: Offer[];
  onOfferHover: (id: string | null) => void;
  tagWrapperRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  allOffers: Offer[];
  myPlayerId: string;
  viewerPlayerId: string;
  turnPlayerId: string;
  cardLookup: Map<string, CardType>;
  hand: CardType[];
  centerCards: CardType[];
  isTurnPlayer: boolean;
  readOnly?: boolean;
  onRespondOffer?: (
    offerId: string,
    action: "accept" | "reject" | "cancel",
  ) => void;
  onAcceptOffer?: (offer: Offer) => void;
  onCounterOffer: (offer: Offer) => void;
  selection: CardType[];
  clearSelection: () => void;
  onRequestDrop: (cards: CardType[]) => void;
  onOpenModal: () => void;
  draftCards?: CardType[];
  draftCardsGroupRef?: React.Ref<HTMLDivElement>;
  draftColor?: string;
  // Inline editing mode
  isEditingDraft?: boolean;
  reqQty?: Record<string, number>;
  onAdjustReq?: (cardName: string, delta: number) => void;
  onRemoveReq?: (cardName: string) => void;
  showReqPicker?: boolean;
  onToggleReqPicker?: (open: boolean) => void;
  onCancelDraft?: () => void;
  onToggleDraftPicker?: () => void;
  onDraftAdjustReq?: (cardName: string, delta: number) => void;
  onDraftRemoveReq?: (cardName: string) => void;
  onDraftCancel?: () => void;
};

export default function TradedCardsArea({
  phase,
  pickedCards,
  incomingOffers,
  outgoingOffers,
  onOfferHover,
  tagWrapperRefs,
  allOffers,
  myPlayerId,
  viewerPlayerId,
  turnPlayerId,
  cardLookup,
  hand,
  centerCards,
  isTurnPlayer,
  readOnly = false,
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
  isEditingDraft,
  reqQty,
  onAdjustReq,
  onRemoveReq,
  showReqPicker,
  onToggleReqPicker,
  onCancelDraft,
  onToggleDraftPicker,
  onDraftAdjustReq,
  onDraftRemoveReq,
  onDraftCancel,
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

  if (readOnly && !hasContent) return null;

  const totalReq = reqQty
    ? Object.values(reqQty).reduce((s, n) => s + n, 0)
    : 0;

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
        !readOnly && isTurnTrade
          ? (e) => {
              e.preventDefault();
              setDragOver(true);
            }
          : undefined
      }
      onDragLeave={!readOnly && isTurnTrade ? () => setDragOver(false) : undefined}
      onDrop={!readOnly && isTurnTrade ? handleDrop : undefined}
      className={[
        "relative flex flex-row items-center gap-2 px-2 rounded-xl transition-all",
        !readOnly && isTurnTrade ? "min-w-48 border-2" : "",
        !readOnly && isTurnTrade
          ? dragOver
            ? "border-dashed border-amber-300 scale-105 shadow-lg shadow-amber-400/40"
            : "border-dashed border-white/70"
          : "",
      ].join(" ")}
      style={readOnly ? undefined : isEditingDraft ? { minHeight: 160 } : { height: 160 }}
    >
      <TradedCards pickedCards={pickedCards} selection={selection} />

      {draftGroups.length > 0 && (
        <div ref={draftCardsGroupRef} className="flex items-center gap-3">
          {draftGroups.map(({ cardName, cards }) => {
            const count = cards.length;
            const topCard = cards[0];
            return (
              <div
                key={cardName}
                className="relative select-none"
                style={{ width: CARD_W, height: CARD_H, overflow: "visible" }}
              >
                <div style={{ opacity: 0.6 }}>
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      width: CARD_W,
                      zIndex: 1,
                    }}
                  >
                    <Card
                      card={topCard}
                      highlightColor={draftColor}
                      noRaise
                      noTransition
                    />
                  </div>

                  {/* Count badge when not editing */}
                  {!isEditingDraft && count > 1 && (
                    <div
                      className="absolute flex items-center justify-center w-6 h-6
                                 bg-amber-600 text-white text-xs font-bold rounded-full
                                 border-2 border-white shadow-md pointer-events-none"
                      style={{ top: 4, right: 4, zIndex: 2 }}
                    >
                      {count}
                    </div>
                  )}
                </div>

                {/* Controls at full opacity when editing */}
                {isEditingDraft && (
                  <>
                    <button
                      onClick={() =>
                        Object.keys(reqQty ?? {}).length <= 1
                          ? onCancelDraft?.()
                          : onRemoveReq?.(cardName)
                      }
                      className="absolute w-5 h-5 rounded-full bg-black/70 text-white
                        text-[10px] leading-none flex items-center justify-center
                        hover:bg-red-600 transition-colors"
                      style={{ top: -6, right: -6, zIndex: 10 }}
                    >
                      ×
                    </button>
                    <div
                      className="absolute bottom-0 left-0 right-0 flex items-center
                        justify-center gap-0.5 bg-black/70 rounded-b-xl py-1"
                      style={{ zIndex: 10 }}
                    >
                      <button
                        onClick={() => onAdjustReq?.(cardName, -1)}
                        disabled={count <= 1 && totalReq <= 1}
                        className="w-5 h-5 rounded bg-black/60 text-white text-xs font-bold
                          hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        −
                      </button>
                      <span className="w-5 text-center text-xs font-semibold text-white tabular-nums">
                        {count}
                      </span>
                      <button
                        onClick={() => onAdjustReq?.(cardName, 1)}
                        className="w-5 h-5 rounded bg-black/60 text-white text-xs font-bold
                          hover:bg-black/80 transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* + Add button when editing (picker renders in InlineModal) */}
      {isEditingDraft && (
        <button
          onClick={() => onToggleReqPicker?.(!showReqPicker)}
          className="w-8 h-8 rounded-full bg-black/60 text-white text-lg font-bold
            hover:bg-black/80 transition-colors flex items-center justify-center self-center"
        >
          +
        </button>
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
                  viewerPlayerId={viewerPlayerId}
                  turnPlayerId={turnPlayerId}
                  cardLookup={cardLookup}
                  hand={hand}
                  centerCards={centerCards}
                  isTurnPlayer={isTurnPlayer}
                  tagWrapperRefs={tagWrapperRefs}
                  readOnly={readOnly}
                  onRespond={onRespondOffer ?? (() => {})}
                  onAccept={onAcceptOffer ?? (() => {})}
                  onCounter={onCounterOffer}
                  onToggleDraftPicker={onToggleDraftPicker}
                  onDraftAdjustReq={onDraftAdjustReq}
                  onDraftRemoveReq={onDraftRemoveReq}
                  onDraftCancel={onDraftCancel}
                  onHover={onOfferHover}
                />
              </div>
            );
          })}
        </>
      )}

      {/* Empty-state placeholder: hidden during drag-over and when editing */}
      {!readOnly && isTurnTrade && !hasContent && !isEditingDraft && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 select-none">
          {dragOver ? (
            <span className="text-2xl text-amber-200 pointer-events-none">
              ↓
            </span>
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

      {/* Has-content + button — hidden when editing */}
      {!readOnly && isTurnTrade && hasContent && !dragOver && !isEditingDraft && (
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
