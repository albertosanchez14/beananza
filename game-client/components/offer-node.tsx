"use client";

import { CSSProperties, forwardRef } from "react";
import { CardType, ExternalPlayer, Offer } from "@/schemas/types";
import { CardFrontFace } from "@/components/card-front-face";
import { canAcceptOffer } from "@/components/offer-card";

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-yellow-600/80 text-yellow-100",
  accepted: "bg-green-700/80 text-green-100",
  rejected: "bg-red-700/80 text-red-100",
  cancelled: "bg-gray-600/80 text-gray-200",
  expired: "bg-gray-600/80 text-gray-200",
};

type OfferNodeProps = {
  offer: Offer;
  myPlayerId: string;
  cardLookup: Map<string, CardType>;
  hand: CardType[];
  centerCards: CardType[];
  isTurnPlayer: boolean;
  accent: { border: string; bg: string };
  variant: "standalone" | "inline";
  width: number;
  cardHeight: number;
  players?: ExternalPlayer[];
  style?: CSSProperties;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onRespond: (offerId: string, action: "accept" | "reject" | "cancel") => void;
  onAccept: (offer: Offer) => void;
  onCounter: (offer: Offer) => void;
};

export const OfferNode = forwardRef<HTMLDivElement, OfferNodeProps>(function OfferNode(props,  ref) {
  const {
    offer,
    myPlayerId,
    cardLookup,
    hand,
    centerCards,
    isTurnPlayer,
    onRespond,
    onAccept,
    onCounter,
    width,
    cardHeight,
    accent,
    style,
  } = props;

  const isIncoming = offer.creator_id !== myPlayerId;
  const isPending = offer.status === "pending";

  const relevantCards = isIncoming
    ? offer.cards_offered
    : offer.cards_requested;
  const counts: Record<string, number> = {};
  for (const c of relevantCards) {
    counts[c.card_type] = (counts[c.card_type] ?? 0) + 1;
  }
  const cardTypes = Object.keys(counts)
    .map((t) => cardLookup.get(t))
    .filter((ct): ct is CardType => ct !== undefined);

  const isFree = relevantCards.length === 0;
  const nodeWidth = cardTypes.length > 1 ? width * cardTypes.length : width;
  const canAccept =
    isIncoming &&
    isPending &&
    canAcceptOffer(offer, hand, centerCards, isTurnPlayer);

  const crossSvg = (
    <div className="flex-1 flex items-center justify-center opacity-40">
      <svg
        viewBox={`0 0 ${width} ${cardHeight}`}
        className="w-full h-full"
        preserveAspectRatio="none"
      >
        <line
          x1="8"
          y1="8"
          x2={width - 8}
          y2={cardHeight - 8}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <line
          x1={width - 8}
          y1="8"
          x2="8"
          y2={cardHeight - 8}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );

  return (
    <div
      ref={ref}
      className="flex flex-col"
      style={{ ...style, width: nodeWidth }}
      onMouseEnter={props.onMouseEnter}
      onMouseLeave={props.onMouseLeave}
    >
      <div
        className={`rounded-xl border-2 overflow-hidden 
						flex flex-row relative ${accent.border} ${accent.bg}`}
        style={{ height: cardHeight }}
      >
        {isFree
          ? crossSvg
          : cardTypes.map((ct) => (
              <div key={ct.cardName} className="relative flex-1 min-w-0">
                <CardFrontFace card={ct} />
                {counts[ct.cardName] > 1 && (
                  <span
                    className="absolute top-0.5 right-0.5 z-20 min-w-3.5 h-3.5 
										flex items-center justify-center 
										text-black font-bold px-0.5"
                  >
                    {counts[ct.cardName]}
                  </span>
                )}
              </div>
            ))}

        {props.variant === "standalone" && (
          <div className="absolute top-1 left-1 z-10">
            <span
              className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full 
									${STATUS_COLOR[offer.status] ?? STATUS_COLOR.expired}`}
            >
              {offer.status}
            </span>
          </div>
        )}

        <div
          className="absolute bottom-0 inset-x-0 z-10 flex gap-0.5 px-1 pb-1 pt-4"
          style={{
            background:
              "linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)",
          }}
        >
          {isIncoming && (
            <button
              onClick={() => onAccept(offer)}
              disabled={!canAccept}
              title={canAccept ? "Accept" : "Missing cards"}
              className="flex-1 text-[8px] font-semibold py-0.5 
						rounded bg-green-700/70 hover:bg-green-600 text-green-200 
						border border-green-600/50 transition-colors 
						disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ✓
            </button>
          )}
          <button
            onClick={() =>
              onRespond(offer.id, isIncoming ? "reject" : "cancel")
            }
            title={isIncoming ? "Reject" : "Cancel"}
            className="flex-1 text-[8px] font-semibold py-0.5 
						rounded bg-red-900/60 hover:bg-red-800 
						text-red-300 border border-red-700/50 transition-colors"
          >
            ✕
          </button>

          {isIncoming && (
            <button
              onClick={() => onCounter(offer)}
              title="Counter"
              className="flex-1 text-[8px] font-semibold py-0.5 
						rounded bg-green-800/60 hover:bg-green-700 text-green-200 
						border border-green-600/50 transition-colors"
            >
              ↩
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
