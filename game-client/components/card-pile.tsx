"use client";

import Card from "@/components/card";
import { BaseCard, CardType } from "@/schemas/types";
import { Children, ReactNode } from "react";

// ─── Shared helpers ──────────────────────────────────────────────────────────

const MAX_CARDS = 60;
const CARD_W = 96;
const CARD_H = 144;
const LAYER_H = 4;
const MAX_LAYERS = 7;
// Fixed container height used by both CardPile and CenterCards so all three
// centre items share the same bottom baseline and items-end aligns them correctly.
export const PILE_CONTAINER_H = CARD_H + MAX_LAYERS * LAYER_H; // 172px

export function pileHeight(count: number): number {
  const min = 44;
  const max = CARD_H;
  return Math.round(
    min + (Math.min(count, MAX_CARDS) / MAX_CARDS) * (max - min),
  );
}

export function stackLayers(count: number): number {
  if (count === 0) return 0;
  return Math.min(MAX_LAYERS, Math.ceil((count / MAX_CARDS) * MAX_LAYERS) + 1);
}

// ─── CardPile ─────────────────────────────────────────────────────────────────

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
        className="relative select-none flex items-end"
        style={{ width: CARD_W, height: PILE_CONTAINER_H }}
      >
        <div
          className="w-24 h-36 rounded-2xl border-2 border-dashed border-gray-600
                     bg-gray-800/40 flex items-center justify-center"
        >
          <span className="text-xs text-gray-500 font-medium tracking-wide">
            {label}
          </span>
        </div>
      </div>
    );
  }

  const layers = stackLayers(count);
  const faceH = pileHeight(count);
  // Bottom of the face card sits atop the layer slabs.
  // layers * LAYER_H is the slab zone height; face card bottom = that value from container bottom.
  const faceBottom = layers * LAYER_H;

  return (
    <div
      ref={deckRef}
      className="relative select-none"
      style={{ width: CARD_W, height: PILE_CONTAINER_H }}
    >
      {/* Top card — always full h-36, bottom edge anchored above the layer slabs.
          The card shrinks visually because faceH controls how far *up* the layers
          reach, not by clipping the card image itself. */}
      <div
        className={`absolute left-0 ${count === 0 ? "opacity-40" : ""}`}
        style={{
          bottom: faceBottom,
          zIndex: layers + 1,
        }}
      >
        <Card card={topCard} flipped={true} onClick={onClickAction} />
      </div>

      {/* Depth layers — peek out below the face card */}
      {Array.from({ length: layers }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-2xl border-2"
          style={{
            width: CARD_W,
            height: faceH,
            // Layer 0 (closest to face) sits just below it; deeper layers go further down.
            bottom: (layers - i - 1) * LAYER_H,
            left: 0,
            zIndex: layers - i,
            background: "#4a6478",
            borderColor: "#344d5c",
          }}
        />
      ))}

      {/* Count badge — top-left of the face card */}
      <div
        className="absolute flex items-center justify-center w-6 h-6
                   bg-black/60 text-white text-xs font-bold rounded-full
                   border-2 border-white/60 shadow-md pointer-events-none"
        style={{
          bottom: faceBottom + CARD_H - 30,
          left: 6,
          zIndex: layers + 2,
        }}
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
  slots: number;
  children: ReactNode;
};

export function CenterCards({ slots, children }: CenterCardsProps) {
  const items = Children.toArray(children);
  if (slots === 0) return null;

  return (
    <div
      className="flex items-end gap-2"
      style={{
        width: slots * CARD_W + (slots - 1) * 8,
        height: PILE_CONTAINER_H,
      }}
    >
      {Array.from({ length: slots }).map((_, i) => {
        const card = items[i];
        if (!card) {
          return (
            <div
              key={i}
              style={{ width: CARD_W, height: CARD_H, flexShrink: 0 }}
            />
          );
        }
        return card;
      })}
    </div>
  );
}
