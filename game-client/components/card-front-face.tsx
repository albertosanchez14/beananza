import Image from "next/image";
import { BaseCard, CardType } from "@/schemas/types";

function sortedRates(
  money_exchange: Record<string, number>,
): { cards: number; coins: number }[] {
  return Object.entries(money_exchange)
    .map(([k, v]) => ({ cards: Number(k), coins: v }))
    .sort((a, b) => a.cards - b.cards);
}

type Props = {
  card: BaseCard | CardType;
  isSelected?: boolean;
};

/**
 * The front face of a card — image, name overlay, and coin-exchange strip.
 * Rendered inside a preserve-3d container; relies on the `.card-face` CSS class
 * for `position: absolute; inset: 0; backface-visibility: hidden`.
 */
export function CardFrontFace({ card, isSelected = false }: Props) {
  const fullCard = "cardId" in card ? (card as CardType) : null;
  const rates =
    fullCard?.money_exchange && Object.keys(fullCard.money_exchange).length > 0
      ? sortedRates(fullCard.money_exchange)
      : null;

  return (
    <div
      className={`card-face rounded-xl overflow-hidden bg-white border-2
        ${isSelected ? "border-blue-500" : "border-gray-200"}
        flex flex-col`}
    >
      {/* Image area */}
      <div className="relative flex-1 min-h-0 rounded-t-xl overflow-hidden">
        {fullCard?.frontImage ? (
          <Image src={fullCard.frontImage} alt={fullCard.cardName} fill sizes="96px" style={{ objectFit: "cover" }} draggable={false} unoptimized />
        ) : (
          <div className="w-full h-full bg-blue-200 flex items-end justify-center pb-1">
            <span className="text-black text-center text-[9px] font-semibold leading-tight px-1">
              {fullCard?.cardName ?? ""}
            </span>
          </div>
        )}

        {/* Name overlay — gradient band at the bottom of the image */}
        {fullCard?.frontImage && (
          <div
            className="absolute bottom-0 left-0 right-0 flex items-end justify-center px-1 pb-0.5"
            style={{
              background:
                "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0) 100%)",
              paddingTop: "1rem",
            }}
          >
            <span className="text-white text-[9px] font-bold text-center leading-tight drop-shadow">
              {fullCard.cardName}
            </span>
          </div>
        )}
      </div>

      {/* Coin-exchange strip */}
      {rates ? (
        <div
          className="flex flex-row items-stretch justify-around bg-white rounded-b-xl px-0.5 pt-0.5 pb-0.5"
          style={{ minHeight: "2rem" }}
        >
          {rates.map(({ cards, coins }) => (
            <div
              key={cards}
              className="flex flex-col items-center justify-between gap-px"
            >
              <div
                className="flex items-center justify-center rounded-full bg-yellow-400 border border-yellow-600 text-yellow-900 font-bold leading-none"
                style={{ width: 15, height: 15, fontSize: 8 }}
              >
                {coins}
              </div>
              <span
                className="text-gray-700 font-semibold leading-none"
                style={{ fontSize: 8 }}
              >
                {cards}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-b-xl" style={{ height: 4 }} />
      )}
    </div>
  );
}
