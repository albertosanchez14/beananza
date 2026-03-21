"use client";

import { useState } from "react";
import { CardType, OfferCard } from "@/schemas/types";
import CardComponent from "@/components/card";
import { useGameContext } from "@/components/game-context";

type RequestCardsModalProps = {
  cardsRequested: CardType[];
  myHand: CardType[];
  centerCards?: CardType[];
  onSubmit: (cardsOffered: OfferCard[]) => void;
  onClose: () => void;
};

export default function RequestCardsModal({
  cardsRequested,
  myHand,
  centerCards,
  onSubmit,
  onClose,
}: RequestCardsModalProps) {
  const { cardLookup } = useGameContext();
  const [offerSelection, setOfferSelection] = useState<CardType[]>([]);

  const handleCardClick = (e: React.MouseEvent, card: CardType) => {
    if (e.ctrlKey || e.metaKey) {
      setOfferSelection((prev) =>
        prev.some((c) => c.cardId === card.cardId)
          ? prev.filter((c) => c.cardId !== card.cardId)
          : [...prev, card],
      );
    } else {
      setOfferSelection((prev) =>
        prev.length === 1 && prev[0].cardId === card.cardId ? [] : [card],
      );
    }
  };

  const handleSubmit = () => {
    const cardsOffered: OfferCard[] = offerSelection.map((c) => ({
      card_type: c.cardName,
      card_id: c.cardId,
    }));
    onSubmit(cardsOffered);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
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

          {/* Offer back section */}
          <div>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-0.5">
              What will you offer?{" "}
              <span className="font-normal text-gray-400">(optional)</span>
            </p>
            <p className="text-xs text-gray-400 mb-3">
              Ctrl+click to select multiple
            </p>
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
              Hand cards
            </p>
            <div className="grid grid-cols-4 gap-2">
              {myHand.map((card) => (
                <div
                  key={card.cardId}
                  onClick={(e) => handleCardClick(e, card)}
                  className="cursor-pointer select-none"
                >
                  <CardComponent
                    card={cardLookup.get(card.cardName) ?? card}
                    isSelected={offerSelection.some(
                      (c) => c.cardId === card.cardId,
                    )}
                    noTransition
                  />
                </div>
              ))}
            </div>
            {centerCards && centerCards.length > 0 && (
              <>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mt-3 mb-1">
                  Center cards
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {centerCards.map((card) => (
                    <div
                      key={card.cardId}
                      onClick={(e) => handleCardClick(e, card)}
                      className="cursor-pointer select-none"
                    >
                      <CardComponent
                        card={cardLookup.get(card.cardName) ?? card}
                        isSelected={offerSelection.some(
                          (c) => c.cardId === card.cardId,
                        )}
                        noTransition
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
            {offerSelection.length === 0 && (
              <p className="mt-3 text-xs text-gray-400 italic">
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
