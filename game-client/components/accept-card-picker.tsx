"use client";

import { useState, useEffect, useCallback } from "react";
import { CardType, Offer, OfferCard } from "@/schemas/types";
import { CardFrontFace } from "@/components/card-front-face";

type Props = {
  offer: Offer;
  hand: CardType[];
  centerCards: CardType[];
  isTurnPlayer: boolean;
  cardLookup: Map<string, CardType>;
  onConfirm: (cardsToGive: OfferCard[]) => void;
  onClose: () => void;
};

type CardSource = { card: CardType; source: "hand" | "center" };

export default function AcceptCardPicker({
  offer,
  hand,
  centerCards,
  isTurnPlayer,
  onConfirm,
  onClose,
}: Props) {
  // Group requested cards by type with required count
  const requestedGroups: { cardType: string; needed: number }[] = [];
  const seen: Record<string, boolean> = {};
  for (const c of offer.cards_requested) {
    if (!seen[c.card_type]) {
      seen[c.card_type] = true;
      const needed = offer.cards_requested.filter((r) => r.card_type === c.card_type).length;
      requestedGroups.push({ cardType: c.card_type, needed });
    }
  }

  // Build available cards per type: hand first, then center (if turn player)
  const availableByType: Record<string, CardSource[]> = {};
  for (const { cardType } of requestedGroups) {
    const handCards = hand
      .filter((c) => c.cardName === cardType)
      .map((c): CardSource => ({ card: c, source: "hand" }));
    const centerCardsList = isTurnPlayer
      ? centerCards
          .filter((c) => c.cardName === cardType)
          .map((c): CardSource => ({ card: c, source: "center" }))
      : [];
    availableByType[cardType] = [...handCards, ...centerCardsList];
  }

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleCard = (cardId: string, cardType: string, needed: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        // Count currently selected for this type
        const selectedOfType = availableByType[cardType].filter((s) =>
          next.has(s.card.cardId),
        ).length;
        if (selectedOfType < needed) {
          next.add(cardId);
        }
      }
      return next;
    });
  };

  const isComplete = requestedGroups.every(({ cardType, needed }) => {
    const selectedOfType = availableByType[cardType].filter((s) =>
      selectedIds.has(s.card.cardId),
    ).length;
    return selectedOfType === needed;
  });

  const handleConfirm = () => {
    const cardsToGive: OfferCard[] = [];
    for (const { cardType } of requestedGroups) {
      for (const { card } of availableByType[cardType]) {
        if (selectedIds.has(card.cardId)) {
          cardsToGive.push({ card_type: cardType, card_id: card.cardId });
        }
      }
    }
    onConfirm(cardsToGive);
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Picker panel — floats above the hand */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-50 bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl p-4 flex flex-col gap-4"
        style={{ bottom: 190, maxWidth: "90vw" }}
      >
        <p className="text-xs font-semibold text-gray-300 text-center">
          Choose which cards to give
        </p>

        {requestedGroups.map(({ cardType, needed }) => {
          const available = availableByType[cardType];
          const selectedCount = available.filter((s) =>
            selectedIds.has(s.card.cardId),
          ).length;
          return (
            <div key={cardType} className="flex flex-col gap-2">
              <p className="text-[11px] text-gray-400">
                <span className="font-semibold text-gray-200">{cardType}</span>
                {" "}— select {needed}{" "}
                <span
                  className={
                    selectedCount === needed ? "text-green-400" : "text-gray-500"
                  }
                >
                  ({selectedCount}/{needed})
                </span>
              </p>

              <div className="flex gap-3">
                {available.map(({ card, source }) => {
                  const isSelected = selectedIds.has(card.cardId);
                  return (
                    <button
                      key={card.cardId}
                      onClick={() => toggleCard(card.cardId, cardType, needed)}
                      className="relative flex flex-col items-center gap-1 focus:outline-none"
                    >
                      {/* Card face */}
                      <div
                        className="relative rounded-lg overflow-hidden transition-transform duration-100"
                        style={{
                          width: 64,
                          height: 96,
                          transform: isSelected ? "scale(1.08)" : "scale(1)",
                          boxShadow: isSelected
                            ? "0 0 0 2px #22c55e, 0 4px 12px rgba(0,0,0,0.5)"
                            : "0 2px 8px rgba(0,0,0,0.4)",
                          opacity: isSelected ? 1 : 0.7,
                        }}
                      >
                        <CardFrontFace card={card} />
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                            <span className="text-white text-xl font-bold drop-shadow">✓</span>
                          </div>
                        )}
                      </div>
                      {/* Source label */}
                      <span
                        className={`text-[9px] font-semibold uppercase tracking-wide ${
                          source === "center"
                            ? "text-amber-400"
                            : "text-blue-400"
                        }`}
                      >
                        {source}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="flex gap-2 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-1.5 text-xs rounded-lg border border-gray-600 text-gray-400 hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!isComplete}
            className="flex-1 py-1.5 text-xs font-semibold rounded-lg bg-green-700 hover:bg-green-600 text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Confirm
          </button>
        </div>
      </div>
    </>
  );
}
