"use client";

import Card from "@/components/card";
import { useGameContext } from "./game-context";

function getFanStyle(
  index: number,
  total: number,
  isSelected: boolean,
): React.CSSProperties {
  if (total === 0) return {};
  const center = (total - 1) / 2;
  const offset = index - center;
  const rotateDeg = offset * 4;
  const arcDrop = Math.abs(offset) ** 1.5 * 4;
  const translateY = isSelected ? -28 : arcDrop;
  const rotate = isSelected ? 0 : rotateDeg;

  return {
    transform: `rotate(${rotate}deg) translateY(${translateY}px)`,
    transformOrigin: "bottom center",
    zIndex: isSelected ? 100 : total - index,
    marginLeft: index === 0 ? 0 : -22,
    position: "relative",
    transition: "transform 0.15s ease, z-index 0s",
  };
}

export default function PlayerHand() {
  const { gameState, selectedCard, handleCardClick } = useGameContext();
  const { hand, phase } = gameState;

  return (
    <div
      className={`flex items-end justify-center pb-2
        ${phase === "plantTrade" ? "opacity-40 pointer-events-none" : ""}`}
      style={{ minHeight: "8rem" }}
    >
      {hand.map((card, index) => {
        const isSelected = selectedCard?.cardId === card.cardId;
        return (
          <Card
            key={card.cardId}
            card={card}
            isSelected={isSelected}
            draggable={phase !== "plantTrade"}
            onClick={() => handleCardClick(card, "hand")}
            style={getFanStyle(index, hand.length, isSelected)}
          />
        );
      })}
    </div>
  );
}
