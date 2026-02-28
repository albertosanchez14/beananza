"use client";

import { useState } from "react";
import { Offer, OfferCard, ExternalPlayer, CardType } from "@/schemas/types";

type OfferCardProps = {
  offer: Offer;
  allOffers: Offer[]; // needed to render children
  myPlayerId: string;
  myHand: CardType[];
  players: ExternalPlayer[];
  gamePhase: string;
  depth?: number;
  onAccept: (offerId: string) => void;
  onReject: (offerId: string) => void;
  onCancel: (offerId: string) => void;
  onCounter: (offerId: string) => void;
};

function playerName(
  playerId: string,
  players: ExternalPlayer[],
  myPlayerId: string,
): string {
  if (!playerId) return "Anyone";
  if (playerId === myPlayerId) return "You";
  return players.find((p) => p.playerId === playerId)?.playerName ?? playerId;
}

function cardChips(cards: OfferCard[]) {
  // Group by card_type and count
  const counts = cards.reduce<Record<string, number>>((acc, c) => {
    acc[c.card_type] = (acc[c.card_type] ?? 0) + 1;
    return acc;
  }, {});

  if (Object.keys(counts).length === 0) {
    return (
      <span className="text-xs text-gray-400 italic">nothing specified</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {Object.entries(counts).map(([type, qty]) => (
        <span
          key={type}
          className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 text-xs rounded-full border border-blue-200 dark:border-blue-700"
        >
          {type} ×{qty}
        </span>
      ))}
    </div>
  );
}

// Determine who is allowed to accept / reject this offer
function canAcceptOrReject(
  offer: Offer,
  myPlayerId: string,
  allOffers: Offer[],
): boolean {
  if (offer.status !== "pending") return false;
  if (offer.parent_offer_id === "") {
    // Root offer: any non-creator; if targeted, only the target
    if (myPlayerId === offer.creator_id) return false;
    if (offer.target_id !== "" && myPlayerId !== offer.target_id) return false;
    return true;
  } else {
    // Counteroffer: only the parent offer's creator
    const parent = allOffers.find((o) => o.id === offer.parent_offer_id);
    return parent ? myPlayerId === parent.creator_id : false;
  }
}

function canCancel(offer: Offer, myPlayerId: string): boolean {
  return offer.status === "pending" && offer.creator_id === myPlayerId;
}

// Returns true if myHand contains at least the card types+quantities in cards_requested.
function canFulfillOffer(requested: OfferCard[], myHand: CardType[]): boolean {
  // Count required quantities per card type
  const required: Record<string, number> = {};
  for (const c of requested) {
    required[c.card_type] = (required[c.card_type] ?? 0) + 1;
  }
  // Count available quantities per card type in hand
  const available: Record<string, number> = {};
  for (const c of myHand) {
    available[c.cardName] = (available[c.cardName] ?? 0) + 1;
  }
  return Object.entries(required).every(
    ([type, qty]) => (available[type] ?? 0) >= qty,
  );
}

function canCounter(
  offer: Offer,
  myPlayerId: string,
  gamePhase: string,
): boolean {
  return (
    offer.status === "pending" &&
    offer.creator_id !== myPlayerId &&
    gamePhase === "turnTrade"
  );
}

function borderColor(offer: Offer, myPlayerId: string): string {
  if (offer.status !== "pending") return "border-gray-200 dark:border-gray-700";
  if (offer.creator_id === myPlayerId) return "border-blue-400";
  if (offer.target_id === myPlayerId || offer.target_id === "")
    return "border-green-400";
  return "border-gray-300 dark:border-gray-600";
}

function bgColor(offer: Offer, myPlayerId: string): string {
  if (offer.status !== "pending")
    return "bg-gray-50 dark:bg-gray-800/50 opacity-60";
  if (offer.creator_id === myPlayerId)
    return "bg-blue-50 dark:bg-blue-900/20";
  if (offer.target_id === myPlayerId || offer.target_id === "")
    return "bg-green-50 dark:bg-green-900/20";
  return "bg-white dark:bg-gray-800";
}

function statusBadge(status: Offer["status"]) {
  const map: Record<Offer["status"], { label: string; cls: string }> = {
    pending: { label: "Pending", cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
    accepted: { label: "Accepted", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
    rejected: { label: "Rejected", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
    cancelled: { label: "Cancelled", cls: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400" },
    expired: { label: "Expired", cls: "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-500" },
  };
  const { label, cls } = map[status];
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {label}
    </span>
  );
}

export default function OfferCardComponent({
  offer,
  allOffers,
  myPlayerId,
  myHand,
  players,
  gamePhase,
  depth = 0,
  onAccept,
  onReject,
  onCancel,
  onCounter,
}: OfferCardProps) {
  const [showChildren, setShowChildren] = useState(true);

  const children = allOffers.filter((o) => o.parent_offer_id === offer.id);
  const pendingChildren = children.filter((c) => c.status === "pending").length;

  const allowAcceptReject = canAcceptOrReject(offer, myPlayerId, allOffers);
  const allowCancel = canCancel(offer, myPlayerId);
  const allowCounter = canCounter(offer, myPlayerId, gamePhase);
  const canFulfill = allowAcceptReject && canFulfillOffer(offer.cards_requested, myHand);

  const isOwn = offer.creator_id === myPlayerId;
  const directionLabel = isOwn
    ? `You → ${playerName(offer.target_id, players, myPlayerId)}`
    : `${playerName(offer.creator_id, players, myPlayerId)} → ${playerName(offer.target_id, players, myPlayerId) || "Anyone"}`;

  return (
    <div className={`${depth > 0 ? "ml-4 mt-2" : ""}`}>
      <div
        className={`rounded-lg border-2 p-3 transition-all duration-200 ${borderColor(offer, myPlayerId)} ${bgColor(offer, myPlayerId)}`}
      >
        {/* Header row */}
        <div className="flex items-center justify-between mb-2 gap-2">
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">
            {depth > 0 ? "↩ Counter: " : ""}{directionLabel}
          </span>
          {statusBadge(offer.status)}
        </div>

        {/* Cards offered */}
        <div className="flex items-start gap-1.5 mb-1.5">
          <span className="text-xs text-gray-500 dark:text-gray-400 w-14 shrink-0 pt-0.5">
            Offers:
          </span>
          {cardChips(offer.cards_offered)}
        </div>

        {/* Cards requested */}
        <div className="flex items-start gap-1.5 mb-3">
          <span className="text-xs text-gray-500 dark:text-gray-400 w-14 shrink-0 pt-0.5">
            Wants:
          </span>
          {cardChips(offer.cards_requested)}
        </div>

        {/* Action buttons */}
        {offer.status === "pending" && (
          <div className="flex flex-wrap gap-1.5">
            {allowAcceptReject && (
              <>
                <button
                  onClick={() => canFulfill && onAccept(offer.id)}
                  disabled={!canFulfill}
                  title={
                    canFulfill
                      ? "Accept this offer"
                      : "You don't have the required cards"
                  }
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                    canFulfill
                      ? "bg-green-500 hover:bg-green-600 text-white cursor-pointer"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                  }`}
                >
                  Accept
                </button>
                <button
                  onClick={() => onReject(offer.id)}
                  className="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-400 hover:bg-red-500 text-white transition-colors"
                >
                  Reject
                </button>
              </>
            )}
            {allowCounter && (
              <button
                onClick={() => onCounter(offer.id)}
                className="px-2.5 py-1 rounded-md text-xs font-semibold bg-yellow-400 hover:bg-yellow-500 text-white transition-colors"
              >
                Counter
              </button>
            )}
            {allowCancel && (
              <button
                onClick={() => onCancel(offer.id)}
                className="px-2.5 py-1 rounded-md text-xs font-semibold border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        )}

        {/* Children toggle */}
        {children.length > 0 && (
          <button
            onClick={() => setShowChildren((v) => !v)}
            className="mt-2 text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 flex items-center gap-1"
          >
            {showChildren ? "▾" : "▸"}
            {children.length} counteroffer{children.length !== 1 ? "s" : ""}
            {pendingChildren > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 rounded-full text-xs">
                {pendingChildren} pending
              </span>
            )}
          </button>
        )}
      </div>

      {/* Recursive children */}
      {showChildren &&
        children.map((child) => (
          <OfferCardComponent
            key={child.id}
            offer={child}
            allOffers={allOffers}
            myPlayerId={myPlayerId}
            myHand={myHand}
            players={players}
            gamePhase={gamePhase}
            depth={depth + 1}
            onAccept={onAccept}
            onReject={onReject}
            onCancel={onCancel}
            onCounter={onCounter}
          />
        ))}
    </div>
  );
}
