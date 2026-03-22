"use client";

import { Phases } from "@/schemas/messages";
import { Children, ReactNode, isValidElement } from "react";

type FanLayoutProps = {
  children: ReactNode;
  phase?: Phases;
  variant?: "player" | "opponent";
  maxCards?: number;
  containerRef?: React.Ref<HTMLDivElement>;
};

function getPlayerFanStyle(
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

function getOpponentFanStyle(
  index: number,
  total: number,
): React.CSSProperties {
  if (total === 0) return {};
  const center = (total - 1) / 2;
  const offset = index - center;
  const rotateDeg = offset * 5;
  const arcDrop = Math.abs(offset) ** 1.5 * 3;

  return {
    transform: `rotate(${rotateDeg}deg) translateY(${arcDrop}px)`,
    transformOrigin: "bottom center",
    zIndex: total - index,
    marginLeft: index === 0 ? 0 : -52,
    position: "relative",
  };
}

export default function FanLayout({
  children,
  phase,
  variant = "player",
  maxCards,
  containerRef,
}: FanLayoutProps) {
  const items = Children.toArray(children);

  const displayItems =
    variant === "opponent" && maxCards
      ? items.slice(0, Math.min(items.length, maxCards))
      : items;
  const total = displayItems.length;
  if (total === 0) return null;

  if (variant === "player") {
    return (
      <div
        className={`flex items-end justify-center pb-2
          ${phase === "plantTrade" ? "opacity-40 pointer-events-none" : ""}`}
        style={{ minHeight: "8rem" }}
      >
        {displayItems.map((child, index) => {
          // TODO: Check?
          const isSelected =
            isValidElement(child) &&
            typeof child.props === "object" &&
            child.props !== null &&
            "isSelected" in child.props &&
            child.props.isSelected === true;

          return (
            <div
              key={index}
              style={getPlayerFanStyle(index, total, isSelected)}
            >
              {child}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="flex items-end justify-center"
      style={{
        minWidth: 60,
        transform: "scale(0.38)",
        transformOrigin: "bottom center",
        marginTop: -8,
      }}
    >
      {displayItems.map((child, index) => (
        <div key={index} style={getOpponentFanStyle(index, total)}>
          {child}
        </div>
      ))}
    </div>
  );
}
