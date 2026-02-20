"use client";

import { CardType } from "@/schemas/types";

type CardProp = {
  card: CardType;
  isSelected?: boolean;
  onClick?: () => void;
};

export default function Card({ card, isSelected = false, onClick }: CardProp) {
  // TODO: add image file

  return (
    <div
      onClick={onClick}
      className={`flex w-20 h-30 px-2 py-4 bg-blue-200 border-b-gray-500 rounded-lg
        transition-all duration-200
        ${onClick ? "cursor-pointer hover:shadow-lg hover:-translate-y-1" : ""}
        ${isSelected ? "border-4 border-blue-500 shadow-xl -translate-y-2" : "border-2 border-gray-500"}
      `}
    >
      <span className="text-black self-center text-sm">{card.cardName}</span>
    </div>
  );
}
