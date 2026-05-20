"use client";

import React, { useState } from "react";
import { Offer, CardType } from "@/schemas/types";
import { getLeaves } from "@/utils/offer-tree";
import OfferTreeOverlay, {
  computeTotalWidth,
} from "@/components/offer-tree-overlay";
import { OfferNode } from "@/components/offer-node";

type Props = {
  rootOffer: Offer;
  subtree: Offer[];
  myPlayerId: string;
  viewerPlayerId: string;
  turnPlayerId: string;
  cardLookup: Map<string, CardType>;
  hand: CardType[];
  centerCards: CardType[];
  isTurnPlayer?: boolean;
  tagWrapperRefs: React.RefObject<Map<string, HTMLDivElement>>;
  readOnly?: boolean;
  onRespond: (offerId: string, action: "accept" | "reject" | "cancel") => void;
  onAccept: (offer: Offer) => void;
  onCounter: (offer: Offer) => void;
  onToggleDraftPicker?: () => void;
  onDraftAdjustReq?: (cardName: string, delta: number) => void;
  onDraftRemoveReq?: (cardName: string) => void;
  onDraftCancel?: () => void;
  onHover?: (id: string | null) => void;
};

export default function InlineOfferTag({
  rootOffer,
  subtree,
  myPlayerId,
  viewerPlayerId,
  turnPlayerId,
  cardLookup,
  hand,
  centerCards,
  isTurnPlayer = false,
  tagWrapperRefs,
  readOnly,
  onRespond,
  onAccept,
  onCounter,
  onToggleDraftPicker,
  onDraftAdjustReq,
  onDraftRemoveReq,
  onDraftCancel,
  onHover,
}: Props) {
  const [treeOpen, setTreeOpen] = useState(false);
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);

  const leaves = getLeaves(subtree);
  const hasDraft = subtree.some((o) => o.id === "__draft__");
  const showOverlay = treeOpen || hasDraft;

  const treeWidth = showOverlay
    ? computeTotalWidth(subtree, rootOffer.id, myPlayerId, cardLookup)
    : undefined;

  if (leaves.length === 0) return null;

  const offerAccent = (offer: Offer) => {
    if (offer.target_id === "")
      return { border: "border-pink-500/80", bg: "bg-pink-900/40" };
    if (offer.creator_id !== myPlayerId)
      return { border: "border-green-600/60", bg: "bg-green-900/30" };
    return { border: "border-blue-500/80", bg: "bg-blue-900/40" };
  };

  const hasMultipleNodes =
    subtree.filter((o) => o.id !== "__draft__").length > 1;

  return (
    <div
      ref={setContainerEl}
      className="relative shrink-0"
      style={treeWidth !== undefined ? { minWidth: treeWidth } : undefined}
      onMouseLeave={() => !showOverlay && onHover?.(null)}
    >
      {/* Flat leaf row — hidden when overlay is showing, but kept for layout */}
      <div
        className="flex gap-0.5"
        style={{ height: 144, visibility: showOverlay ? "hidden" : "visible" }}
      >
        {leaves.map((leaf) => (
          <OfferNode
            key={leaf.id}
            offer={leaf}
            myPlayerId={myPlayerId}
            viewerPlayerId={viewerPlayerId}
            turnPlayerId={turnPlayerId}
            cardLookup={cardLookup}
            hand={hand}
            centerCards={centerCards}
            isTurnPlayer={isTurnPlayer}
            readOnly={readOnly}
            onRespond={onRespond}
            onAccept={onAccept}
            onCounter={onCounter}
            isDraft={leaf.id === "__draft__"}
            onToggleDraftPicker={
              leaf.id === "__draft__" ? onToggleDraftPicker : undefined
            }
            ref={(el) => {
              if (el) tagWrapperRefs.current.set(leaf.id, el);
              else tagWrapperRefs.current.delete(leaf.id);
            }}
            onMouseEnter={() => !showOverlay && onHover?.(leaf.id)}
            width={96}
            cardHeight={144}
            accent={offerAccent(leaf)}
            onCtrlClick={hasMultipleNodes && !hasDraft ? () => { setTreeOpen((v) => !v); onHover?.(null); } : undefined}
          />
        ))}

      </div>

      {showOverlay && (
        <OfferTreeOverlay
          subtree={subtree}
          rootOfferId={rootOffer.id}
          containerEl={containerEl}
          myPlayerId={myPlayerId}
          viewerPlayerId={viewerPlayerId}
          turnPlayerId={turnPlayerId}
          cardLookup={cardLookup}
          hand={hand}
          centerCards={centerCards}
          isTurnPlayer={isTurnPlayer}
          tagWrapperRefs={tagWrapperRefs}
          readOnly={readOnly}
          compact={readOnly}
          onClose={hasDraft ? () => {} : () => setTreeOpen(false)}
          onHover={onHover}
          onRespond={onRespond}
          onAccept={onAccept}
          onCounter={(offer) => {
            setTreeOpen(false);
            onHover?.(null);
            onCounter(offer);
          }}
          onToggleDraftPicker={onToggleDraftPicker}
          onDraftAdjustReq={onDraftAdjustReq}
          onDraftRemoveReq={onDraftRemoveReq}
          onDraftCancel={onDraftCancel}
        />
      )}
    </div>
  );
}
