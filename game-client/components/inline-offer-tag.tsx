"use client";

import React, { useState, useRef } from "react";
import { Offer, ExternalPlayer, CardType } from "@/schemas/types";
import { canAcceptOffer } from "@/components/offer-card";
import { getLeaves } from "@/utils/offer-tree";
import OfferTreeOverlay from "@/components/offer-tree-overlay";
import { OfferNode } from "@/components/offer-node";

type Props = {
  rootOffer: Offer;
  subtree: Offer[];
  players: ExternalPlayer[];
  myPlayerId: string;
  cardLookup: Map<string, CardType>;
  hand: CardType[];
  centerCards: CardType[];
  isTurnPlayer?: boolean;
  tagWrapperRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  onRespond: (offerId: string, action: "accept" | "reject" | "cancel") => void;
  onAccept: (offer: Offer) => void;
  onCounter: (offer: Offer) => void;
  onHover?: (id: string | null) => void;
};

export default function InlineOfferTag({
  rootOffer,
  subtree,
  players,
  myPlayerId,
  cardLookup,
  hand,
  centerCards,
  isTurnPlayer = false,
  tagWrapperRefs,
  onRespond,
  onAccept,
  onCounter,
  onHover,
}: Props) {
  const isIncoming = rootOffer.creator_id !== myPlayerId;
  const isBroadcast = rootOffer.target_id === "";
  const [treeOpen, setTreeOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const leaves = getLeaves(subtree);

  if (leaves.length === 0) return null;

  const accent = isBroadcast
    ? { border: "border-pink-500/80", bg: "bg-pink-900/40" }
    : isIncoming
      ? { border: "border-green-600/60", bg: "bg-green-900/30" }
      : { border: "border-blue-500/80", bg: "bg-blue-900/40" };

  const hasMultipleNodes = subtree.length > 1;

  return (
    <div
      ref={containerRef}
      className="relative shrink-0"
      onMouseLeave={() => !treeOpen && onHover?.(null)}
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

      <div className="flex" style={{ height: 144 }}>
        {leaves.map((leaf) => (
          <OfferNode
            key={leaf.id}
            variant="inline"
            offer={leaf}
            myPlayerId={myPlayerId}
            cardLookup={cardLookup}
            hand={hand}
            centerCards={centerCards}
            isTurnPlayer={isTurnPlayer}
            onRespond={onRespond}
            onAccept={onAccept}
            onCounter={onCounter}
            nodeRef={(el) => {
              if (el) tagWrapperRefs.current.set(leaf.id, el);
              else tagWrapperRefs.current.delete(leaf.id);
            }}
            onMouseEnter={() => !treeOpen && onHover?.(leaf.id)}
            width={96}
            cardHeight={144}
            accent={accent}
            style={{ opacity: "45%" }}
          />
        ))}

        {hasMultipleNodes && (
          <button
            onClick={() => {
              setTreeOpen((v) => !v);
              onHover?.(null);
            }}
            title="Show offer history"
            className={`absolute top-1 left-1 z-20 w-5 h-5
              flex items-center justify-center rounded-full border
              text-[9px] font-bold transition-colors
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

      {treeOpen && (
        <OfferTreeOverlay
          subtree={subtree}
          rootOfferId={rootOffer.id}
          containerEl={containerRef?.current}
          myPlayerId={myPlayerId}
          players={players}
          cardLookup={cardLookup}
          hand={hand}
          centerCards={centerCards}
          isTurnPlayer={isTurnPlayer}
          tagWrapperRefs={tagWrapperRefs}
          onClose={() => setTreeOpen(false)}
          onHover={onHover}
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
