"use client";

import { useState, useRef } from "react";
import Card from "@/components/card";
import { CardType, FieldType } from "@/schemas/types";

type FieldProp = {
  field: FieldType;
  onSlotClick?: (slotId: string, slotIndex: number) => void;
  onDrop?: (slotId: string, slotIndex: number, card: CardType) => void;
  highlightEmpty?: boolean;
  plantedSlotId?: string | null;
  standalone?: boolean;
  /** Name-keyed map of full CardType objects so filled slots can show card images. */
  cardLookup?: Map<string, CardType>;
};

export default function Field({
  field,
  onSlotClick,
  onDrop,
  highlightEmpty = false,
  plantedSlotId,
  standalone = true,
  cardLookup,
}: FieldProp) {
  const slots = field.slots || [];
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [animatingSlot, setAnimatingSlot] = useState<string | null>(null);
  const animTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isSlotFilled = (slot: (typeof slots)[0]): boolean => {
    return !!(slot && slot.cardName && slot.cardQuantity > 0);
  };

  const triggerAnimation = (slotId: string) => {
    if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current);
    setAnimatingSlot(slotId);
    animTimeoutRef.current = setTimeout(() => setAnimatingSlot(null), 350);
  };

  const handleDragOver = (e: React.DragEvent, slotId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot(slotId);
  };

  const handleDragLeave = () => {
    setDragOverSlot(null);
  };

  const handleDrop = (
    e: React.DragEvent,
    slotId: string,
    slotIndex: number,
  ) => {
    e.preventDefault();
    setDragOverSlot(null);
    const raw = e.dataTransfer.getData("application/card");
    if (!raw) return;
    try {
      const card: CardType = JSON.parse(raw);
      triggerAnimation(slotId);
      onDrop?.(slotId, slotIndex, card);
    } catch {
      // ignore malformed data
    }
  };

  const activeAnimSlot = animatingSlot ?? plantedSlotId ?? null;

  const inner = (
    <div
      className="relative flex gap-2 px-4 py-3
                 bg-green-800 border-2 border-green-900 rounded-lg shadow-2xl"
      style={
        standalone
          ? {
              transform: "rotateX(25deg) scaleX(1.08)",
              transformOrigin: "bottom center",
            }
          : undefined
      }
    >
      {slots.map((slot, index) => {
        const filled = isSlotFilled(slot);
        const isDragOver = dragOverSlot === slot.slotId;
        const isAnimating = activeAnimSlot === slot.slotId;
        const cardForSlot = filled
          ? (cardLookup?.get(slot.cardName) ?? null)
          : null;

        if (filled && cardForSlot) {
          // Render a real Card image for the slot, with quantity badge overlaid
          return (
            <div
              key={slot.slotId}
              className={`relative cursor-pointer select-none
                ${isAnimating ? "animate-plant" : "transition-all duration-150"}
              `}
              onClick={() => onSlotClick?.(slot.slotId, index)}
              onDragOver={(e) => handleDragOver(e, slot.slotId)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, slot.slotId, index)}
            >
              <Card card={cardForSlot} flipped={false} />
              {/* Quantity badge */}
              <div
                className="absolute -top-2 -right-2 flex items-center
                              justify-center w-6 h-6 bg-blue-500 text-white
                              text-xs font-bold rounded-full border-2 border-white
                              shadow-md z-10"
              >
                {slot.cardQuantity}
              </div>
            </div>
          );
        }

        // Empty slot (or filled but card not yet in lookup)
        const emptyClass = [
          "relative flex flex-col items-center justify-center w-24 h-36 rounded-md border-2",
          isAnimating ? "animate-plant" : "transition-all duration-150",
          filled
            ? // cardName known but not in lookup yet — plain box with text fallback
              "bg-white border-gray-300 shadow-md hover:shadow-xl hover:-translate-y-1 cursor-pointer"
            : isDragOver
              ? "bg-green-500/40 border-green-300 border-solid scale-105 shadow-lg shadow-green-400/40 cursor-copy"
              : "bg-green-700/50 border-dashed " +
                (highlightEmpty
                  ? "border-green-300 hover:bg-green-700/70 hover:border-green-400 cursor-pointer"
                  : "border-green-700"),
        ].join(" ");

        return (
          <div
            key={slot.slotId}
            onClick={() => onSlotClick?.(slot.slotId, index)}
            onDragOver={(e) => handleDragOver(e, slot.slotId)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, slot.slotId, index)}
            className={emptyClass}
          >
            {filled ? (
              <>
                <div className="text-xs font-semibold text-center px-2 text-gray-800 line-clamp-2">
                  {slot.cardName}
                </div>
                <div
                  className="absolute -top-2 -right-2 flex items-center
                                justify-center w-6 h-6 bg-blue-500 text-white
                                text-xs font-bold rounded-full border-2 border-white shadow-md"
                >
                  {slot.cardQuantity}
                </div>
              </>
            ) : (
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
      })}
    </div>
  );

  if (standalone) {
    return <div style={{ perspective: "700px" }}>{inner}</div>;
  }
  return inner;
}
