import { FieldType } from "@/schemas/types";

type FieldProp = {
  field: FieldType;
  onSlotClick?: (slotId: string, slotIndex: number) => void;
  highlightEmpty?: boolean;
};

export default function Field({
  field,
  onSlotClick,
  highlightEmpty = false,
}: FieldProp) {
  // Slots are always provided by the server, even when empty
  const slots = field.slots || [];

  // Helper to check if a slot has cards
  const isSlotFilled = (slot: typeof slots[0]) => {
    return slot && slot.cardName && slot.cardQuantity > 0;
  };

  return (
    <div className="flex gap-2 px-4 py-3 bg-linear-to-b from-green-600 to-green-700 border-2 border-green-800 rounded-lg shadow-lg">
      {slots.map((slot, index) => (
        <div
          key={slot.slotId}
          onClick={() => onSlotClick?.(slot.slotId, index)}
          className={`
            relative flex flex-col items-center justify-center
            w-20 h-28 rounded-md border-2
            transition-all duration-200
            ${
              isSlotFilled(slot)
                ? "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 shadow-md hover:shadow-xl hover:-translate-y-1 cursor-pointer"
                : `bg-green-700/50 border-dashed ${highlightEmpty ? "border-green-400 hover:bg-green-600/70 hover:border-green-500 cursor-pointer" : "border-green-600"}`
            }
          `}
        >
          {isSlotFilled(slot) ? (
            <>
              {/* Card name */}
              <div className="text-xs font-semibold text-center px-2 text-gray-800 dark:text-gray-100 line-clamp-2">
                {slot.cardName}
              </div>

              {/* Card quantity badge */}
              <div
                className="absolute -top-2 -right-2 flex items-center
							justify-center w-6 h-6 bg-blue-500 text-white text-xs 
							font-bold rounded-full border-2 border-white 
							dark:border-gray-900 shadow-md"
              >
                {slot.cardQuantity}
              </div>
            </>
          ) : (
            <div
              className={`text-2xl ${highlightEmpty ? "text-green-400" : "text-green-500/50"}`}
            >
              +
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
