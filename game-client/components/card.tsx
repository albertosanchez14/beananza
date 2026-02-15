"use client";

type CardProp = { cardName: string };

export default function Page({ cardName }: CardProp) {
  // TODO: add image file

  return (
    <div className="flex w-20 h-30 px-2 py-4 bg-blue-200 border-b-gray-500 rounded-lg">
      <span className="text-black self-center">{cardName}</span>
    </div>
  );
}
