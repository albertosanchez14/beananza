"use client";

import { ReactNode, useContext } from "react";
import { Slot } from "@/schemas/types";
import { GameContext } from "./game-context";

type SlotProp = {
  slot: Slot;
  index: number;
  children?: ReactNode;
  /** When false, renders as a read-only display slot (no click/drag). Default true. */
  interactive?: boolean;
  /** When true, rotates the slot 180° (opponent perspective). Default false. */
  rotated?: boolean;
};

export default function NewSlot({ slot, index, children, interactive = true, rotated = false }: SlotProp) {
  // Always call unconditionally — rules of hooks. Will be null outside GameProvider.
  const ctx = useContext(GameContext);

  const isInteractive = interactive && ctx !== null;

  const dragOverSlot = isInteractive ? ctx!.dragOverSlot : null;
  const animatingSlot = isInteractive ? ctx!.animatingSlot : null;
  const highlightEmpty = isInteractive ? ctx!.highlightEmpty : false;

  const filled = !!(slot.cardName && slot.cardQuantity > 0);
  const isDragOver = dragOverSlot === slot.slotId;
  const isAnimating = animatingSlot === slot.slotId;

  const onDrop = (e: React.DragEvent) => {
    if (!isInteractive) return;
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/card");
    if (!raw) return;
    try {
      const card = JSON.parse(raw);
      ctx!.handleFieldDrop(slot.slotId, index, card);
    } catch {
      // ignore malformed payload
    }
  };

  const sharedDragProps = isInteractive ? {
    onDragOver: (e: React.DragEvent) => ctx!.handleDragOver(e, slot.slotId),
    onDragLeave: ctx!.handleDragLeave,
    onDrop,
  } : {};

  const handleClick = isInteractive
    ? () => ctx!.handleFieldSlotClick(slot.slotId, index)
    : undefined;

  // Filled slot — card provided as children
  if (filled && children) {
    return (
      <div
        className={`relative select-none
          ${isInteractive ? "cursor-pointer" : ""}
          ${isAnimating ? "animate-plant" : rotated ? "transition-none" : "transition-all duration-150"}
          ${rotated ? "[transform:rotate(180deg)] card-no-transition" : ""}
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
          {slot.cardQuantity}
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
          isAnimating ? "animate-plant" : rotated ? "transition-none" : "transition-all duration-150",
          rotated ? "[transform:rotate(180deg)] card-no-transition" : "",
        ].join(" ")}
        onClick={handleClick}
        {...sharedDragProps}
      >
        <div className="text-xs font-semibold text-center px-2 text-gray-800 line-clamp-2">
          {slot.cardName}
        </div>
        <div
          className="absolute -top-2 -right-2 flex items-center
                     justify-center w-6 h-6 bg-blue-500 text-white
                     text-xs font-bold rounded-full border-2 border-white
                     shadow-md pointer-events-none"
        >
          {slot.cardQuantity}
        </div>
      </div>
    );
  }

  // Empty slot
  return (
    <div
      onClick={handleClick}
      className={[
        "relative flex flex-col items-center justify-center w-24 h-36 rounded-md border-2",
        isAnimating ? "animate-plant" : "transition-all duration-150",
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
