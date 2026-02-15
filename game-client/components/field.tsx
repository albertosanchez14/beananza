import { FieldType } from "@/schemas/types";

type FieldProp = { field: FieldType };

export default function Field({ field }: FieldProp) {
  const maxSlots = 2;
  const slots = Array.from(
    { length: maxSlots },
    (_, index) => field[index] || null,
  );

  return (
    <div className="flex gap-2 px-4 py-3 bg-linear-to-b from-green-600 to-green-700 border-2 border-green-800 rounded-lg shadow-lg">
      {slots.map((slot, index) => (
        <div
          key={slot?.slotId || `empty-${index}`}
          className={`
            relative flex flex-col items-center justify-center
            w-20 h-28 rounded-md border-2
            transition-all duration-200
            ${
              slot
                ? "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 shadow-md hover:shadow-xl hover:-translate-y-1"
                : "bg-green-700/50 border-green-600 border-dashed"
            }
          `}
        >
          {slot ? (
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
            <div className="text-green-500/50 text-2xl">+</div>
          )}
        </div>
      ))}
    </div>
  );
}
