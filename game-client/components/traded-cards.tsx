"use client";

import Card from "@/components/card";
import { CardType } from "@/schemas/types";

const CARD_H = 144;
const CARD_W = 96;
const LAYER_H = 4;
const MAX_LAYERS = 6;

type Props = {
  pickedCards: Array<CardType>;
  selection: CardType[];
};

export default function TradedCards({ pickedCards, selection }: Props) {
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
        const layers = Math.min(count - 1, MAX_LAYERS);

        return (
          <div
            key={cardName}
            className="relative select-none"
            // Container height = CARD_H so items-center in parent centers correctly.
            // Layers overflow below via overflow:visible.
            style={{ width: CARD_W, height: CARD_H, overflow: "visible" }}
            title={cardName}
          >
            {/* Face card — always at the top of the container */}
            <div
              style={{
                position: "absolute",
                top: 0,
                width: CARD_W,
                zIndex: layers + 1,
              }}
            >
              <Card
                card={topCard}
                flipped={false}
                draggable
                isSelected={cards.some((c) =>
                  selection.some((s) => s.cardId === c.cardId),
                )}
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    "application/card",
                    JSON.stringify(topCard),
                  );
                  e.dataTransfer.effectAllowed = "move";
                }}
              />
            </div>

            {/* Depth layers — overflow above the face card (bottom-to-top stack).
                i=0 is closest to face (peeks 1×LAYER_H above), i=layers-1 is deepest. */}
            {Array.from({ length: layers }).map((_, i) => (
              <div
                key={i}
                className="absolute rounded-xl border-2 bg-amber-300 border-amber-500"
                style={{
                  width: CARD_W,
                  height: CARD_H,
                  top: -(i + 1) * LAYER_H,
                  left: 0,
                  zIndex: layers - i,
                }}
              />
            ))}

            {count > 1 && (
              <div
                className="absolute flex items-center justify-center w-6 h-6
                           bg-amber-600 text-white text-xs font-bold rounded-full
                           border-2 border-white shadow-md pointer-events-none"
                style={{ top: -12, right: -12, zIndex: layers + 2 }}
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
