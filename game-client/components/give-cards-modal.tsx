"use client";

import { useState } from "react";
import { CardType, ExternalPlayer, OfferCard, CARD_TYPES } from "@/schemas/types";
import CardComponent from "@/components/card";
import { useGameContext } from "@/components/game-context";

type GiveCardsModalProps = {
  player: ExternalPlayer;
  cardsToGive: CardType[];
  onSubmit: (cardsRequested: OfferCard[]) => void;
  onClose: () => void;
};

export default function GiveCardsModal({
  player,
  cardsToGive,
  onSubmit,
  onClose,
}: GiveCardsModalProps) {
  const { cardLookup } = useGameContext();
  const [receiveTypes, setReceiveTypes] = useState<string[]>([]);

  const handleTypeClick = (e: React.MouseEvent, type: string) => {
    if (e.ctrlKey || e.metaKey) {
      setReceiveTypes((prev) =>
        prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
      );
    } else {
      setReceiveTypes((prev) =>
        prev.length === 1 && prev[0] === type ? [] : [type],
      );
    }
  };

  const handleSubmit = () => {
    const cardsRequested: OfferCard[] = receiveTypes.map((t) => ({
      card_type: t,
      card_id: "",
    }));
    onSubmit(cardsRequested);
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
            Give cards to{" "}
            <span className="text-blue-500">{player.playerName}</span>
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 text-sm"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
          {/* Giving chips */}
          <div>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
              Giving
            </p>
            <div className="flex flex-wrap gap-1.5">
              {cardsToGive.map((c) => (
                <span
                  key={c.cardId}
                  className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  {c.cardName}
                </span>
              ))}
            </div>
          </div>

          {/* Receive back section */}
          <div>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-0.5">
              What do you want back?{" "}
              <span className="font-normal text-gray-400">(optional)</span>
            </p>
            <p className="text-xs text-gray-400 mb-3">
              Ctrl+click to select multiple
            </p>
            <div className="grid grid-cols-4 gap-2">
              {CARD_TYPES.map((type) => (
                <div
                  key={type}
                  onClick={(e) => handleTypeClick(e, type)}
                  className="cursor-pointer select-none"
                >
                  <CardComponent
                    card={
                      cardLookup.get(type) ?? {
                        backImage: "",
                        cardId: "",
                        cardName: type,
                      }
                    }
                    isSelected={receiveTypes.includes(type)}
                    noTransition
                  />
                </div>
              ))}
            </div>
            {receiveTypes.length === 0 && (
              <p className="mt-3 text-xs text-gray-400 italic">
                Nothing selected — this will be an unconditional gift.
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
            className="flex-1 py-2 px-3 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-semibold transition-colors"
          >
            Give ({cardsToGive.length} card{cardsToGive.length !== 1 ? "s" : ""})
          </button>
        </div>
      </div>
    </div>
  );
}
