import { ReactNode } from "react";
import { CardType, SlotType } from "@/schemas/types";

type SlotProp = {
  slot?: SlotType | null;
  index: number;
  children?: ReactNode;
  interactive?: boolean;
  rotated?: boolean;
  dragOverSlot?: string | null;
  animatingSlot?: string | null;
  highlightEmpty?: boolean;
  handleDragOver?: (e: React.DragEvent, slotId: string) => void;
  handleDragLeave?: (e: React.DragEvent) => void;
  handleFieldDrop?: (slotId: string, slotIndex: number, card: CardType) => void;
  handleSlotClick?: (slotId: string, slotIndex: number) => void;
};

export default function Slot({
  slot,
  index,
  children,
  interactive = true,
  rotated = false,
  dragOverSlot = null,
  animatingSlot = null,
  highlightEmpty = false,
  handleDragOver,
  handleDragLeave,
  handleFieldDrop,
  handleSlotClick,
}: SlotProp) {
  const isInteractive = interactive;

  const cardQuantity = slot?.cardIds.length ?? 0;

  const filled = !!(slot?.cardName && cardQuantity > 0);
  const isDragOver = dragOverSlot === slot?.slotId;
  const isAnimating = animatingSlot === slot?.slotId;

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
          ${isAnimating ? "animate-plant" : rotated ? "transition-none" : "transition-all duration-150"}
          ${rotated ? "transform-[rotate(180deg)] card-no-transition" : ""}
        `}
          onClick={handleClick}
          {...sharedDragProps}
        >
          {children}
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
          isAnimating ? "animate-plant" : "transition-all duration-150",
          isDragOver
            ? "border-amber-300 border-solid scale-105 shadow-lg shadow-amber-400/40 cursor-copy"
            : "border-dashed " +
              (highlightEmpty
                ? "border-amber-400 hover:border-amber-300 cursor-pointer"
                : "border-amber-900/50"),
        ].join(" ")}
        onClick={handleClick}
        {...sharedDragProps}
      >
        {isInteractive && (
          <div
            className={`text-2xl transition-colors ${
              isDragOver
                ? "text-amber-200"
                : highlightEmpty
                  ? "text-amber-400"
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
