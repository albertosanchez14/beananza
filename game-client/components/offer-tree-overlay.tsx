"use client";

import React, { useEffect, useRef } from "react";
import { CardType, ExternalPlayer, Offer } from "@/schemas/types";
import { buildChildrenMap } from "@/utils/offer-tree";
import { OfferNode } from "@/components/offer-node";

// ── Layout constants ──────────────────────────────────────────────────────────
const NODE_W = 112;
const ROOT_W = 96;
const CARD_H = 144;
const PEEK = 24; // px visible below each layer
const PEEK_OFFSET = CARD_H - PEEK; // how far each depth level is shifted down
const GAP_X = 20;

// ── Tree layout algorithm ─────────────────────────────────────────────────────

function subtreeWidth(id: string, childrenOf: Map<string, Offer[]>): number {
  const children = childrenOf.get(id) ?? [];
  if (children.length === 0) return NODE_W;
  const total = children.reduce(
    (sum, c) => sum + subtreeWidth(c.id, childrenOf),
    0,
  );
  return total + (children.length - 1) * GAP_X;
}

function assignPositions(
  id: string,
  centerX: number,
  depth: number,
  childrenOf: Map<string, Offer[]>,
  out: Map<string, { x: number; depth: number }>,
) {
  out.set(id, { x: centerX - NODE_W / 2, depth });
  const children = childrenOf.get(id) ?? [];
  if (children.length === 0) return;

  const totalW = children.reduce(
    (sum, c, i) => sum + subtreeWidth(c.id, childrenOf) + (i > 0 ? GAP_X : 0),
    0,
  );
  let curX = centerX - totalW / 2;
  for (const child of children) {
    const w = subtreeWidth(child.id, childrenOf);
    assignPositions(child.id, curX + w / 2, depth + 1, childrenOf, out);
    curX += w + GAP_X;
  }
}

function computeLayout(subtree: Offer[], rootId: string) {
  const childrenOf = buildChildrenMap(subtree);
  const totalW = subtreeWidth(rootId, childrenOf);
  const positions = new Map<string, { x: number; depth: number }>();
  assignPositions(rootId, totalW / 2, 0, childrenOf, positions);
  const maxDepth = Math.max(
    ...Array.from(positions.values()).map((p) => p.depth),
  );
  return { positions, totalW, maxDepth };
}

// ── Main overlay component ────────────────────────────────────────────────────

type Props = {
  subtree: Offer[];
  rootOfferId: string;
  containerEl?: HTMLElement | null;
  myPlayerId: string;
  players: ExternalPlayer[];
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
};

export default function OfferTreeOverlay({
  subtree,
  rootOfferId,
  containerEl,
  myPlayerId,
  players,
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

  const { positions, totalW, maxDepth } = computeLayout(subtree, rootOfferId);
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
        const nodeW = isRoot ? ROOT_W : NODE_W;
        // Leaves at top (depth=maxDepth, translateY=0); root shifted down to peek below.
        const left = isRoot ? (totalW - ROOT_W) / 2 : pos.x;
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
            variant="standalone"
            offer={offer}
            myPlayerId={myPlayerId}
            players={players}
            cardLookup={cardLookup}
            hand={hand}
            centerCards={centerCards}
            isTurnPlayer={isTurnPlayer}
            onRespond={onRespond}
            onAccept={onAccept}
            onCounter={onCounter}
            ref={(el) => {
              if (el) tagWrapperRefs.current.set(offer.id, el);
              else tagWrapperRefs.current.delete(offer.id);
            }}
            onMouseEnter={() => onHover?.(offer.id)}
            onMouseLeave={() => onHover?.(null)}
            width={nodeW}
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
