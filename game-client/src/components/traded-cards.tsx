import Card from "@/components/card";
import { FlashWrapper } from "@/components/flash-wrapper";
import { CardType } from "@/schemas/types";

const CARD_H = 144;
const CARD_W = 96;
const LAYER_H = 4;
const MAX_LAYERS = 6;

type Props = {
  pickedCards: Array<CardType>;
  selection: CardType[];
  readOnly?: boolean;
  flashSignal?: number;
};

function CardGroup({
  cardName,
  cards,
  selection,
  readOnly,
  flashSignal,
}: {
  cardName: string;
  cards: CardType[];
  selection: CardType[];
  readOnly: boolean;
  flashSignal: number;
}) {
  const count = cards.length;
  const topCard = cards[0];
  const layers = Math.min(count - 1, MAX_LAYERS);

  return (
    <FlashWrapper flashSignal={flashSignal}>
      <div
        className="relative select-none rounded-xl"
        style={{ width: CARD_W, height: CARD_H, overflow: "visible" }}
        title={cardName}
      >
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
            draggable={!readOnly}
            isSelected={
              !readOnly &&
              cards.some((c) => selection.some((s) => s.cardId === c.cardId))
            }
            onDragStart={
              readOnly
                ? undefined
                : (e) => {
                    e.dataTransfer.setData(
                      "application/card",
                      JSON.stringify(topCard),
                    );
                    e.dataTransfer.effectAllowed = "move";
                  }
            }
          />
          {count > 1 && (
            <div
              className="absolute flex items-center justify-center w-6 h-6
                         bg-amber-600 text-white text-xs font-bold rounded-full
                         border-2 border-white shadow-md pointer-events-none"
              style={{ top: 0, right: 1, zIndex: 1 }}
            >
              {count}
            </div>
          )}
        </div>

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
      </div>
    </FlashWrapper>
  );
}

export default function TradedCards({
  pickedCards,
  selection,
  readOnly = false,
  flashSignal = 0,
}: Props) {
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
      {pickedGroups.map(({ cardName, cards }) => (
        <CardGroup
          key={cardName}
          cardName={cardName}
          cards={cards}
          selection={selection}
          readOnly={readOnly}
          flashSignal={flashSignal}
        />
      ))}
    </>
  );
}
