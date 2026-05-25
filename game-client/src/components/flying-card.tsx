import { useEffect, useRef } from "react";
import { m } from "motion/react";
import { AppImage as Image } from "@/components/app-image";
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

// Back face: absolutely positioned, backface hidden, pre-rotated 180° on Y
const backStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
  transform: "rotateY(180deg)",
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

  // Tilt layer ref — we drive the CSS transition manually so the transform
  // string stays in the `transform` shorthand (which parent `perspective` acts
  // on), rather than going through Framer Motion's individual CSS properties.
  const tiltRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = tiltRef.current;
    if (!el) return;
    const ms = delay * 1000;
    const timer = setTimeout(() => {
      el.style.transition = `transform 0.45s cubic-bezier(0.22,1,0.36,1)`;
      el.style.transform = `rotateX(0deg) scaleX(1)`;
    }, ms);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    // Wrapper positioned relative to the hand container.
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
      <m.div
        style={{
          width: "100%",
          height: "100%",
          transformOrigin: "bottom center",
        }}
        initial={{ x: 0, y: 0, rotate: 0 }}
        animate={{ x: dx, y: dy, rotate: targetRotate }}
        transition={{
          x: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] },
          y: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] },
          rotate: {
            duration: 0.25,
            delay: delay + 0.45,
            ease: [0.22, 1, 0.36, 1],
          },
        }}
        onAnimationComplete={onComplete}
      >
        {/*
          Perspective container — perspective CSS property applies to the
          direct child's `transform` shorthand. The tilt div below uses a
          plain CSS transform string (not Framer Motion values) so it is
          guaranteed to be affected by this perspective.
        */}
        <div style={{ width: "100%", height: "100%", perspective: "700px" }}>
          {/*
            Tilt layer — plain div so its `transform` stays in the CSS
            shorthand that responds to the parent's `perspective`.
            Starts matching Center's rotateX(25deg) scaleX(1.08); a CSS
            transition unwinds it to flat over the same duration as the flight.
          */}
          <div
            ref={tiltRef}
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
              {/* Card flip: back→front (rotateY 180→0) */}
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
                  duration: 0.42,
                  delay: delay + 0.28,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                {/* Front face */}
                <CardFrontFace card={card} />

                {/* Back face — pre-rotated 180° on Y */}
                <div
                  style={backStyle}
                  className="rounded-xl border-2 border-gray-500 overflow-hidden"
                >
                  {card.backImage ? (
                    <Image
                      src={card.backImage}
                      alt="Card back"
                      fill
                      sizes="96px"
                      style={{ objectFit: "cover" }}
                      draggable={false}
                      unoptimized
                    />
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
