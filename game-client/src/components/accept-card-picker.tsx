import { useState, useEffect, useCallback } from "react";
import { m } from "motion/react";
import { CardType, Offer, OfferCard } from "@/schemas/types";
import CardComponent from "@/components/card";

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

// Visual dimensions of the notice-board webp (used for aspect-ratio only)
const BOARD_W = 590;
const BOARD_H = 380;

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
      const needed = offer.cards_requested.filter(
        (r) => r.card_type === c.card_type,
      ).length;
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
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Western notice board */}
      <m.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="fixed left-1/2 -translate-x-1/2 z-50"
        style={{
          bottom: 190,
          width: "min(450px, 90vw)",
          aspectRatio: `${BOARD_W} / ${BOARD_H}`,
        }}
      >
        {/* Board background image */}
        <img
          src="/accept_card_picker.webp"
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-fill select-none pointer-events-none"
        />

        {/* Content inside the parchment area */}
        <div
          className="absolute flex flex-col gap-2"
          style={{ top: "13%", bottom: "15%", left: "11%", right: "11%" }}
        >
          <p
            className="text-lg font-semibold text-center shrink-0"
            style={{ color: "#3b1a08" }}
          >
            Choose which cards to give
          </p>

          {/* Scrollable card groups */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-3 min-h-0">
            {requestedGroups.map(({ cardType, needed }) => {
              const available = availableByType[cardType];
              const selectedCount = available.filter((s) =>
                selectedIds.has(s.card.cardId),
              ).length;
              return (
                <div key={cardType} className="flex flex-col gap-1.5">
                  <p className="font-semibold" style={{ color: "#3b1a08" }}>
                    <span className="font-semibold">{cardType}</span>
                    {" — select "}
                    {needed}{" "}
                    <span
                      style={{
                        color: selectedCount === needed ? "#92400e" : "#a8856a",
                      }}
                    >
                      ({selectedCount}/{needed})
                    </span>
                  </p>

                  <div className="flex gap-2 flex-wrap">
                    {available.map(({ card, source }) => {
                      const isSelected = selectedIds.has(card.cardId);
                      return (
                        <button
                          key={card.cardId}
                          onClick={() =>
                            toggleCard(card.cardId, cardType, needed)
                          }
                          className="flex flex-col items-center gap-0.5 focus:outline-none"
                        >
                          <CardComponent
                            card={card}
                            scale={0.6}
                            noRaise
                            noTransition
                            isSelected={false}
                            highlightColor={isSelected ? "#d97706" : undefined}
                          />
                          <span
                            className="text-[9px] font-semibold uppercase tracking-wide"
                            style={{
                              color:
                                source === "center" ? "#b45309" : "#1e40af",
                            }}
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
          </div>

          {/* Buttons */}
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onClose}
              className="flex-1 py-1 text-xs font-semibold rounded border border-amber-800 hover:border-amber-700 text-amber-900 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!isComplete}
              className="flex-1 py-1 text-xs font-semibold rounded bg-amber-700 hover:bg-amber-600 active:bg-amber-800 border border-amber-500 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Confirm
            </button>
          </div>
        </div>
      </m.div>
    </>
  );
}
