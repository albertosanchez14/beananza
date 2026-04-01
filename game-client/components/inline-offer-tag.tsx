"use client";

import { useState, useRef } from "react";
import { Offer, OfferCard, ExternalPlayer, CardType } from "@/schemas/types";
import { CardFrontFace } from "@/components/card-front-face";
import { canAcceptOffer } from "@/components/offer-card";
import { getLeaves } from "@/utils/offer-tree";
import OfferTreeOverlay from "@/components/offer-tree-overlay";

function countsByType(cards: OfferCard[]): Record<string, number> {
  return cards.reduce<Record<string, number>>((acc, c) => {
    acc[c.card_type] = (acc[c.card_type] ?? 0) + 1;
    return acc;
  }, {});
}

type Props = {
  rootOffer: Offer;
  subtree: Offer[];
  players: ExternalPlayer[];
  myPlayerId: string;
  cardLookup: Map<string, CardType>;
  hand: CardType[];
  centerCards: CardType[];
  isTurnPlayer?: boolean;
  onRespond: (offerId: string, action: "accept" | "reject" | "cancel") => void;
  onAccept: (offer: Offer) => void;
  onCounter: (offer: Offer) => void;
  onHover?: (id: string | null) => void;
};

/** Ghost card column for a single leaf offer. */
function LeafCard({
  offer,
  myPlayerId,
  cardLookup,
  hand,
  centerCards,
  isTurnPlayer,
  onRespond,
  onAccept,
  onCounter,
}: {
  offer: Offer;
  myPlayerId: string;
  cardLookup: Map<string, CardType>;
  hand: CardType[];
  centerCards: CardType[];
  isTurnPlayer: boolean;
  onRespond: (offerId: string, action: "accept" | "reject" | "cancel") => void;
  onAccept: (offer: Offer) => void;
  onCounter: (offer: Offer) => void;
}) {
  const isIncoming = offer.creator_id !== myPlayerId;
  const relevantCards = isIncoming
    ? offer.cards_offered
    : offer.cards_requested;
  const isFree = relevantCards.length === 0;
  const counts = countsByType(relevantCards);
  const cardTypes = Object.keys(counts)
    .map((t) => cardLookup.get(t))
    .filter((ct): ct is CardType => ct !== undefined);

  const canAccept =
    isIncoming && canAcceptOffer(offer, hand, centerCards, isTurnPlayer);

  return (
    <div className="relative shrink-0 flex flex-col" style={{ width: 96 }}>
      {/* Ghost card area */}
      <div
        className="relative border-r border-white/10 last:border-r-0 flex-1"
        style={{ height: 108 }}
      >
        {isFree ? (
          <div className="absolute inset-0 flex items-center justify-center opacity-40">
            <svg
              viewBox="0 0 96 108"
              className="w-full h-full"
              preserveAspectRatio="none"
            >
              <line
                x1="8"
                y1="8"
                x2="88"
                y2="100"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <line
                x1="88"
                y1="8"
                x2="8"
                y2="100"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>
        ) : (
          cardTypes.map((ct) => (
            <div
              key={ct.cardName}
              className="absolute inset-0"
              style={{ opacity: 0.45 }}
            >
              <CardFrontFace card={ct} />
            </div>
          ))
        )}
        {!isFree && cardTypes.length > 0 && (
          <div className="absolute top-1 right-1 min-w-4 h-4 flex items-center justify-center px-0.5 rounded-full bg-white/20 text-white text-[9px] font-bold border border-white/30 pointer-events-none z-10">
            {relevantCards.length}
          </div>
        )}
      </div>

      {/* Per-leaf action buttons */}
      <div className="flex gap-0.5 p-0.5 pt-1">
        {isIncoming ? (
          <>
            <button
              onClick={() => onAccept(offer)}
              disabled={!canAccept}
              title={canAccept ? "Accept" : "Missing cards"}
              className="flex-1 text-[8px] font-semibold py-0.5 rounded bg-green-700/70 hover:bg-green-600 text-green-200 border border-green-600/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-green-700/70"
            >
              ✓
            </button>
            <button
              onClick={() => onRespond(offer.id, "reject")}
              title="Reject"
              className="flex-1 text-[8px] font-semibold py-0.5 rounded bg-red-900/60 hover:bg-red-800 text-red-300 border border-red-700/50 transition-colors"
            >
              ✕
            </button>
            <button
              onClick={() => onCounter(offer)}
              title="Counter"
              className="flex-1 text-[8px] font-semibold py-0.5 rounded bg-green-800/60 hover:bg-green-700 text-green-200 border border-green-600/50 transition-colors"
            >
              ↩
            </button>
          </>
        ) : (
          <button
            onClick={() => onRespond(offer.id, "cancel")}
            title="Cancel"
            className="flex-1 text-[8px] font-semibold py-0.5 rounded bg-red-900/70 hover:bg-red-800 text-red-300 border border-red-700/50 transition-colors"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export default function InlineOfferTag({
  rootOffer,
  subtree,
  players,
  myPlayerId,
  cardLookup,
  hand,
  centerCards,
  isTurnPlayer = false,
  onRespond,
  onAccept,
  onCounter,
  onHover,
}: Props) {
  const isIncoming = rootOffer.creator_id !== myPlayerId;
  const isBroadcast = rootOffer.target_id === "";
  const [treeOpen, setTreeOpen] = useState(false);
  const branchBtnRef = useRef<HTMLButtonElement>(null);

  const leaves = getLeaves(subtree);

  // If no pending leaves and it's outgoing — the root itself is shown as the sole leaf
  // (it may have been countered and the counter accepted, etc.)
  // But per design: tag disappears when all leaves resolve.
  if (leaves.length === 0) return null;

  const accent = isBroadcast
    ? {
        border: "border-pink-500/80",
        bg: "bg-pink-900/40",
      }
    : isIncoming
      ? {
          border: "border-green-600/60",
          bg: "bg-green-900/30",
        }
      : {
          border: "border-blue-500/80",
          bg: "bg-blue-900/40",
        };

  const hasMultipleNodes = subtree.length > 1;

  return (
    <div
      className="relative shrink-0"
      onMouseEnter={() => onHover?.(rootOffer.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      {/* Missing cards warning for incoming leaves */}
      {isIncoming &&
        leaves.every(
          (l) => !canAcceptOffer(l, hand, centerCards, isTurnPlayer),
        ) && (
          <div
            className="absolute inset-x-0 z-10 flex justify-center pointer-events-none"
            style={{ bottom: "calc(100% + 1rem)" }}
          >
            <span className="text-xs font-semibold text-white px-2 py-1 rounded bg-red-700/80">
              Missing cards
            </span>
          </div>
        )}

      <div
        className={`relative rounded-xl border-2 transition-all duration-200 overflow-hidden flex flex-row ${accent.border} ${accent.bg}`}
        style={{ height: 144 }}
      >
        {/* One column per pending leaf */}
        {leaves.map((leaf) => (
          <LeafCard
            key={leaf.id}
            offer={leaf}
            myPlayerId={myPlayerId}
            cardLookup={cardLookup}
            hand={hand}
            centerCards={centerCards}
            isTurnPlayer={isTurnPlayer}
            onRespond={onRespond}
            onAccept={onAccept}
            onCounter={onCounter}
          />
        ))}

        {/* Branch icon to toggle tree history (only if tree has more than root) */}
        {hasMultipleNodes && (
          <button
            ref={branchBtnRef}
            onClick={() => setTreeOpen((v) => !v)}
            title="Show offer history"
            className={`absolute top-1 left-1 z-20 w-5 h-5 flex items-center justify-center rounded-full border text-[9px] font-bold transition-colors
              ${
                treeOpen
                  ? "bg-amber-500 border-amber-400 text-white"
                  : "bg-white/10 border-white/20 text-white/60 hover:bg-white/20 hover:text-white/90"
              }`}
          >
            ⌥
          </button>
        )}
      </div>

      {/* Tree overlay portal */}
      {treeOpen && branchBtnRef.current && (
        <OfferTreeOverlay
          subtree={subtree}
          rootOfferId={rootOffer.id}
          anchorEl={branchBtnRef.current}
          myPlayerId={myPlayerId}
          players={players}
          cardLookup={cardLookup}
          hand={hand}
          centerCards={centerCards}
          isTurnPlayer={isTurnPlayer}
          onClose={() => setTreeOpen(false)}
          onRespond={onRespond}
          onAccept={onAccept}
          onCounter={(offer) => {
            setTreeOpen(false);
            onCounter(offer);
          }}
        />
      )}
    </div>
  );
}
