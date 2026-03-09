"use client";

import { useEffect, useRef, useState } from "react";
import Card from "@/components/card";
import { BaseCard, CardType } from "@/schemas/types";

// ─── Shared helpers ──────────────────────────────────────────────────────────

const MAX_CARDS = 60;
const CARD_W = 96;
const LAYER_H = 4;

export function pileHeight(count: number): number {
  const min = 44;
  const max = 144;
  return Math.round(
    min + (Math.min(count, MAX_CARDS) / MAX_CARDS) * (max - min),
  );
}

export function stackLayers(count: number): number {
  if (count === 0) return 0;
  return Math.min(7, Math.ceil((count / MAX_CARDS) * 7) + 1);
}

// ─── Shared helpers ──────────────────────────────────────────────────────────

type CardPileProps = {
  label: string;
  count: number;
  topCard: BaseCard | CardType | null;
  onClickAction?: () => void;
  deckRef?: React.RefObject<HTMLDivElement | null>;
};

export function CardPile({
  label,
  count,
  topCard,
  onClickAction,
  deckRef,
}: CardPileProps) {
  if (!topCard) {
    return (
      <div
        className="w-24 h-36 rounded-2xl border-2 border-dashed border-gray-600
                   bg-gray-800/40 flex items-center justify-center"
      >
        <span className="text-xs text-gray-500 font-medium tracking-wide">
          {label}
        </span>
      </div>
    );
  }

  const layers = stackLayers(count);
  const faceH = pileHeight(count);

  return (
    <div className="relative select-none" style={{ width: CARD_W }}>
      {/* Depth layers */}
      {Array.from({ length: layers }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-2xl border-2"
          style={{
            width: CARD_W,
            height: faceH,
            top: (i + 1) * LAYER_H,
            left: 0,
            zIndex: layers - i,
            background: "#4a6478",
            borderColor: "#344d5c",
          }}
        />
      ))}

      {/* Top card — back face */}
      <div
        style={{ position: "relative", zIndex: layers + 1 }}
        className={count === 0 ? "opacity-40" : ""}
      >
        <Card
          card={topCard}
          flipped={true}
          onClick={onClickAction}
          cardRef={(el) => {
            if (deckRef) {
              const ref = deckRef as { current: HTMLDivElement | null };
              ref.current = el;
            }
          }}
        />
      </div>

      {/* Count badge */}
      <div
        className="absolute flex items-center justify-center w-6 h-6
                   bg-black/60 text-white text-xs font-bold rounded-full
                   border-2 border-white/60 shadow-md pointer-events-none"
        style={{ top: 6, left: 6, zIndex: layers + 2 }}
      >
        {count}
      </div>
    </div>
  );
}

// ─── CenterCards ─────────────────────────────────────────────────────────────
// The face-up cards turned over from the draw pile.  Reserves a fixed-width
// area for `slots` card slots so layout never shifts as cards arrive, and
// plays a fly-in animation from the deck position when new cards appear.

type CenterCardsProps = {
  /** The face-up cards currently on the table. */
  cards: CardType[];
  /** How many slots to reserve (from /config). Falls back to cards.length. */
  slots?: number;
  /** The currently selected card (to highlight matching center card). */
  selectedCard?: CardType | null;
  /** Ref to the draw deck element, used to measure the deal animation offset. */
  deckRef: React.RefObject<HTMLDivElement | null>;
  /** Called when a center card is clicked. */
  onCardClickAction: (card: CardType) => void;
};

export function CenterCards({
  cards,
  slots,
  selectedCard,
  deckRef,
  onCardClickAction,
}: CenterCardsProps) {
  const [dealingCardIds, setDealingCardIds] = useState<Set<string>>(new Set());
  const prevCountRef = useRef<number>(cards.length);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const dealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prev = prevCountRef.current;
    const curr = cards.length;
    prevCountRef.current = curr;

    if (curr <= prev) return; // cards removed or unchanged — no deal anim

    const newCards = cards.slice(prev);
    const newIds = new Set(newCards.map((c) => c.cardId));

    // Measure deck→card offset in a rAF so new cards are in the DOM.
    requestAnimationFrame(() => {
      const deckEl = deckRef.current;
      if (!deckEl) return;
      const deckRect = deckEl.getBoundingClientRect();
      const deckCx = deckRect.left + deckRect.width / 2;
      const deckCy = deckRect.top + deckRect.height / 2;

      newIds.forEach((id) => {
        const cardEl = cardRefs.current.get(id);
        if (!cardEl) return;
        const cardRect = cardEl.getBoundingClientRect();
        const cardCx = cardRect.left + cardRect.width / 2;
        const cardCy = cardRect.top + cardRect.height / 2;
        cardEl.style.setProperty("--deck-dx", `${deckCx - cardCx}px`);
        cardEl.style.setProperty("--deck-dy", `${deckCy - cardCy}px`);
      });

      setDealingCardIds(new Set(newIds));

      if (dealTimeoutRef.current) clearTimeout(dealTimeoutRef.current);
      dealTimeoutRef.current = setTimeout(
        () => setDealingCardIds(new Set()),
        520,
      );
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards]);

  const slotCount = slots ?? cards.length;
  if (slotCount === 0) return null;

  return (
    <div
      className="flex items-end gap-2"
      style={{ width: slotCount * CARD_W + (slotCount - 1) * 8 }}
    >
      {Array.from({ length: slotCount }).map((_, i) => {
        const card = cards[i];
        if (!card) {
          return (
            <div
              key={i}
              style={{ width: CARD_W, height: 144, flexShrink: 0 }}
            />
          );
        }
        const isDealing = dealingCardIds.has(card.cardId);
        return (
          <Card
            key={card.cardId}
            card={card}
            isSelected={selectedCard?.cardId === card.cardId}
            draggable
            onClick={() => onCardClickAction(card)}
            cardRef={(el) => {
              if (el) cardRefs.current.set(card.cardId, el);
              else cardRefs.current.delete(card.cardId);
            }}
            className={isDealing ? "animate-deal" : undefined}
          />
        );
      })}
    </div>
  );
}
