"use client";

import React, { useEffect, useRef } from "react";
import { CardType, Offer } from "@/schemas/types";
import { buildChildrenMap } from "@/utils/offer-tree";
import { OfferNode } from "@/components/offer-node";

// ── Layout constants ──────────────────────────────────────────────────────────
const NODE_W = 112;
const ROOT_W = 96;
const CARD_H = 144;
const PEEK = 24; // px visible below each layer
const PEEK_OFFSET = CARD_H - PEEK; // how far each depth level is shifted down
const GAP_X = 20;

// ── Actual node width (mirrors OfferNode's own nodeWidth computation) ─────────

function resolvedNodeWidth(
  offer: Offer,
  rootOfferId: string,
  myPlayerId: string,
  cardLookup: Map<string, CardType>,
): number {
  const isRoot = offer.id === rootOfferId;
  const baseW = isRoot ? ROOT_W : NODE_W;
  const isIncoming = offer.creator_id !== myPlayerId;
  const relevantCards = isIncoming
    ? offer.cards_offered
    : offer.cards_requested;
  const uniqueTypes = Array.from(
    new Set(relevantCards.map((c) => c.card_type)),
  ).filter((t) => cardLookup.has(t));
  const count = Math.max(uniqueTypes.length, 1);
  return count > 1 ? baseW * count : baseW;
}

// ── Tree layout algorithm ─────────────────────────────────────────────────────

function subtreeWidth(
  id: string,
  childrenOf: Map<string, Offer[]>,
  widths: Map<string, number>,
): number {
  const children = childrenOf.get(id) ?? [];
  const myW = widths.get(id) ?? NODE_W;
  if (children.length === 0) return myW;
  const childrenSpan =
    children.reduce(
      (sum, c) => sum + subtreeWidth(c.id, childrenOf, widths),
      0,
    ) +
    (children.length - 1) * GAP_X;
  return Math.max(myW, childrenSpan);
}

function assignPositions(
  id: string,
  centerX: number,
  depth: number,
  childrenOf: Map<string, Offer[]>,
  widths: Map<string, number>,
  out: Map<string, { x: number; depth: number }>,
) {
  const myW = widths.get(id) ?? NODE_W;
  out.set(id, { x: centerX - myW / 2, depth });
  const children = childrenOf.get(id) ?? [];
  if (children.length === 0) return;

  const totalW = children.reduce(
    (sum, c, i) =>
      sum + subtreeWidth(c.id, childrenOf, widths) + (i > 0 ? GAP_X : 0),
    0,
  );
  let curX = centerX - totalW / 2;
  for (const child of children) {
    const w = subtreeWidth(child.id, childrenOf, widths);
    assignPositions(child.id, curX + w / 2, depth + 1, childrenOf, widths, out);
    curX += w + GAP_X;
  }
}

function computeLayout(
  subtree: Offer[],
  rootId: string,
  myPlayerId: string,
  cardLookup: Map<string, CardType>,
) {
  const childrenOf = buildChildrenMap(subtree);
  const widths = new Map<string, number>();
  for (const offer of subtree) {
    widths.set(
      offer.id,
      resolvedNodeWidth(offer, rootId, myPlayerId, cardLookup),
    );
  }
  const totalW = subtreeWidth(rootId, childrenOf, widths);
  const positions = new Map<string, { x: number; depth: number }>();
  assignPositions(rootId, totalW / 2, 0, childrenOf, widths, positions);
  let maxDepth = 0;
  for (const { depth } of positions.values()) {
    if (depth > maxDepth) maxDepth = depth;
  }
  return { positions, totalW, maxDepth, widths };
}

/** Returns the total pixel width the overlay will occupy for a given subtree. */
export function computeTotalWidth(
  subtree: Offer[],
  rootId: string,
  myPlayerId: string,
  cardLookup: Map<string, CardType>,
): number {
  const childrenOf = buildChildrenMap(subtree);
  const widths = new Map<string, number>();
  for (const offer of subtree) {
    widths.set(
      offer.id,
      resolvedNodeWidth(offer, rootId, myPlayerId, cardLookup),
    );
  }
  return subtreeWidth(rootId, childrenOf, widths);
}

// ── Main overlay component ────────────────────────────────────────────────────

type Props = {
  subtree: Offer[];
  rootOfferId: string;
  containerEl?: HTMLElement | null;
  myPlayerId: string;
  cardLookup: Map<string, CardType>;
  hand: CardType[];
  centerCards: CardType[];
  isTurnPlayer: boolean;
  tagWrapperRefs: React.RefObject<Map<string, HTMLDivElement>>;
  onClose: () => void;
  onHover?: (id: string | null) => void;
  onRespond: (offerId: string, action: "accept" | "reject" | "cancel") => void;
  onAccept: (offer: Offer) => void;
  onCounter: (offer: Offer) => void;
  onToggleDraftPicker?: () => void;
  onDraftAdjustReq?: (cardName: string, delta: number) => void;
  onDraftRemoveReq?: (cardName: string) => void;
  onDraftCancel?: () => void;
};

export default function OfferTreeOverlay({
  subtree,
  rootOfferId,
  containerEl,
  myPlayerId,
  cardLookup,
  hand,
  centerCards,
  isTurnPlayer,
  tagWrapperRefs,
  onClose,
  onHover,
  onRespond,
  onAccept,
  onCounter,
  onToggleDraftPicker,
  onDraftAdjustReq,
  onDraftRemoveReq,
  onDraftCancel,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Click outside to close (also exclude the InlineOfferTag container)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        overlayRef.current &&
        !overlayRef.current.contains(e.target as Node) &&
        (!containerEl || !containerEl.contains(e.target as Node))
      ) {
        onClose();
      }
    };
    // Delay to avoid the opening click closing it immediately
    const timeout = setTimeout(
      () => document.addEventListener("mousedown", handler),
      0,
    );
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose, containerEl]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const { positions, totalW, maxDepth, widths } = computeLayout(
    subtree,
    rootOfferId,
    myPlayerId,
    cardLookup,
  );
  // Root stays at Y=0 (same level as inline nodes); each child is pushed up by PEEK_OFFSET.
  // Total height = root card + upward extent.
  const overlayH = CARD_H + maxDepth * PEEK_OFFSET;

  return (
    <div
      ref={overlayRef}
      style={{
        position: "absolute",
        top: -(maxDepth * PEEK_OFFSET),
        left: "50%",
        transform: "translateX(-50%)",
        width: totalW,
        height: overlayH,
        zIndex: 10000,
      }}
    >
      {subtree.map((offer) => {
        const pos = positions.get(offer.id);
        if (!pos) return null;
        const isRoot = offer.id === rootOfferId;
        // baseW is passed to OfferNode, which multiplies by card count itself.
        const baseW = isRoot ? ROOT_W : NODE_W;
        // actualW (from widths) is the fully-expanded width used for positioning.
        const actualW = widths.get(offer.id) ?? baseW;
        // Leaves at top (depth=maxDepth, translateY=0); root shifted down to peek below.
        const left = isRoot ? (totalW - actualW) / 2 : pos.x;
        const translateY = (maxDepth - pos.depth) * PEEK_OFFSET;
        const accent =
          offer.target_id === ""
            ? { border: "border-pink-500/80", bg: "bg-pink-900/40" }
            : offer.creator_id !== myPlayerId
              ? { border: "border-green-600/60", bg: "bg-green-900/30" }
              : { border: "border-blue-500/80", bg: "bg-blue-900/40" };
        return (
          <OfferNode
            key={offer.id}
            offer={offer}
            myPlayerId={myPlayerId}
            cardLookup={cardLookup}
            hand={hand}
            centerCards={centerCards}
            isTurnPlayer={isTurnPlayer}
            onRespond={onRespond}
            onAccept={onAccept}
            onCounter={onCounter}
            isDraft={offer.id === "__draft__"}
            onToggleDraftPicker={
              offer.id === "__draft__" ? onToggleDraftPicker : undefined
            }
            onDraftAdjustReq={
              offer.id === "__draft__" ? onDraftAdjustReq : undefined
            }
            onDraftRemoveReq={
              offer.id === "__draft__" ? onDraftRemoveReq : undefined
            }
            onDraftCancel={offer.id === "__draft__" ? onDraftCancel : undefined}
            ref={(el) => {
              if (el) tagWrapperRefs.current.set(offer.id, el);
              else tagWrapperRefs.current.delete(offer.id);
            }}
            onMouseEnter={() => onHover?.(offer.id)}
            onMouseLeave={() => onHover?.(null)}
            width={baseW}
            cardHeight={CARD_H}
            style={{
              position: "absolute",
              left,
              top: 0,
              transform: `translateY(${translateY}px)`,
              zIndex: pos.depth,
            }}
            accent={accent}
          />
        );
      })}
    </div>
  );
}
