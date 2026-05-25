import { ReactNode } from "react";
import { Coins } from "lucide-react";

type CurrentPlayerProps = {
  field: ReactNode;
  tradedCards: ReactNode;
  hand: ReactNode;
  coinCount: number;
  isNarrow?: boolean;
};

export default function CurrentPlayer({
  field,
  tradedCards,
  hand,
  coinCount,
  isNarrow = false,
}: CurrentPlayerProps) {
  const coinsBadge = (
    <div className="flex flex-col items-center justify-center gap-1 self-stretch pr-1">
      <Coins size={20} strokeWidth={2} className="text-yellow-400" />
      <span
        className="text-base font-bold text-yellow-300 tabular-nums leading-none"
        style={{ textShadow: "0 1px 6px rgba(0,0,0,0.9)" }}
      >
        {coinCount}
      </span>
    </div>
  );

  return (
    <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center gap-3 px-6 pb-5 pt-3">
      <div style={{ perspective: "700px", position: "relative", zIndex: 15 }}>
        {isNarrow ? (
          <div
            className="flex flex-col items-center gap-3"
            style={{
              transform: "rotateX(25deg) scaleX(1.08)",
              transformOrigin: "bottom center",
            }}
          >
            <div style={{ display: "flex", justifyContent: "center" }}>
              {tradedCards}
            </div>
            <div className="flex items-center gap-3">
              {coinsBadge}
              {field}
            </div>
          </div>
        ) : (
          <div
            className="flex items-center gap-3"
            style={{
              transform: "rotateX(25deg) scaleX(1.08)",
              transformOrigin: "bottom center",
            }}
          >
            {coinsBadge}
            {field}
            {/* Zero-width anchor so tradedCards never shifts the field */}
            <div
              className="relative self-stretch"
              style={{ width: 0, overflow: "visible" }}
            >
              <div
                className="absolute left-2 top-1/2 -translate-y-1/2 flex items-center gap-2"
                style={{ pointerEvents: "auto" }}
              >
                {tradedCards}
              </div>
            </div>
          </div>
        )}
      </div>
      <div style={{ position: "relative", zIndex: 25 }}>{hand}</div>
    </div>
  );
}
