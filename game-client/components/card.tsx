import { forwardRef, useState } from "react";
import { m } from "motion/react";
import Image from "next/image";
import { BaseCard, CardType } from "@/schemas/types";
import { CardFrontFace } from "@/components/card-front-face";

type CardProp = {
  card: BaseCard | CardType;
  isSelected?: boolean;
  draggable?: boolean;
  flipped?: boolean;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onContextMenu?: (e: React.MouseEvent<HTMLDivElement>) => void;
  style?: React.CSSProperties;
  className?: string;
  noTransition?: boolean;
  hidden?: boolean;
};

const Card = forwardRef<HTMLDivElement, CardProp>(function Card(
  {
    card,
    isSelected = false,
    draggable = false,
    flipped = false,
    onClick,
    onContextMenu,
    style,
    className,
    noTransition = false,
    hidden = false,
  },
  ref,
) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
    e.dataTransfer.setData("application/card", JSON.stringify(card));
    e.dataTransfer.effectAllowed = "move";
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
      role={(onClick || onContextMenu) ? "button" : undefined}
      tabIndex={(onClick || onContextMenu) ? 0 : undefined}
      onKeyDown={onClick ? (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") onClick(e as unknown as React.MouseEvent<HTMLDivElement>); } : undefined}
      style={{ opacity: hidden ? 0 : undefined, ...style }}
      className={`w-24 h-36
        ${draggable ? "cursor-grab active:cursor-grabbing" : ""}
        ${onClick && !draggable ? "cursor-pointer" : ""}
        ${className ?? ""}
      `}
    >
      <m.div
        onClick={onClick}
        style={{ perspective: "600px", width: "100%", height: "100%" }}
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
          animate={{
            rotateY: flipped ? 180 : 0,
            y: isSelected ? -16 : 0,
            scale: isDragging ? 1.05 : 1,
            boxShadow: isSelected ? "0 20px 25px rgba(0,0,0,0.4)" : "none",
          }}
          whileHover={
            onClick && !isSelected && !isDragging
              ? { y: -12, boxShadow: "0 10px 20px rgba(0,0,0,0.3)" }
              : undefined
          }
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
              <Image src={card.backImage} alt="Card back" fill sizes="96px" style={{ objectFit: "cover" }} draggable={false} unoptimized />
            ) : (
              <div className="w-full h-full bg-green-800 flex items-center justify-center">
                <div className="w-12 h-16 rounded border-2 border-green-600 bg-green-700" />
              </div>
            )}
          </div>
        </m.div>
      </m.div>
    </div>
  );
});

export default Card;
