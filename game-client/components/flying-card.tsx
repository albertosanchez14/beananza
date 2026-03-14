"use client";

import { motion } from "motion/react";
import { CardType } from "@/schemas/types";
import { CardFrontFace } from "@/components/card-front-face";

type FlyingCardProps = {
  card: CardType;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  index: number;
  zIndex: number;
  targetRotate: number;
  onComplete: () => void;
};

// Back face: absolutely positioned, backface hidden, pre-rotated 180° on X
const backStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
  transform: "rotateX(180deg)",
};

export function FlyingCard({
  card,
  startX,
  startY,
  targetX,
  targetY,
  index,
  zIndex,
  targetRotate,
  onComplete,
}: FlyingCardProps) {
  const delay = index * 0.1;
  const dx = targetX - startX;
  const dy = targetY - startY;

  return (
    // Wrapper positioned relative to the hand container.
    // position:absolute + z-index:1 means it sits behind all existing fan cards
    // (which have z-index 2…N) while being visible above board elements below.
    <div
      style={{
        position: "absolute",
        left: startX,
        top: startY,
        width: 96,
        height: 144,
        zIndex,
        pointerEvents: "none",
      }}
    >
      {/* Layer 1 — screen-space movement + fan tilt settle */}
      <motion.div
        style={{ width: "100%", height: "100%", transformOrigin: "bottom center" }}
        initial={{ x: 0, y: 0, rotate: 0 }}
        animate={{ x: dx, y: dy, rotate: targetRotate }}
        transition={{
          x:      { duration: 0.7,  delay,           ease: [0.22, 1, 0.36, 1] },
          y:      { duration: 0.7,  delay,           ease: [0.22, 1, 0.36, 1] },
          rotate: { duration: 0.25, delay: delay + 0.45, ease: [0.22, 1, 0.36, 1] },
        }}
        onAnimationComplete={onComplete}
      >
        {/* Perspective context for the tilt layer */}
        <div style={{ width: "100%", height: "100%", perspective: "700px" }}>
          {/* Layer 2 — deck tilt: rotateX 25→0, scaleX 1.08→1 (matches Center's transform) */}
          <motion.div
            style={{ width: "100%", height: "100%", transformStyle: "preserve-3d" }}
            initial={{ rotateX: 25, scaleX: 1.08 }}
            animate={{ rotateX: 0, scaleX: 1 }}
            transition={{
              rotateX: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] },
              scaleX: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] },
            }}
          >
            {/* Layer 3 — card flip: back→front (rotateX 180→0) starts once tilt is mostly done */}
            <motion.div
              style={{
                transformStyle: "preserve-3d",
                position: "relative",
                width: "100%",
                height: "100%",
              }}
              initial={{ rotateX: 180 }}
              animate={{ rotateX: 0 }}
              transition={{
                duration: 0.42,
                delay: delay + 0.28,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {/* Front face — full fidelity via shared component (uses .card-face CSS class) */}
              <CardFrontFace card={card} />

              {/* Back face — pre-rotated 180° on X */}
              <div
                style={backStyle}
                className="rounded-2xl border-2 border-gray-500 overflow-hidden"
              >
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
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
