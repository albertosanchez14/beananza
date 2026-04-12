"use client";

import { CSSProperties, forwardRef } from "react";
import { CardType, Offer } from "@/schemas/types";
import { CardFrontFace } from "@/components/card-front-face";
import { canAcceptOffer } from "@/utils/offer-utils";

type OfferNodeProps = {
  offer: Offer;
  myPlayerId: string;
  cardLookup: Map<string, CardType>;
  hand: CardType[];
  centerCards: CardType[];
  isTurnPlayer: boolean;
  accent: { border: string; bg: string };
  width: number;
  cardHeight: number;
  isDraft?: boolean;
  onToggleDraftPicker?: () => void;
  onDraftAdjustReq?: (cardName: string, delta: number) => void;
  onDraftRemoveReq?: (cardName: string) => void;
  onDraftCancel?: () => void;
  style?: CSSProperties;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onRespond: (offerId: string, action: "accept" | "reject" | "cancel") => void;
  onAccept: (offer: Offer) => void;
  onCounter: (offer: Offer) => void;
  onCtrlClick?: () => void;
};

export const OfferNode = forwardRef<HTMLDivElement, OfferNodeProps>(
  function OfferNode(props, ref) {
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
      isDraft = false,
      onToggleDraftPicker,
      onDraftAdjustReq,
      onDraftRemoveReq,
      onDraftCancel,
      onCtrlClick,
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

    const totalReq = relevantCards.length;
    const cardTypeCount = Object.keys(counts).length;

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
        className="relative flex flex-col"
        style={{ ...style, width: nodeWidth }}
        onMouseEnter={props.onMouseEnter}
        onMouseLeave={props.onMouseLeave}
        onClick={(e) => {
          if (e.ctrlKey && onCtrlClick) {
            e.stopPropagation();
            onCtrlClick();
          }
        }}
      >
        {isIncoming && isPending && !canAccept && (
          <div
            className="absolute inset-x-0 z-10 flex justify-center pointer-events-none"
            style={{ bottom: "calc(100% + 0.25rem)" }}
          >
            <span className="text-xs font-semibold text-white px-2 py-1 rounded bg-red-700/80 whitespace-nowrap">
              Missing cards
            </span>
          </div>
        )}

        <div
          className={`rounded-xl border-2 overflow-hidden
						flex flex-row relative ${isDraft ? "border-dashed" : ""} ${accent.border} ${accent.bg}`}
          style={{ height: cardHeight, opacity: isDraft ? 0.6 : undefined }}
        >
          {isFree
            ? crossSvg
            : cardTypes.map((ct, i) => (
                <div key={ct.cardName} className="relative flex-1 min-w-0">
                  <CardFrontFace card={ct} />
                  {!isDraft && counts[ct.cardName] > 1 && (
                    <div
                      className="absolute flex items-center justify-center w-6 h-6
                        bg-amber-600 text-white text-xs font-bold rounded-full
                        border-2 border-white shadow-md pointer-events-none z-30"
                      style={{ top: 1, right: 1 }}
                    >
                      {counts[ct.cardName]}
                    </div>
                  )}
                  {/* Counter badge on first card only */}
                  {!isDraft && i === 0 && offer.parent_offer_id !== "" && (
                    <div
                      className="absolute flex items-center justify-center w-5 h-5
                        bg-black/70 text-white text-[10px] font-bold rounded-full
                        border border-white/20 pointer-events-none z-30"
                      style={{ top: 1, left: 1 }}
                    >
                      ↩
                    </div>
                  )}
                </div>
              ))}

          {!isDraft && (
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
          )}
        </div>

        {/* Draft controls overlay — full opacity, positioned over the card */}
        {isDraft && !isFree && (
          <div
            className="absolute inset-0 flex flex-row pointer-events-none"
            style={{ zIndex: 20 }}
          >
            {cardTypes.map((ct) => (
              <div
                key={ct.cardName}
                className="relative flex-1 pointer-events-auto"
              >
                {/* X button */}
                <button
                  onClick={() =>
                    cardTypeCount <= 1
                      ? onDraftCancel?.()
                      : onDraftRemoveReq?.(ct.cardName)
                  }
                  className="absolute w-5 h-5 rounded-full bg-black/70 text-white
                    text-[10px] leading-none flex items-center justify-center
                    hover:bg-red-600 transition-colors"
                  style={{ top: 4, right: 4 }}
                >
                  ×
                </button>
                {/* Quantity strip */}
                <div
                  className="absolute bottom-0 left-0 right-0 flex items-center
                    justify-center gap-0.5 bg-black/70 rounded-b-xl py-1"
                >
                  <button
                    onClick={() => onDraftAdjustReq?.(ct.cardName, -1)}
                    disabled={counts[ct.cardName] <= 1 && totalReq <= 1}
                    className="w-5 h-5 rounded bg-black/60 text-white text-xs font-bold
                      hover:bg-black/80 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    −
                  </button>
                  <span className="w-5 text-center text-xs font-semibold text-white tabular-nums">
                    {counts[ct.cardName]}
                  </span>
                  <button
                    onClick={() => onDraftAdjustReq?.(ct.cardName, 1)}
                    className="w-5 h-5 rounded bg-black/60 text-white text-xs font-bold
                      hover:bg-black/80 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {isDraft && (
          <button
            onClick={onToggleDraftPicker}
            title="Add requested card"
            className="absolute w-6 h-6 rounded-full bg-black/60 hover:bg-black/80
              text-white text-lg font-bold flex items-center justify-center
              border border-white/20 transition-colors"
            style={{
              top: "50%",
              left: "calc(100% + 6px)",
              transform: "translateY(-50%)",
            }}
          >
            +
          </button>
        )}
      </div>
    );
  },
);
