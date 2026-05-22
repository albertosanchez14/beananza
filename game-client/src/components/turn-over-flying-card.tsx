"use client";
import { m } from "motion/react";
import { AppImage as Image } from "@/components/app-image";
import { CardType } from "@/schemas/types";
import { CardFrontFace } from "@/components/card-front-face";

type TurnOverFlyingCardProps = {
  card: CardType;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  index: number;
  cardScale?: number;
  onComplete: () => void;
};

export function TurnOverFlyingCard({
  card,
  startX,
  startY,
  targetX,
  targetY,
  index,
  cardScale = 1,
  onComplete,
}: TurnOverFlyingCardProps) {
  const delay = index * 0.08;
  const dx = targetX - startX;
  const dy = targetY - startY;
  const W = 96 * cardScale;
  const H = 144 * cardScale;

  return (
    <div
      style={{
        position: "fixed",
        left: startX,
        top: startY,
        width: W,
        height: H,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    >
      {/* Outer: translates from deck to target position */}
      <m.div
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
          Perspective context matching the Center container (700px scaled by
          cardScale so the 3D effect depth matches the visual card size).
        */}
        <div style={{ width: "100%", height: "100%", perspective: `${700 * cardScale}px` }}>
          {/*
            Static tilt matching the Center container's transform throughout
            the flight. transformOrigin "bottom center" keeps the bottom edge
            fixed, which is why targetY = cardRect.bottom - scaledH lands exactly.
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
              (600px scaled by cardScale).
            */}
            <div
              style={{ width: "100%", height: "100%", perspective: `${600 * cardScale}px` }}
            >
              {/* Long-side flip: rotateY 180 → 0 (back→front) */}
              <m.div
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
                    <Image src={card.backImage} alt="Card back" fill sizes="96px" style={{ objectFit: "cover" }} draggable={false} unoptimized />
                  ) : (
                    <div className="w-full h-full bg-green-800 flex items-center justify-center">
                      <div className="w-12 h-16 rounded border-2 border-green-600 bg-green-700" />
                    </div>
                  )}
                </div>
              </m.div>
            </div>
          </div>
        </div>
      </m.div>
    </div>
  );
}
