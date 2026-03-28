"use client";

import Card from "@/components/card";
import { CardType } from "@/schemas/types";

type Props = {
  pickedCards: Array<CardType>;
  selectedCard: CardType | null;
  onCardClick: (card: CardType, source?: "hand" | "picked" | "center") => void;
  phase?: string;
};

export default function TradedCards({
  pickedCards,
  selectedCard,
  onCardClick,
  phase,
}: Props) {
  const CARD_H = 144;
  const CARD_W = 96;
  const LAYER_H = 4;

  const pickedGroups: { cardName: string; cards: CardType[] }[] = [];
  const groupIndex = new Map<string, number>();
  for (const card of pickedCards) {
    const idx = groupIndex.get(card.cardName);
    if (idx === undefined) {
      groupIndex.set(card.cardName, pickedGroups.length);
      pickedGroups.push({ cardName: card.cardName, cards: [card] });
    } else {
      pickedGroups[idx].cards.push(card);
    }
  }

  if (pickedGroups.length === 0) return null;

  return (
    <>
      {pickedGroups.map(({ cardName, cards }) => {
        const count = cards.length;
        const topCard = cards[0];
        const layers = Math.min(count - 1, 6);

        return (
          <div
            key={cardName}
            className="relative select-none"
            style={{ width: CARD_W, height: CARD_H }}
            title={cardName}
          >
            {Array.from({ length: layers }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-xl border-2 bg-amber-300 border-amber-500"
                style={{
                  width: CARD_W,
                  height: CARD_H,
                  top: (i + 1) * LAYER_H,
                  left: 0,
                  zIndex: layers - i,
                }}
              />
            ))}

            <div style={{ position: "relative", zIndex: layers + 1 }}>
              <Card
                card={topCard}
                flipped={false}
                draggable={phase === "plantTrade"}
                isSelected={
                  selectedCard != null &&
                  cards.some((c) => c.cardId === selectedCard.cardId)
                }
                onClick={phase === "plantTrade" ? () => onCardClick(topCard, "picked") : undefined}
              />
            </div>

            {count > 1 && (
              <div
                className="absolute flex items-center justify-center w-6 h-6
                           bg-amber-600 text-white text-xs font-bold rounded-full
                           border-2 border-white shadow-md pointer-events-none"
                style={{ top: 4, right: 4, zIndex: layers + 2 }}
              >
                {count}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
