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
  targetRotate?: number;
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
  targetRotate = 0,
}: PlantFlyingCardProps) {
  const dx = targetX - startX;
  const dy = targetY - startY;
  const hasTilt = targetRotateX !== 0 || targetScaleX !== 1;
  const hasRotate = targetRotate !== 0;

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
        Outer: translates to target position.
        Also the perspective container so the vanishing point stays
        centred on the card throughout the flight.
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
          Middle: applies the 3D perspective tilt (rotateX + scaleX) in
          the second half of the flight. transformOrigin "bottom center"
          keeps the slot's bottom edge anchored, matching the field row's
          own transformOrigin.
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
          {/*
            Inner: applies a 2D rotation (e.g. 180° for opponent slots).
            Uses default transformOrigin "center" so the flip is around
            the card's own centre, independent of the tilt above.
          */}
          <motion.div
            style={{ width: "100%", height: "100%" }}
            initial={{ rotate: 0 }}
            animate={hasRotate ? { rotate: [0, 0, targetRotate] } : undefined}
            transition={
              hasRotate
                ? {
                    rotate: {
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
      </motion.div>
    </div>
  );
}
