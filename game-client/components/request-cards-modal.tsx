"use client";

import { useState, useMemo } from "react";
import { CardType, ExternalPlayer, OfferCard } from "@/schemas/types";
import CardComponent from "@/components/card";
import { useGameContext } from "@/components/game-context";

type RequestCardsModalProps = {
  cardsRequested: CardType[];
  myHand: CardType[];
  centerCards?: CardType[];
  isTurnPlayer: boolean;
  players: ExternalPlayer[];
  defaultTargetId?: string;
  onSubmit: (cardsOffered: OfferCard[], targetPlayerId: string | undefined) => void;
  onClose: () => void;
};

type CardGroup = {
  cardName: string;
  display: CardType;
  available: CardType[];
};

function buildGroups(cards: CardType[], cardLookup: Map<string, CardType>): CardGroup[] {
  const map = new Map<string, CardGroup>();
  for (const card of cards) {
    if (!map.has(card.cardName)) {
      map.set(card.cardName, {
        cardName: card.cardName,
        display: cardLookup.get(card.cardName) ?? card,
        available: [],
      });
    }
    map.get(card.cardName)!.available.push(card);
  }
  return Array.from(map.values());
}

export default function RequestCardsModal({
  cardsRequested,
  myHand,
  centerCards,
  isTurnPlayer,
  players,
  defaultTargetId,
  onSubmit,
  onClose,
}: RequestCardsModalProps) {
  const { cardLookup } = useGameContext();
  const [selectedTargetId, setSelectedTargetId] = useState<string | undefined>(defaultTargetId);
  const [handQty, setHandQty] = useState<Record<string, number>>({});
  const [centerQty, setCenterQty] = useState<Record<string, number>>({});

  const handGroups = useMemo(
    () => buildGroups(myHand, cardLookup),
    [myHand, cardLookup],
  );
  const centerGroups = useMemo(
    () => (centerCards && centerCards.length > 0 ? buildGroups(centerCards, cardLookup) : []),
    [centerCards, cardLookup],
  );

  const hasCenterSection = centerGroups.length > 0;

  const adjust = (cardName: string, delta: number, source: "hand" | "center") => {
    const setQty = source === "hand" ? setHandQty : setCenterQty;
    const groups = source === "hand" ? handGroups : centerGroups;
    setQty((prev) => {
      const max = groups.find((g) => g.cardName === cardName)?.available.length ?? 0;
      const next = Math.max(0, Math.min(max, (prev[cardName] ?? 0) + delta));
      if (next === 0) {
        const rest = { ...prev };
        delete rest[cardName];
        return rest;
      }
      return { ...prev, [cardName]: next };
    });
  };

  const handleSubmit = () => {
    const cardsOffered: OfferCard[] = [];
    for (const group of handGroups) {
      const qty = handQty[group.cardName] ?? 0;
      for (let i = 0; i < qty; i++) {
        cardsOffered.push({ card_type: group.cardName, card_id: group.available[i].cardId });
      }
    }
    for (const group of centerGroups) {
      const qty = centerQty[group.cardName] ?? 0;
      for (let i = 0; i < qty; i++) {
        cardsOffered.push({ card_type: group.cardName, card_id: group.available[i].cardId });
      }
    }
    onSubmit(cardsOffered, selectedTargetId);
  };

  const totalOffered =
    Object.values(handQty).reduce((s, n) => s + n, 0) +
    Object.values(centerQty).reduce((s, n) => s + n, 0);

  const renderGroup = (group: CardGroup, qty: number, source: "hand" | "center") => (
    <div key={`${source}_${group.cardName}`} className="flex flex-col items-center gap-1.5">
      <CardComponent
        card={group.display}
        highlightColor={
          qty > 0 ? (source === "center" ? "#fbbf24" : "#60a5fa") : undefined
        }
        noRaise
        noTransition
      />
      <div className="flex items-center gap-1">
        <button
          onClick={() => adjust(group.cardName, -1, source)}
          disabled={qty === 0}
          className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold leading-none disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          −
        </button>
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 tabular-nums w-8 text-center">
          {qty}/{group.available.length}
        </span>
        <button
          onClick={() => adjust(group.cardName, 1, source)}
          disabled={qty >= group.available.length}
          className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold leading-none disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">
            Request cards
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 text-sm"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
          {/* Requesting chips */}
          <div>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
              Requesting
            </p>
            <div className="flex flex-wrap gap-1.5">
              {cardsRequested.map((c) => (
                <span
                  key={c.cardId}
                  className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  {c.cardName}
                </span>
              ))}
            </div>
          </div>

          {/* Target section */}
          <div>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
              {isTurnPlayer ? "Request from" : "Requesting from"}
            </p>
            {isTurnPlayer ? (
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="target"
                    checked={selectedTargetId === undefined}
                    onChange={() => setSelectedTargetId(undefined)}
                    className="accent-blue-500"
                  />
                  <span className="text-xs text-gray-700 dark:text-gray-300">Everyone</span>
                </label>
                {players.map((p) => (
                  <label key={p.playerId} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="target"
                      checked={selectedTargetId === p.playerId}
                      onChange={() => setSelectedTargetId(p.playerId)}
                      className="accent-blue-500"
                    />
                    <span className="text-xs text-gray-700 dark:text-gray-300">{p.playerName}</span>
                  </label>
                ))}
              </div>
            ) : (
              <span className="text-xs text-gray-700 dark:text-gray-300">
                {players.find((p) => p.playerId === defaultTargetId)?.playerName ?? "—"}
              </span>
            )}
          </div>

          {/* Offer section */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">
              What will you offer?{" "}
              <span className="font-normal text-gray-400">(optional)</span>
            </p>

            {handGroups.length === 0 && !hasCenterSection ? (
              <p className="text-xs text-gray-400 italic">No cards available to offer.</p>
            ) : (
              <>
                {/* Hand cards */}
                {handGroups.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {hasCenterSection && (
                      <p className="text-[11px] font-semibold text-blue-400 uppercase tracking-wide">
                        Hand
                      </p>
                    )}
                    <div className="grid grid-cols-4 gap-x-2 gap-y-4">
                      {handGroups.map((group) =>
                        renderGroup(group, handQty[group.cardName] ?? 0, "hand"),
                      )}
                    </div>
                  </div>
                )}

                {/* Center cards */}
                {hasCenterSection && (
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] font-semibold text-amber-400 uppercase tracking-wide">
                      Center
                    </p>
                    <div className="grid grid-cols-4 gap-x-2 gap-y-4">
                      {centerGroups.map((group) =>
                        renderGroup(group, centerQty[group.cardName] ?? 0, "center"),
                      )}
                    </div>
                  </div>
                )}
              </>
            )}

            {(handGroups.length > 0 || hasCenterSection) && (
              <p className={`text-xs italic transition-opacity duration-150 ${totalOffered === 0 ? "text-gray-400 opacity-100" : "opacity-0 pointer-events-none"}`}>
                Nothing selected — asking for free.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-3 rounded-lg border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2 px-3 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold transition-colors"
          >
            Request ({cardsRequested.length} card{cardsRequested.length !== 1 ? "s" : ""})
          </button>
        </div>
      </div>
    </div>
  );
}
