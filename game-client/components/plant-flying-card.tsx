"use client";
import { m } from "motion/react";
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
  initialRotate?: number;
  targetRotate?: number;
  initialScale?: number;
  targetScale?: number;
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
  initialRotate = 0,
  targetRotate,
  initialScale = 1,
  targetScale = 1,
}: PlantFlyingCardProps) {
  const dx = targetX - startX;
  const dy = targetY - startY;
  const effectiveTargetRotate = targetRotate ?? initialRotate;
  const hasTilt = targetRotateX !== 0 || targetScaleX !== 1;
  const hasRotate = effectiveTargetRotate !== initialRotate;
  const hasScale = initialScale !== 1 || targetScale !== 1;
  // Defer the tilt to the second half only for CurrentPlayer-style animations
  // (no scale change, no 2D spin). Hand plants start the tilt immediately.
  const deferTilt = hasTilt && !hasRotate && !hasScale;

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
      <m.div
        style={{
          width: "100%",
          height: "100%",
          ...(hasTilt ? { perspective: "700px" } : {}),
        }}
        initial={{ x: 0, y: 0, ...(hasScale ? { scale: initialScale } : {}) }}
        animate={{ x: dx, y: dy, ...(hasScale ? { scale: targetScale } : {}) }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        onAnimationComplete={onComplete}
      >
        {/*
          Middle: applies the 3D perspective tilt (rotateX + scaleX) in
          the second half of the flight. transformOrigin "bottom center"
          keeps the slot's bottom edge anchored, matching the field row's
          own transformOrigin.
        */}
        <m.div
          style={{
            width: "100%",
            height: "100%",
            ...(hasTilt ? { transformOrigin: "bottom center" } : {}),
          }}
          initial={{ rotateX: 0, scaleX: 1 }}
          animate={
            hasTilt
              ? deferTilt
                ? { rotateX: [0, 0, targetRotateX], scaleX: [1, 1, targetScaleX] }
                : { rotateX: targetRotateX, scaleX: targetScaleX }
              : undefined
          }
          transition={
            hasTilt
              ? {
                  rotateX: {
                    duration: 0.55,
                    ease: [0.22, 1, 0.36, 1],
                    ...(deferTilt ? { times: [0, 0.45, 1] } : {}),
                  },
                  scaleX: {
                    duration: 0.55,
                    ease: [0.22, 1, 0.36, 1],
                    ...(deferTilt ? { times: [0, 0.45, 1] } : {}),
                  },
                }
              : undefined
          }
        >
          {/*
            Inner: applies a 2D rotation (e.g. 180° for opponent slots).
            Uses default transformOrigin "center" so the flip is around
            the card's own centre, independent of the tilt above.
            Rotation spans the full flight duration (no initial hold).
          */}
          <m.div
            style={{ width: "100%", height: "100%" }}
            initial={{ rotate: initialRotate }}
            animate={hasRotate ? { rotate: effectiveTargetRotate } : undefined}
            transition={
              hasRotate
                ? {
                    rotate: {
                      duration: 0.55,
                      ease: [0.42, 0, 0.58, 1],
                    },
                  }
                : undefined
            }
          >
            <CardFrontFace card={card} />
          </m.div>
        </m.div>
      </m.div>
    </div>
  );
}
