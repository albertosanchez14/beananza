"use client";

import React, { useState } from "react";
import { Offer, ExternalPlayer, CardType } from "@/schemas/types";
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
  tagWrapperRefs: React.RefObject<Map<string, HTMLDivElement>>;
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
  const [treeOpen, setTreeOpen] = useState(false);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  const leaves = getLeaves(subtree);

  if (leaves.length === 0) return null;

  const offerAccent = (offer: Offer) => {
    if (offer.target_id === "")
      return { border: "border-pink-500/80", bg: "bg-pink-900/40" };
    if (offer.creator_id !== myPlayerId)
      return { border: "border-green-600/60", bg: "bg-green-900/30" };
    return { border: "border-blue-500/80", bg: "bg-blue-900/40" };
  };

  const hasMultipleNodes = subtree.length > 1;

  return (
    <div
      ref={setContainerEl}
      className="relative shrink-0"
      onMouseLeave={() => !treeOpen && onHover?.(null)}
    >
      <div className="flex gap-0.5" style={{ height: 144 }}>
        {leaves.map((leaf) => (
          <OfferNode
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
            ref={(el) => {
              if (el) tagWrapperRefs.current.set(leaf.id, el);
              else tagWrapperRefs.current.delete(leaf.id);
            }}
            onMouseEnter={() => !treeOpen && onHover?.(leaf.id)}
            width={96}
            cardHeight={144}
            accent={offerAccent(leaf)}
            style={{
              opacity: treeOpen ? 0 : 1,
              pointerEvents: treeOpen ? "none" : undefined,
            }}
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
              text-[9px] text-black font-bold transition-colors`}
          >
            ⌥
          </button>
        )}
      </div>

      {treeOpen && (
        <OfferTreeOverlay
          subtree={subtree}
          rootOfferId={rootOffer.id}
          containerEl={containerEl}
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
