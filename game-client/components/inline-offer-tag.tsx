"use client";
import { useState } from "react";
import { Offer, OfferCard, ExternalPlayer, CardType } from "@/schemas/types";
import { CardFrontFace } from "@/components/card-front-face";

const ACCENTS = [
  {
    border: "border-blue-500/80",
    bg: "bg-blue-900/40",
    badge: "bg-blue-700/80 text-blue-200",
    counter: "bg-blue-600 border-blue-500/60",
  },
  {
    border: "border-purple-500/80",
    bg: "bg-purple-900/40",
    badge: "bg-purple-700/80 text-purple-200",
    counter: "bg-purple-600 border-purple-500/60",
  },
  {
    border: "border-teal-500/80",
    bg: "bg-teal-900/40",
    badge: "bg-teal-700/80 text-teal-200",
    counter: "bg-teal-600 border-teal-500/60",
  },
  {
    border: "border-rose-500/80",
    bg: "bg-rose-900/40",
    badge: "bg-rose-700/80 text-rose-200",
    counter: "bg-rose-600 border-rose-500/60",
  },
];

function countsByType(cards: OfferCard[]): Record<string, number> {
  return cards.reduce<Record<string, number>>((acc, c) => {
    acc[c.card_type] = (acc[c.card_type] ?? 0) + 1;
    return acc;
  }, {});
}

type Props = {
  offer: Offer;
  allOffers: Offer[];
  players: ExternalPlayer[];
  myPlayerId: string;
  cardLookup: Map<string, CardType>;
  hand: CardType[];
  centerCards: CardType[];
  isTurnPlayer?: boolean;
  offerIndex?: number;
  onRespond: (offerId: string, action: "accept" | "reject" | "cancel") => void;
  onAccept: (offer: Offer) => void;
  onCounter: (
    parentOfferId: string,
    offered: OfferCard[],
    requested: OfferCard[],
  ) => void;
  onHover?: (id: string | null) => void;
};

export default function InlineOfferTag({
  offer,
  myPlayerId,
  cardLookup,
  hand,
  centerCards,
  isTurnPlayer = false,
  offerIndex = 0,
  onRespond,
  onAccept,
  onHover,
}: Props) {
  const isIncoming = offer.creator_id !== myPlayerId;
  const [dismissed, setDismissed] = useState(false);
  const [rejectFlash, setRejectFlash] = useState(false);

  const isFreeRequest = isIncoming
    ? offer.cards_offered.length === 0
    : offer.cards_requested.length === 0;

  const accent = isIncoming
    ? {
        border: "border-green-600/60",
        bg: "bg-green-900/30",
        badge: "bg-green-800/80 text-green-200",
        counter: "bg-green-700 border-green-600/60",
      }
    : ACCENTS[offerIndex % ACCENTS.length];

  const offCounts = countsByType(offer.cards_offered);
  const reqCounts = countsByType(offer.cards_requested);
  const ghostCounts = isIncoming ? offCounts : reqCounts;
  const ghostCardTypes = Object.keys(ghostCounts)
    .map((type) => cardLookup.get(type))
    .filter((ct): ct is CardType => ct !== undefined);

  const canAccept = (() => {
    if (!isIncoming) return false;
    // Count available cards per type (hand + center if turn player).
    const handCounts: Record<string, number> = {};
    for (const c of hand) handCounts[c.cardName] = (handCounts[c.cardName] ?? 0) + 1;
    const centerCounts: Record<string, number> = {};
    if (isTurnPlayer) {
      for (const c of centerCards)
        centerCounts[c.cardName] = (centerCounts[c.cardName] ?? 0) + 1;
    }
    // For explicit card_id requests check exact presence; for type-only requests
    // compare total available count against total requested count per type.
    const needed: Record<string, number> = {};
    for (const c of offer.cards_requested) {
      if (c.card_id) {
        const has =
          hand.some((h) => h.cardId === c.card_id) ||
          (isTurnPlayer && centerCards.some((h) => h.cardId === c.card_id));
        if (!has) return false;
      } else {
        needed[c.card_type] = (needed[c.card_type] ?? 0) + 1;
      }
    }
    for (const [type, count] of Object.entries(needed)) {
      const available = (handCounts[type] ?? 0) + (centerCounts[type] ?? 0);
      if (available < count) return false;
    }
    return true;
  })();

  if (dismissed) return null;

  const handleCancel = () => {
    setDismissed(true);
    onRespond(offer.id, "cancel");
  };

  const handleReject = (id: string) => {
    setRejectFlash(true);
    setTimeout(() => setRejectFlash(false), 400);
    onRespond(id, "reject");
  };

  const handleAccept = () => {
    onAccept(offer);
  };

  const borderCls = rejectFlash
    ? "border-red-500 bg-red-900/30"
    : `${accent.border} ${accent.bg}`;

  return (
    <div
      className={`relative shrink-0 rounded-xl border-2 transition-all duration-200 overflow-hidden flex flex-row ${borderCls}`}
      style={{ width: isIncoming ? undefined : 96, height: 144 }}
      onMouseEnter={() => onHover?.(offer.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      {/* Ghost area: X for free offers, ghost cards otherwise */}
      {isFreeRequest ? (
        <div className="relative w-24 h-full shrink-0 flex items-center justify-center">
          <svg
            className="absolute inset-0 w-full h-full opacity-40"
            viewBox="0 0 96 144"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <line x1="8" y1="8" x2="88" y2="136" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <line x1="88" y1="8" x2="8" y2="136" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      ) : (
        ghostCardTypes.map((ct) => (
          <div
            key={ct.cardName}
            className="relative w-24 h-full shrink-0 border-r border-white/10 last:border-r-0"
          >
            <div className="absolute inset-0" style={{ opacity: 0.45 }}>
              <CardFrontFace card={ct} />
            </div>
            <div
              className="absolute top-1.5 right-1.5 min-w-5 h-5
              flex items-center justify-center px-1 rounded-full
              bg-white/20 text-white text-[10px] font-bold
              border border-white/30 pointer-events-none z-10"
            >
              {ghostCounts[ct.cardName]}
            </div>
          </div>
        ))
      )}

      {/* Bottom action buttons */}
      <div className="absolute inset-x-0 bottom-0 p-1.5 flex flex-col gap-1 z-10">
        {isIncoming ? (
          <>
            {!canAccept && (
              <div className="text-[10px] font-semibold text-red-300 leading-tight px-0.5 drop-shadow-sm">
                Missing cards
              </div>
            )}
            <div className="flex gap-1">
              <button
                onClick={() => handleAccept()}
                title={canAccept ? "Accept" : "You don't have the required cards"}
                disabled={!canAccept}
                className="flex-1 text-[9px] font-semibold py-0.5
                rounded bg-green-700/70 hover:bg-green-600 text-green-200
                border border-green-600/50 transition-colors disabled:opacity-30
                disabled:cursor-not-allowed disabled:hover:bg-green-700/70"
              >
                ✓
              </button>
              <button
                onClick={() => handleReject(offer.id)}
                title="Reject"
                className="flex-1 text-[9px] font-semibold py-0.5
                rounded bg-red-900/60 hover:bg-red-800 text-red-300
                border border-red-700/50 transition-colors"
              >
                ✕
              </button>
              <button
                title="Counter"
                className="flex-1 text-[9px] font-semibold py-0.5
                rounded bg-green-800/60 hover:bg-green-700 text-green-200
                border border-green-600/50 transition-colors"
              >
                ↩
              </button>
            </div>
          </>
        ) : (
          <div className="flex gap-1">
            <button
              onClick={handleCancel}
              title="Cancel offer"
              className="flex-1 text-[9px] font-semibold py-0.5
              rounded bg-red-900/70 hover:bg-red-800 text-red-300
              border border-red-700/50 transition-colors"
            >
              ✕
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
