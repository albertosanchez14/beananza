"use client";

import { useEffect, useRef, CSSProperties } from "react";
import { createPortal } from "react-dom";
import { CardType, ExternalPlayer, Offer, OfferCard } from "@/schemas/types";
import { CardFrontFace } from "@/components/card-front-face";
import { canAcceptOffer } from "@/components/offer-card";
import { buildChildrenMap } from "@/utils/offer-tree";

// ── Layout constants ──────────────────────────────────────────────────────────
const NODE_W = 112;
const NODE_H = 190; // card (144) + buttons row (~34) + name (~12)
const GAP_X = 20;
const GAP_Y = 64;

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
  y: number,
  childrenOf: Map<string, Offer[]>,
  out: Map<string, { x: number; y: number }>,
) {
  out.set(id, { x: centerX - NODE_W / 2, y });
  const children = childrenOf.get(id) ?? [];
  if (children.length === 0) return;

  const totalW = children.reduce(
    (sum, c, i) =>
      sum + subtreeWidth(c.id, childrenOf) + (i > 0 ? GAP_X : 0),
    0,
  );
  let curX = centerX - totalW / 2;
  for (const child of children) {
    const w = subtreeWidth(child.id, childrenOf);
    assignPositions(child.id, curX + w / 2, y - (NODE_H + GAP_Y), childrenOf, out);
    curX += w + GAP_X;
  }
}

function computeLayout(subtree: Offer[], rootId: string) {
  const childrenOf = buildChildrenMap(subtree);

  // Compute max depth so root sits at the bottom
  const depths = new Map<string, number>();
  const depthQueue: [string, number][] = [[rootId, 0]];
  while (depthQueue.length > 0) {
    const [id, d] = depthQueue.shift()!;
    depths.set(id, d);
    for (const c of childrenOf.get(id) ?? []) depthQueue.push([c.id, d + 1]);
  }
  const maxDepth = Math.max(...depths.values());

  const totalW = subtreeWidth(rootId, childrenOf);
  const totalH = (maxDepth + 1) * NODE_H + maxDepth * GAP_Y;

  const positions = new Map<string, { x: number; y: number }>();
  // Root sits at the bottom row; y=0 is the top of the canvas
  const rootY = maxDepth * (NODE_H + GAP_Y);
  assignPositions(rootId, totalW / 2, rootY, childrenOf, positions);

  return { positions, totalW, totalH, childrenOf };
}

// ── SVG connector path ────────────────────────────────────────────────────────

function connectorPath(
  px: number, py: number, // parent node top-left
  cx: number, cy: number, // child node top-left
): string {
  // child is above parent (cy < py) — line from child's bottom-center to parent's top-center
  const x1 = cx + NODE_W / 2;
  const y1 = cy + NODE_H;
  const x2 = px + NODE_W / 2;
  const y2 = py;
  const mid = (y1 + y2) / 2;
  return `M ${x1} ${y1} C ${x1} ${mid} ${x2} ${mid} ${x2} ${y2}`;
}

// ── Node rendering ────────────────────────────────────────────────────────────

type NodeProps = {
  offer: Offer;
  myPlayerId: string;
  players: ExternalPlayer[];
  cardLookup: Map<string, CardType>;
  hand: CardType[];
  centerCards: CardType[];
  isTurnPlayer: boolean;
  onRespond: (offerId: string, action: "accept" | "reject" | "cancel") => void;
  onAccept: (offer: Offer) => void;
  onCounter: (offer: Offer) => void;
  style: CSSProperties;
};

function TreeNode({
  offer,
  myPlayerId,
  players,
  cardLookup,
  hand,
  centerCards,
  isTurnPlayer,
  onRespond,
  onAccept,
  onCounter,
  style,
}: NodeProps) {
  const isIncoming = offer.creator_id !== myPlayerId;
  const creator = players.find((p) => p.playerId === offer.creator_id);
  const isPending = offer.status === "pending";

  // Cards to display: what the current player receives
  const relevantCards = isIncoming ? offer.cards_offered : offer.cards_requested;
  const counts: Record<string, number> = {};
  for (const c of relevantCards) {
    counts[c.card_type] = (counts[c.card_type] ?? 0) + 1;
  }
  const cardTypes = Object.keys(counts)
    .map((t) => cardLookup.get(t))
    .filter((ct): ct is CardType => ct !== undefined);

  const isFree = relevantCards.length === 0;
  const canAccept =
    isIncoming && isPending && canAcceptOffer(offer, hand, centerCards, isTurnPlayer);

  const accent = isIncoming
    ? { border: "border-green-600/60", bg: "bg-green-900/30" }
    : { border: "border-blue-500/60", bg: "bg-blue-900/30" };

  const statusColor: Record<string, string> = {
    pending: "bg-yellow-600/80 text-yellow-100",
    accepted: "bg-green-700/80 text-green-100",
    rejected: "bg-red-700/80 text-red-100",
    cancelled: "bg-gray-600/80 text-gray-200",
    expired: "bg-gray-600/80 text-gray-200",
  };

  return (
    <div
      style={{ ...style, width: NODE_W, position: "absolute" }}
      className="flex flex-col"
    >
      {/* Card ghost area */}
      <div
        className={`rounded-xl border-2 overflow-hidden flex flex-row ${accent.border} ${accent.bg}`}
        style={{ height: 144, position: "relative" }}
      >
        {isFree ? (
          <div className="flex-1 flex items-center justify-center opacity-40">
            <svg viewBox="0 0 96 144" className="w-full h-full" preserveAspectRatio="none">
              <line x1="8" y1="8" x2="88" y2="136" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="88" y1="8" x2="8" y2="136" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        ) : (
          cardTypes.map((ct) => (
            <div
              key={ct.cardName}
              className="relative shrink-0 border-r border-white/10 last:border-r-0"
              style={{ width: NODE_W / Math.max(cardTypes.length, 1), height: 144 }}
            >
              <div className="absolute inset-0" style={{ opacity: 0.5 }}>
                <CardFrontFace card={ct} />
              </div>
              {counts[ct.cardName] > 1 && (
                <div className="absolute top-1 right-1 min-w-4 h-4 flex items-center justify-center px-0.5 rounded-full bg-white/20 text-white text-[9px] font-bold border border-white/30 pointer-events-none z-10">
                  {counts[ct.cardName]}
                </div>
              )}
            </div>
          ))
        )}

        {/* Status badge */}
        <div className="absolute top-1 left-1 z-10">
          <span className={`text-[8px] font-semibold px-1.5 py-0.5 rounded-full ${statusColor[offer.status] ?? statusColor.expired}`}>
            {offer.status}
          </span>
        </div>
      </div>

      {/* Creator name */}
      <div className="text-[9px] text-white/60 text-center truncate px-1 mt-0.5">
        {creator?.playerName ?? offer.creator_id.slice(0, 8)}
      </div>

      {/* Action buttons */}
      {isPending && (
        <div className="flex gap-0.5 mt-0.5">
          {isIncoming ? (
            <>
              <button
                onClick={() => onAccept(offer)}
                disabled={!canAccept}
                title={canAccept ? "Accept" : "Missing cards"}
                className="flex-1 text-[8px] font-semibold py-0.5 rounded bg-green-700/70 hover:bg-green-600 text-green-200 border border-green-600/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
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
      )}
    </div>
  );
}

// ── Main overlay component ────────────────────────────────────────────────────

type Props = {
  subtree: Offer[];
  rootOfferId: string;
  anchorEl: HTMLElement;
  myPlayerId: string;
  players: ExternalPlayer[];
  cardLookup: Map<string, CardType>;
  hand: CardType[];
  centerCards: CardType[];
  isTurnPlayer: boolean;
  onClose: () => void;
  onRespond: (offerId: string, action: "accept" | "reject" | "cancel") => void;
  onAccept: (offer: Offer) => void;
  onCounter: (offer: Offer) => void;
};

export default function OfferTreeOverlay({
  subtree,
  rootOfferId,
  anchorEl,
  myPlayerId,
  players,
  cardLookup,
  hand,
  centerCards,
  isTurnPlayer,
  onClose,
  onRespond,
  onAccept,
  onCounter,
}: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  // Position above the anchor element
  const anchorRect = anchorEl.getBoundingClientRect();

  // Click outside to close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to avoid the opening click closing it immediately
    const timeout = setTimeout(() => document.addEventListener("mousedown", handler), 0);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener("mousedown", handler);
    };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const { positions, totalW, totalH, childrenOf } = computeLayout(subtree, rootOfferId);
  const offerById = new Map(subtree.map((o) => [o.id, o]));

  // Compute panel position: centered on anchor, above it
  const PANEL_MAX_W = Math.min(totalW + 48, window.innerWidth * 0.9);
  const PANEL_MAX_H = Math.min(totalH + 48, window.innerHeight * 0.65);

  const anchorCenterX = anchorRect.left + anchorRect.width / 2;
  let left = anchorCenterX - PANEL_MAX_W / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - PANEL_MAX_W - 8));

  const spaceAbove = anchorRect.top - 8;
  const panelH = Math.min(PANEL_MAX_H, spaceAbove);
  const top = anchorRect.top - panelH - 8;

  const content = (
    <div
      ref={overlayRef}
      style={{
        position: "fixed",
        top,
        left,
        width: PANEL_MAX_W,
        height: panelH,
        zIndex: 10000,
      }}
      className="rounded-2xl border border-white/20 bg-[#1a120a]/95 backdrop-blur-sm shadow-2xl flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 shrink-0">
        <span className="text-xs font-semibold text-white/70">Offer History</span>
        <button
          onClick={onClose}
          className="text-white/40 hover:text-white/80 transition-colors text-sm leading-none"
        >
          ✕
        </button>
      </div>

      {/* Tree canvas with scroll */}
      <div className="flex-1 overflow-auto p-4">
        <div style={{ width: totalW, height: totalH, position: "relative" }}>
          {/* SVG connector lines */}
          <svg
            style={{ position: "absolute", inset: 0, width: totalW, height: totalH, pointerEvents: "none", overflow: "visible" }}
          >
            {subtree.map((offer) => {
              if (!offer.parent_offer_id) return null;
              const parentPos = positions.get(offer.parent_offer_id);
              const childPos = positions.get(offer.id);
              if (!parentPos || !childPos) return null;
              return (
                <path
                  key={offer.id}
                  d={connectorPath(parentPos.x, parentPos.y, childPos.x, childPos.y)}
                  fill="none"
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth={1.5}
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {subtree.map((offer) => {
            const pos = positions.get(offer.id);
            if (!pos) return null;
            return (
              <TreeNode
                key={offer.id}
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
                style={{ left: pos.x, top: pos.y }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
