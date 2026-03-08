"use client";

import { useState } from "react";
import { CardType } from "@/schemas/types";

type CardProp = {
  card: CardType;
  isSelected?: boolean;
  draggable?: boolean;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
  cardRef?: (el: HTMLDivElement | null) => void;
};

export default function Card({
  card,
  isSelected = false,
  draggable = false,
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

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      draggable={draggable}
      onDragStart={draggable ? handleDragStart : undefined}
      onDragEnd={draggable ? handleDragEnd : undefined}
      style={style}
      className={`flex w-20 h-30 px-2 py-4 bg-blue-200 rounded-lg
        transition-all duration-150
        ${draggable ? "cursor-grab active:cursor-grabbing" : ""}
        ${onClick && !draggable ? "cursor-pointer hover:shadow-lg hover:-translate-y-3" : ""}
        ${onClick && draggable ? "hover:shadow-lg hover:-translate-y-3" : ""}
        ${isSelected ? "border-4 border-blue-500 shadow-xl -translate-y-4" : "border-2 border-gray-500"}
        ${isDragging ? "opacity-40 scale-105" : ""}
        ${className ?? ""}
      `}
    >
      <span className="text-black self-center text-sm">{card.cardName}</span>
    </div>
  );
}
