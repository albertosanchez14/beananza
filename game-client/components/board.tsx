"use client";

import { useState } from "react";
import Card from "@/components/card";
import Field from "@/components/field";
import { CardType, ExternalPlayer, FieldType } from "@/schemas/types";

type BoardProp = {
  myHand: CardType[];
  myField: FieldType;
  players: ExternalPlayer[];
  centerCards: CardType[];
  onPlantBean: (cardId: string, fieldId: string, slotIndex: number) => void;
  onTradeBean: (cardId: string, toPlayerId: string) => void;
  onHarvestField: (fieldId: string, slotIndex: number) => void;
  onTurnOverBean: () => void;
};

export default function Board({
  myHand,
  myField,
  players,
  centerCards,
  onPlantBean,
  onTradeBean,
  onHarvestField,
  onTurnOverBean,
}: BoardProp) {
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);

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

  const handleCardClick = (card: CardType) => {
    // Toggle selection: if clicking the same card, deselect
    if (selectedCard?.cardId === card.cardId) {
      setSelectedCard(null);
    } else {
      setSelectedCard(card);
    }
  };

  const handleFieldSlotClick = (slotIndex: number) => {
    const slot = myField.slots[slotIndex];

    if (selectedCard) {
      // If a card is selected and clicking an empty slot, plant the bean
      // or same bean
      if (!slot || slot.cardName === selectedCard.cardName) {
        onPlantBean(selectedCard.cardId, myField.fieldId, slotIndex);
        setSelectedCard(null);
      }
    } else {
      // If no card is selected and clicking a filled slot, harvest it
      if (slot) {
        onHarvestField(myField.fieldId, slotIndex);
      }
    }
  };

  const handlePlayerClick = (playerId: string) => {
    if (selectedCard) {
      onTradeBean(selectedCard.cardId, playerId);
      setSelectedCard(null);
    }
  };

  const handleCenterDeckClick = () => {
    onTurnOverBean();
  };

  return (
    <>
      {/* Selection mode indicator */}
      {selectedCard && (
        <div className="mb-4 px-4 py-2 bg-blue-100 dark:bg-blue-900 rounded-lg text-center">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">
            Selected: <span className="font-bold">{selectedCard.cardName}</span>
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-300">
            Click a field to plant or a player to trade
          </p>
        </div>
      )}

      {/* Other players positioned around the table */}
      <div className="relative w-full flex-1 flex items-center justify-center">
        {players.map((player, index) => {
          const position = getPlayerPosition(index, players.length);
          return (
            <div
              key={player.playerId}
              className="absolute"
              style={position}
              onClick={() => handlePlayerClick(player.playerId)}
            >
              <div
                className={`flex flex-col items-center gap-2 transition-all duration-200
                  ${selectedCard ? "cursor-pointer hover:ring-4 hover:ring-blue-400 rounded-lg" : ""}
                `}
              >
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

        <div
          onClick={handleCenterDeckClick}
          className="flex text-center items-center justify-center w-20 h-20 mr-4 
												bg-linear-to-b from-green-600 to-green-700 
												border-2 border-green-800 rounded-lg shadow-lg
                        cursor-pointer hover:shadow-xl hover:scale-105 transition-all duration-200"
        >
          <span className="text-white text-xs font-semibold">Center Deck</span>
        </div>

        {/* Center cards */}
        <div className="flex gap-4">
          {centerCards.map((card, index) => {
            return <Card key={index} card={card} />;
          })}
        </div>
      </div>

      <div className="mb-2">
        <Field
          field={myField}
          onSlotClick={handleFieldSlotClick}
          highlightEmpty={!!selectedCard}
        />
      </div>

      {/* Main player at the bottom */}
      <div className="w-full mt-auto mx-auto">
        <div className="flex justify-center gap-4">
          {myHand.map((card, index) => {
            return (
              <Card
                key={index}
                card={card}
                isSelected={selectedCard?.cardId === card.cardId}
                onClick={() => handleCardClick(card)}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}
