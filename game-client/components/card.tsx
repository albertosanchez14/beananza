"use client";

import { useState } from "react";
import { CardType } from "@/schemas/types";

type CardProp = {
  card: CardType;
  isSelected?: boolean;
  draggable?: boolean;
  flipped?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
  cardRef?: (el: HTMLDivElement | null) => void;
};

/** Sort exchange rate entries by card count (ascending). */
function sortedRates(
  money_exchange: Record<string, number>,
): { cards: number; coins: number }[] {
  return Object.entries(money_exchange)
    .map(([k, v]) => ({ cards: Number(k), coins: v }))
    .sort((a, b) => a.cards - b.cards);
}

export default function Card({
  card,
  isSelected = false,
  draggable = false,
  flipped = false,
  onClick,
  style,
  className,
  cardRef,
}: CardProp) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData("application/card", JSON.stringify(card));
    e.dataTransfer.effectAllowed = "move";
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const rates =
    card.money_exchange && Object.keys(card.money_exchange).length > 0
      ? sortedRates(card.money_exchange)
      : null;

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      draggable={draggable}
      onDragStart={draggable ? handleDragStart : undefined}
      onDragEnd={draggable ? handleDragEnd : undefined}
      style={{ perspective: "600px", ...style }}
      className={`w-24 h-36
        ${draggable ? "cursor-grab active:cursor-grabbing" : ""}
        ${onClick && !draggable ? "cursor-pointer" : ""}
        ${flipped ? "card-flipped" : ""}
        ${className ?? ""}
      `}
    >
      {/* Inner wrapper — rotates on Y axis to flip between faces */}
      <div
        className={`card-inner rounded-2xl w-full h-full
          transition-all duration-150
          ${isSelected ? "shadow-xl -translate-y-4" : ""}
          ${isDragging ? "opacity-40 scale-105" : ""}
          ${onClick && !draggable ? "hover:shadow-lg hover:-translate-y-3" : ""}
          ${onClick && draggable ? "hover:shadow-lg hover:-translate-y-3" : ""}
        `}
      >
        {/* ── FRONT FACE ─────────────────────────────────────────────────── */}
        <div
          className={`card-face rounded-2xl overflow-hidden
            bg-white border-2
            ${isSelected ? "border-blue-500" : "border-gray-200"}
            flex flex-col
          `}
        >
          {/* Image area — takes all space above the exchange strip */}
          <div className="relative flex-1 min-h-0 rounded-t-xl overflow-hidden">
            {card.frontImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.frontImage}
                alt={card.cardName}
                className="w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              /* Fallback: coloured block */
              <div className="w-full h-full bg-blue-200 flex items-end justify-center pb-1">
                <span className="text-black text-center text-[9px] font-semibold leading-tight px-1">
                  {card.cardName}
                </span>
              </div>
            )}

            {/* Card name overlay — dark gradient band at the bottom of the image */}
            {card.frontImage && (
              <div
                className="absolute bottom-0 left-0 right-0 flex items-end justify-center px-1 pb-0.5"
                style={{
                  background:
                    "linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0) 100%)",
                  paddingTop: "1rem",
                }}
              >
                <span className="text-white text-[9px] font-bold text-center leading-tight drop-shadow">
                  {card.cardName}
                </span>
              </div>
            )}
          </div>

          {/* ── EXCHANGE STRIP ───────────────────────────────────────────── */}
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
                  {/* Coin circle */}
                  <div
                    className="flex items-center justify-center rounded-full bg-yellow-400 border border-yellow-600 text-yellow-900 font-bold leading-none"
                    style={{ width: 15, height: 15, fontSize: 8 }}
                  >
                    {coins}
                  </div>
                  {/* Card count */}
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
            /* Thin white footer when no exchange data yet */
            <div className="bg-white rounded-b-xl" style={{ height: 4 }} />
          )}
        </div>

        {/* ── BACK FACE ──────────────────────────────────────────────────── */}
        <div className="card-back rounded-2xl border-2 border-gray-500 overflow-hidden">
          {card.backImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.backImage}
              alt="Card back"
              className="w-full h-full object-cover"
              draggable={false}
            />
          ) : (
            <div className="w-full h-full bg-green-800 flex items-center justify-center">
              <div className="w-12 h-16 rounded border-2 border-green-600 bg-green-700" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
