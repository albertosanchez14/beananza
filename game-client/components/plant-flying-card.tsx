"use client";
import { motion } from "motion/react";
import { CardType } from "@/schemas/types";
import { CardFrontFace } from "@/components/card-front-face";

type PlantFlyingCardProps = {
  card: CardType;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  onComplete: () => void;
  targetRotateX?: number;
  targetScaleX?: number;
};

export function PlantFlyingCard({
  card,
  startX,
  startY,
  targetX,
  targetY,
  onComplete,
  targetRotateX = 0,
  targetScaleX = 1,
}: PlantFlyingCardProps) {
  const dx = targetX - startX;
  const dy = targetY - startY;
  const hasTilt = targetRotateX !== 0 || targetScaleX !== 1;

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
      {/*
        Outer motion div: translates the card to the target position.
        Also acts as the perspective container so the vanishing point
        stays centred on the card throughout the flight — matching the
        field's own perspective: 700px context.
      */}
      <motion.div
        style={{
          width: "100%",
          height: "100%",
          ...(hasTilt ? { perspective: "700px" } : {}),
        }}
        initial={{ x: 0, y: 0 }}
        animate={{ x: dx, y: dy }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        onAnimationComplete={onComplete}
      >
        {/*
          Inner motion div: applies the tilt in the second half of the
          flight so the card appears to "settle" into the perspective
          of the field as it lands.
        */}
        <motion.div
          style={{
            width: "100%",
            height: "100%",
            ...(hasTilt ? { transformOrigin: "bottom center" } : {}),
          }}
          initial={{ rotateX: 0, scaleX: 1 }}
          animate={
            hasTilt
              ? { rotateX: [0, 0, targetRotateX], scaleX: [1, 1, targetScaleX] }
              : undefined
          }
          transition={
            hasTilt
              ? {
                  rotateX: {
                    duration: 0.45,
                    ease: [0.22, 1, 0.36, 1],
                    times: [0, 0.45, 1],
                  },
                  scaleX: {
                    duration: 0.45,
                    ease: [0.22, 1, 0.36, 1],
                    times: [0, 0.45, 1],
                  },
                }
              : undefined
          }
        >
          <CardFrontFace card={card} />
        </motion.div>
      </motion.div>
    </div>
  );
}
