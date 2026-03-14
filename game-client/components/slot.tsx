"use client";

import { ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CardType, SlotType } from "@/schemas/types";

type SlotProp = {
  slot?: SlotType | null;
  index: number;
  children?: ReactNode;
  interactive?: boolean;
  rotated?: boolean;
  dragOverSlot?: string | null;
  highlightEmpty?: boolean;
  handleDragOver?: (e: React.DragEvent, slotId: string) => void;
  handleDragLeave?: (e: React.DragEvent) => void;
  handleFieldDrop?: (slotId: string, slotIndex: number, card: CardType) => void;
  handleSlotClick?: (slotId: string, slotIndex: number) => void;
  suppressAnimation?: boolean;
};

export default function Slot({
  slot,
  index,
  children,
  interactive = true,
  rotated = false,
  dragOverSlot = null,
  highlightEmpty = false,
  handleDragOver,
  handleDragLeave,
  handleFieldDrop,
  handleSlotClick,
  suppressAnimation = false,
}: SlotProp) {
  const isInteractive = interactive;

  const cardQuantity = slot?.cardIds.length ?? 0;

  const filled = !!(slot?.cardName && cardQuantity > 0);
  const isDragOver = dragOverSlot === slot?.slotId;

  const onDrop = (e: React.DragEvent) => {
    if (!isInteractive || !slot) return;
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/card");
    if (!raw) return;
    try {
      const card = JSON.parse(raw);
      handleFieldDrop?.(slot.slotId, index, card);
    } catch {
      // ignore malformed payload
    }
  };

  const sharedDragProps =
    isInteractive && slot
      ? {
          onDragOver: (e: React.DragEvent) => handleDragOver?.(e, slot.slotId),
          onDragLeave: handleDragLeave,
          onDrop,
        }
      : {};

  const handleClick =
    isInteractive && slot
      ? () => handleSlotClick?.(slot.slotId, index)
      : undefined;

  // Filled slot — card provided as children
  if (filled && children) {
    return (
      <div
        className={`relative select-none
          ${isInteractive ? "cursor-pointer" : ""}
          ${rotated ? "transform-[rotate(180deg)]" : ""}
        `}
        onClick={handleClick}
        {...sharedDragProps}
      >
        <AnimatePresence>
          <motion.div
            key={`${slot?.slotId}-${slot?.cardName}`}
            initial={
              rotated || suppressAnimation
                ? false
                : { scale: 1.25, y: -16, rotate: -2 }
            }
            animate={{ scale: 1, y: 0, rotate: 0 }}
            transition={{ type: "spring", stiffness: 480, damping: 24 }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
        <div
          className="absolute -top-2 -right-2 flex items-center
                     justify-center w-6 h-6 bg-blue-500 text-white
                     text-xs font-bold rounded-full border-2 border-white
                     shadow-md z-10 pointer-events-none"
        >
          {cardQuantity}
        </div>
      </div>
    );
  }

  // Filled slot — card not yet in lookup (text fallback)
  if (filled) {
    return (
      <div
        className={[
          "relative flex flex-col items-center justify-center w-24 h-36 rounded-md border-2",
          isInteractive
            ? "bg-white border-gray-300 shadow-md hover:shadow-xl hover:-translate-y-1 cursor-pointer"
            : "bg-white border-gray-300 shadow-md",
          rotated
            ? "transform-[rotate(180deg)]"
            : "transition-all duration-150",
        ].join(" ")}
        onClick={handleClick}
        {...sharedDragProps}
      >
        <div className="text-xs font-semibold text-center px-2 text-gray-800 line-clamp-2">
          {slot?.cardName}
        </div>
        <div
          className="absolute -top-2 -right-2 flex items-center
                     justify-center w-6 h-6 bg-blue-500 text-white
                     text-xs font-bold rounded-full border-2 border-white
                     shadow-md pointer-events-none"
        >
          {cardQuantity}
        </div>
      </div>
    );
  }

  // Empty slot
  return (
    <div
      onClick={handleClick}
      className={[
        "relative flex flex-col items-center justify-center w-24 h-36 rounded-md border-2 transition-all duration-150",
        isDragOver
          ? "bg-green-500/40 border-green-300 border-solid scale-105 shadow-lg shadow-green-400/40 cursor-copy"
          : "bg-green-700/50 border-dashed " +
            (highlightEmpty
              ? "border-green-300 hover:bg-green-700/70 hover:border-green-400 cursor-pointer"
              : "border-green-700"),
      ].join(" ")}
      {...sharedDragProps}
    >
      {isInteractive && (
        <div
          className={`text-2xl transition-colors ${
            isDragOver
              ? "text-green-200"
              : highlightEmpty
                ? "text-green-300"
                : "text-green-600/60"
          }`}
        >
          {isDragOver ? "↓" : "+"}
        </div>
      )}
    </div>
  );
}
