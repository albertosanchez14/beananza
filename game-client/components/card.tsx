import { useEffect, useState } from "react";
import { m } from "motion/react";
import Image from "next/image";
import { BaseCard, CardType } from "@/schemas/types";
import { CardFrontFace } from "@/components/card-front-face";

type CardProp = {
  card: BaseCard | CardType;
  ref?: React.Ref<HTMLDivElement>;
  isSelected?: boolean;
  draggable?: boolean;
  flipped?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  style?: React.CSSProperties;
  className?: string;
  noTransition?: boolean;
  hidden?: boolean;
  highlightColor?: string;
  secondaryHighlightColor?: string;
  noRaise?: boolean;
  selectHint?: boolean;
};

export default function Card({
  card,
  ref,
  isSelected = false,
  draggable = false,
  flipped = false,
  style,
  className,
  noTransition = false,
  hidden = false,
  highlightColor,
  secondaryHighlightColor,
  noRaise = false,
  onClick,
  onContextMenu,
  onDragStart,
  selectHint = false,
}: CardProp) {
  const isHighlighted = !!highlightColor;
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (!draggable && isDragging) setIsDragging(false);
  }, [draggable, isDragging]);

  const effectiveHover = isHovered && !isSelected && !isHighlighted;
  const showSelectHint = selectHint && !isSelected && !isHighlighted;

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    onDragStart?.(e);
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  return (
    <div
      ref={ref}
      onClick={onClick}
      onContextMenu={onContextMenu}
      draggable={draggable}
      onDragStart={draggable ? handleDragStart : undefined}
      onDragEnd={draggable ? handleDragEnd : undefined}
      role={onClick || onContextMenu ? "button" : undefined}
      tabIndex={onClick || onContextMenu ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ")
                onClick(e as unknown as React.MouseEvent<HTMLDivElement>);
            }
          : undefined
      }
      style={{ opacity: hidden ? 0 : undefined, ...style }}
      className={`relative w-24 h-36
        ${draggable ? "cursor-grab active:cursor-grabbing" : ""}
        ${onClick && !draggable ? "cursor-pointer" : ""}
        ${className ?? ""}
      `}
    >
      <m.div
        style={{
          perspective: "600px",
          width: "100%",
          height: "100%",
        }}
        initial={false}
        animate={{ opacity: isDragging ? 0.4 : 1 }}
        transition={
          noTransition ? { duration: 0 } : { opacity: { duration: 0.15 } }
        }
      >
        {/* Inner wrapper — rotates on Y axis to flip between faces */}
        <m.div
          className="rounded-xl"
          style={{
            transformStyle: "preserve-3d",
            position: "relative",
            width: "100%",
            height: "100%",
          }}
          initial={false}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          animate={{
            rotateY: flipped ? 180 : 0,
            y:
              isSelected || (isHighlighted && !noRaise)
                ? -16
                : effectiveHover && onClick && !isDragging
                  ? -12
                  : 0,
            scale: isDragging ? 1.05 : 1,
            boxShadow:
              isSelected || (isHighlighted && !noRaise)
                ? "0 20px 25px rgba(0,0,0,0.4)"
                : showSelectHint && !isDragging
                  ? "none"
                  : effectiveHover && onClick && !isDragging
                    ? "0 10px 20px rgba(0,0,0,0.3)"
                    : "none",
          }}
          transition={
            noTransition
              ? { duration: 0 }
              : {
                  rotateY: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
                  y: { type: "spring", stiffness: 400, damping: 28 },
                  scale: { duration: 0.15 },
                }
          }
        >
          {/* ── FRONT FACE ─────────────────────────────────────────────────── */}
          <CardFrontFace card={card} isSelected={isSelected} />

          {/* ── BACK FACE ──────────────────────────────────────────────────── */}
          <div className="card-back rounded-xl border-2 border-gray-500 overflow-hidden">
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

          {/* ── HIGHLIGHT RING ─────────────────────────────────────────────── */}
          {/* Placed after both faces so it renders on top, moves with all animations */}
          {highlightColor && (
            <div
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{ border: `3px solid ${highlightColor}`, zIndex: 10 }}
            />
          )}
          {secondaryHighlightColor && (
            <div
              className="absolute rounded-[9px] pointer-events-none"
              style={{
                inset: 4,
                border: `2px solid ${secondaryHighlightColor}`,
                zIndex: 11,
              }}
            />
          )}
          {showSelectHint && (
            <div
              className="absolute inset-0 rounded-xl pointer-events-none"
              style={{
                border: "1px solid rgba(251,191,36,0.95)",
                boxShadow:
                  "0 0 12px rgba(251,191,36,0.65), 0 0 22px rgba(251,191,36,0.35)",
                zIndex: 12,
              }}
            />
          )}
        </m.div>
      </m.div>
    </div>
  );
}
