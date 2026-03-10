"use client";

import { ReactNode } from "react";
import { Coins } from "lucide-react";

type CurrentPlayerProps = {
  field: ReactNode;
  tradedCards: ReactNode;
  hand: ReactNode;
  coinCount: number;
};

export default function CurrentPlayer({ field, tradedCards, hand, coinCount }: CurrentPlayerProps) {
  return (
    <div
      className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-3 px-6 pb-5 pt-3"
      style={{ zIndex: 20 }}
    >
      {/* Field + traded card stacks side by side, with perspective tilt */}
      <div style={{ perspective: "700px" }}>
        <div
          className="flex items-center gap-3"
          style={{
            transform: "rotateX(25deg) scaleX(1.08)",
            transformOrigin: "bottom center",
          }}
        >
          {/* Coin counter — left of field */}
          <div className="flex flex-col items-center justify-center gap-1 self-stretch pr-1">
            <Coins size={18} strokeWidth={2} className="text-yellow-400" />
            <span
              className="text-base font-bold text-yellow-300 tabular-nums leading-none"
              style={{ textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}
            >
              {coinCount}
            </span>
          </div>

          {field}
          {tradedCards}
        </div>
      </div>

      {/* Hand — fan arc */}
      {hand}
    </div>
  );
}
