"use client";
import { motion } from "motion/react";
import { CardType } from "@/schemas/types";
import { CardFrontFace } from "@/components/card-front-face";

type TurnOverFlyingCardProps = {
  card: CardType;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  index: number;
  onComplete: () => void;
};

export function TurnOverFlyingCard({
  card,
  startX,
  startY,
  targetX,
  targetY,
  index,
  onComplete,
}: TurnOverFlyingCardProps) {
  const delay = index * 0.08;
  const dx = targetX - startX;
  const dy = targetY - startY;

  return (
    <div
      style={{
        position: "fixed",
        left: startX,
        top: startY,
        width: 96,
        height: 144,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      {/* Outer: translates from deck to target position */}
      <motion.div
        style={{ width: "100%", height: "100%" }}
        initial={{ x: 0, y: 0 }}
        animate={{ x: dx, y: dy }}
        transition={{
          x: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] },
          y: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] },
        }}
        onAnimationComplete={onComplete}
      >
        {/*
          Perspective context matching the Center container (700px).
          Positioned here — outside the tilt — so the vanishing point is
          centred on the card itself, mirroring how each card gets its own
          perspective slice of the shared 700px context.
        */}
        <div style={{ width: "100%", height: "100%", perspective: "700px" }}>
          {/*
            Static tilt matching the Center container's transform throughout
            the flight. transformOrigin "bottom center" keeps the bottom edge
            fixed, which is why targetY = cardRect.bottom - 144 lands exactly.
          */}
          <div
            style={{
              width: "100%",
              height: "100%",
              transform: "rotateX(25deg) scaleX(1.08)",
              transformOrigin: "bottom center",
              transformStyle: "preserve-3d",
            }}
          >
            {/*
              Inner perspective matching the Card component's own flip context
              (600px), so the rotateY animation looks identical to a real card flip.
            */}
            <div
              style={{ width: "100%", height: "100%", perspective: "600px" }}
            >
              {/* Long-side flip: rotateY 180 → 0 (back→front) */}
              <motion.div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  transformStyle: "preserve-3d",
                }}
                initial={{ rotateY: 180 }}
                animate={{ rotateY: 0 }}
                transition={{
                  rotateY: {
                    duration: 0.42,
                    delay: delay + 0.22,
                    ease: [0.22, 1, 0.36, 1],
                  },
                }}
              >
                {/* Front face — .card-face: absolute inset-0, backface-visibility hidden */}
                <CardFrontFace card={card} />

                {/* Back face — .card-back: same + rotateY(180deg) */}
                <div className="card-back rounded-xl border-2 border-gray-500 overflow-hidden">
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
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
