import { ReactNode } from "react";
import { m, AnimatePresence } from "motion/react";
import { SlotType } from "@/schemas/types";

type SlotProp = {
  slot?: SlotType | null;
  index: number;
  children?: ReactNode;
  interactive?: boolean;
  dragOverSlot?: string | null;
  highlightEmpty?: boolean;
  blocked?: boolean;
  handleDragOver?: (e: React.DragEvent, slotId: string) => void;
  handleDragLeave?: (e: React.DragEvent) => void;
  handleSlotDrop?: (e: React.DragEvent, slotId: string) => void;
  handleSlotClick?: (slotId: string) => void;
  suppressAnimation?: boolean;
  popAnimation?: boolean;
  onPopComplete?: () => void;
};

export default function Slot({
  slot,
  children,
  interactive = true,
  dragOverSlot = null,
  highlightEmpty = false,
  blocked = false,
  handleDragOver,
  handleDragLeave,
  handleSlotDrop,
  handleSlotClick,
  suppressAnimation = false,
  popAnimation = false,
  onPopComplete,
}: SlotProp) {
  const isInteractive = interactive;
  const cardQuantity = slot?.cardIds.length ?? 0;
  const filled = !!(slot?.cardName && cardQuantity > 0);
  const isDragOver = dragOverSlot === slot?.slotId;

  const sharedDragProps =
    isInteractive && slot
      ? {
          onDragOver: (e: React.DragEvent) => handleDragOver?.(e, slot.slotId),
          onDragLeave: handleDragLeave,
          onDrop: (e: React.DragEvent) => handleSlotDrop?.(e, slot.slotId),
        }
      : {};

  const handleClick =
    isInteractive && slot ? () => handleSlotClick?.(slot.slotId) : undefined;

  if (filled && children) {
    return (
      <div
        className="flex w-31 h-42"
        style={{
          backgroundImage: "url('/slotnobg2.webp')",
          backgroundSize: "100% 100%",
          backgroundPosition: "center",
        }}
      >
        <div
          className={`relative select-none m-auto
          ${isInteractive ? "cursor-pointer" : ""}
        `}
          onClick={handleClick}
          role={isInteractive ? "button" : undefined}
          tabIndex={isInteractive ? 0 : undefined}
          onKeyDown={
            handleClick
              ? (e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") handleClick();
                }
              : undefined
          }
          {...sharedDragProps}
        >
          <AnimatePresence>
            <m.div
              key={`${slot?.slotId}-${slot?.cardName}`}
              initial={
                popAnimation
                  ? { scale: 1.12 }
                  : suppressAnimation
                    ? false
                    : { scale: 1.25, y: -16, rotate: -2 }
              }
              animate={{ scale: 1, y: 0, rotate: 0 }}
              transition={
                popAnimation
                  ? { duration: 0.2, ease: "easeOut" }
                  : { type: "spring", stiffness: 480, damping: 24 }
              }
              onAnimationComplete={popAnimation ? onPopComplete : undefined}
            >
              {children}
            </m.div>
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
      </div>
    );
  }

  return (
    <div
      className="flex w-31 h-42"
      style={{
        backgroundImage: "url('/slotnobg2.webp')",
        backgroundSize: "100% 100%",
        backgroundPosition: "center",
      }}
    >
      <div
        className={[
          "relative flex flex-col items-center justify-center w-24 h-36 rounded-sm border-2 m-auto",
          isDragOver
            ? blocked
              ? "border-red-500 border-solid cursor-not-allowed"
              : "border-amber-300 border-solid scale-105 shadow-lg shadow-amber-400/40 cursor-copy"
            : "border-dashed " +
              (highlightEmpty
                ? blocked
                  ? "border-red-500 hover:border-red-400 cursor-pointer"
                  : "border-amber-400 hover:border-amber-300 cursor-pointer"
                : "border-amber-900/50"),
        ].join(" ")}
        onClick={handleClick}
        role={isInteractive ? "button" : undefined}
        tabIndex={isInteractive ? 0 : undefined}
        onKeyDown={
          handleClick
            ? (e: React.KeyboardEvent) => {
                if (e.key === "Enter" || e.key === " ") handleClick();
              }
            : undefined
        }
        {...sharedDragProps}
      >
        {isInteractive && (
          <div
            className={`text-2xl transition-colors ${
              isDragOver
                ? blocked
                  ? "text-red-400"
                  : "text-amber-200"
                : highlightEmpty
                  ? blocked
                    ? "text-red-500"
                    : "text-amber-400"
                  : "text-amber-900/40"
            }`}
          >
            {isDragOver ? "↓" : "+"}
          </div>
        )}
      </div>
    </div>
  );
}
