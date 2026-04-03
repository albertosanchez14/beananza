"use client";

import { useState } from "react";
import {
  CardType,
  ExternalPlayer,
  OfferCard,
} from "@/schemas/types";
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
  const [quantities, setQuantities] = useState<Record<string, number>>({});

  const adjust = (type: string, delta: number) => {
    setQuantities((prev) => {
      const next = Math.max(0, (prev[type] ?? 0) + delta);
      if (next === 0) {
        const rest = { ...prev };
        delete rest[type];
        return rest;
      }
      return { ...prev, [type]: next };
    });
  };

  const handleSubmit = () => {
    const cardsRequested: OfferCard[] = [];
    for (const [type, qty] of Object.entries(quantities)) {
      for (let i = 0; i < qty; i++) {
        cardsRequested.push({ card_type: type, card_id: "" });
      }
    }
    onSubmit(cardsRequested);
  };

  const totalRequested = Object.values(quantities).reduce((s, n) => s + n, 0);

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <div
        className="relative bg-white dark:bg-gray-900 
				rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] 
				flex flex-col overflow-hidden"
      >
        <div
          className="flex items-center justify-between px-4 py-3 
					border-b border-gray-200 dark:border-gray-700"
        >
          <h2 className="text-sm font-bold text-gray-800 dark:text-gray-100">
            Give cards to{" "}
            <span className="text-blue-500">{player.playerName}</span>
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center 
						rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 
						text-gray-500 text-sm"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2">
              Giving
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(() => {
                const groups = new Map<string, number>();
                for (const c of cardsToGive)
                  groups.set(c.cardName, (groups.get(c.cardName) ?? 0) + 1);
                return Array.from(groups.entries()).map(([name, qty]) => (
                  <span
                    key={name}
                    className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 
										text-xs font-medium text-gray-700 dark:text-gray-300"
                  >
                    {qty} x {name}
                  </span>
                ));
              })()}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-3">
              What do you want back?{" "}
              <span className="font-normal text-gray-400">(optional)</span>
            </p>
            <div className="grid grid-cols-4 gap-x-2 gap-y-4">
              {Array.from(cardLookup.entries()).map(([type, card]) => {
                const qty = quantities[type] ?? 0;
                return (
                  <div
                    key={type}
                    className="flex flex-col items-center gap-1.5"
                  >
                    <CardComponent
                      card={card}
                      highlightColor={qty > 0 ? "#60a5fa" : undefined}
                      noRaise
                      noTransition
                    />
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => adjust(type, -1)}
                        disabled={qty === 0}
                        className="w-5 h-5 rounded bg-gray-200 
												dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 
												text-gray-700 dark:text-gray-200 text-xs font-bold leading-none 
												disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        −
                      </button>
                      <span
                        className="text-xs font-semibold text-gray-700 
												dark:text-gray-200 tabular-nums w-4 text-center"
                      >
                        {qty}
                      </span>
                      <button
                        onClick={() => adjust(type, 1)}
                        className="w-5 h-5 rounded bg-gray-200 dark:bg-gray-700 
												hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 
												dark:text-gray-200 text-xs font-bold leading-none transition-colors"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <p
              className={`mt-3 text-xs italic transition-opacity duration-150 
								${totalRequested === 0 ? "text-gray-400 opacity-100" : "opacity-0 pointer-events-none"}`}
            >
              Nothing selected — this will be an unconditional gift.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="flex-1 py-2 px-3 rounded-lg border 
						border-gray-300 dark:border-gray-600 
						text-sm text-gray-600 dark:text-gray-300 
						hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 py-2 px-3 rounded-lg bg-green-500 hover:bg-green-600 
						text-white text-sm font-semibold transition-colors"
          >
            Give ({cardsToGive.length} card{cardsToGive.length !== 1 ? "s" : ""}
            )
          </button>
        </div>
      </div>
    </div>
  );
}
