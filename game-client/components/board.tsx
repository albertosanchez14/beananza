"use client";

import Card from "@/components/card";
import Field from "@/components/field";
import { CardType, ExternalPlayer, FieldType } from "@/schemas/types";

type BoardProp = {
  myDeck: CardType[];
  myField: FieldType;
  players: ExternalPlayer[];
  centerCards: CardType[];
};

export default function Page({
  myDeck,
  myField,
  players,
  centerCards,
}: BoardProp) {
  // Calculate positions for players around the table
  const getPlayerPosition = (index: number, total: number) => {
    const startAngle = 180;
    const endAngle = 0;
    const angleRange = startAngle - endAngle;

    const angle = startAngle - (angleRange / (total - 1)) * index;
    const angleRad = (angle * Math.PI) / 180;

    const radiusX = 45;
    const radiusY = 40;

    const x = 50 + radiusX * Math.cos(angleRad);
    const y = 50 - radiusY * Math.sin(angleRad);

    return {
      left: `${x}%`,
      top: `${y}%`,
      transform: "translate(-50%, -50%)",
    };
  };

  return (
    <>
      {/* Other players positioned around the table */}
      <div className="relative w-full flex-1 flex items-center justify-center">
        {players.map((player, index) => {
          const position = getPlayerPosition(index, players.length);
          return (
            <div key={player.playerId} className="absolute" style={position}>
              <div className="flex flex-col items-center gap-2">
                <div className="bg-gray-200 dark:bg-gray-800 rounded-lg px-4 py-2">
                  <p className="text-sm font-semibold">{player.playerName}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {player.playerCards} cards
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {/* Center cards */}
        <div className="flex gap-4">
          {centerCards.map((card, index) => {
            return <Card key={index} cardName={card.cardName} />;
          })}
        </div>
      </div>

      <div className="mb-2">
        <Field field={myField} />
      </div>

      {/* Main player at the bottom */}
      <div className="w-full mt-auto mx-auto">
        <div className="flex justify-center gap-4">
          {myDeck.map((card, index) => {
            return <Card key={index} cardName={card.cardName} />;
          })}
        </div>
      </div>
    </>
  );
}
