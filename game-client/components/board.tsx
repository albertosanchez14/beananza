import { useState } from "react";
import Card from "@/components/card";
import Field from "@/components/field";
import Player from "@/components/player";
import { CardType, ExternalPlayer, FieldType } from "@/schemas/types";

type BoardProp = {
  myHand: CardType[];
  myPickedCards: CardType[];
  myField: FieldType;
  players: ExternalPlayer[];
  centerCards: CardType[];
  currentTurnPlayerId?: string;
  gamePhase?: string;
  onPlantBean: (cardId: string, slotId: string) => void;
  onTradeBean: (cardId: string, toPlayerId: string) => void;
  onHarvestField: (slotId: string) => void;
  onTurnOverBean: () => void;
  onDrawCards: () => void;
};

export default function Board({
  myHand,
  myPickedCards,
  myField,
  players,
  centerCards,
  currentTurnPlayerId,
  gamePhase,
  onPlantBean,
  onTradeBean,
  onHarvestField,
  onTurnOverBean,
  onDrawCards,
}: BoardProp) {
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);

  // Calculate positions for players around the table
  // Players are distributed in a circle at equal distance from center
  const getPlayerPosition = (index: number, total: number) => {
    // Distribute players evenly around the top half of the circle (180 degrees)
    const startAngle = 180; // Left side
    const endAngle = 0; // Right side
    const angleRange = startAngle - endAngle;

    // Calculate angle for this player
    const angle =
      startAngle - (angleRange / (total > 1 ? total - 1 : 1)) * index;
    const angleRad = (angle * Math.PI) / 180;

    // Use same radius for both x and y to create a perfect circle
    const radius = 42; // Distance from center (in %)

    const x = 50 + radius * Math.cos(angleRad);
    const y = 50 - radius * Math.sin(angleRad);

    return {
      left: `${x}%`,
      top: `${y}%`,
      transform: "translate(-50%, -50%)",
    };
  };

  const handleCardClick = (
    card: CardType,
    source: "hand" | "picked" | "center" = "hand",
  ) => {
    // During plantTrade phase, only picked and center cards are selectable
    if (gamePhase === "plantTrade" && source === "hand") return;
    // Toggle selection: if clicking the same card, deselect
    if (selectedCard?.cardId === card.cardId) {
      setSelectedCard(null);
    } else {
      setSelectedCard(card);
    }
  };

  const handleFieldSlotClick = (slotId: string, slotIndex: number) => {
    const slot = myField.slots[slotIndex];

    if (selectedCard) {
      // If a card is selected and clicking an empty slot, plant the bean
      // or same bean
      if (!slot || !slot.cardName || slot.cardName === selectedCard.cardName) {
        onPlantBean(selectedCard.cardId, slotId);
        setSelectedCard(null);
      }
    } else {
      // If no card is selected and clicking a filled slot, harvest it
      if (slot && slot.cardName && slot.cardQuantity > 0) {
        onHarvestField(slot.slotId);
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
    if (gamePhase === "plantHand") {
      onTurnOverBean();
    } else {
      onDrawCards();
    }
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
            {gamePhase === "plantTrade"
              ? "Click a field slot to plant"
              : "Click a field to plant or a player to trade"}
          </p>
        </div>
      )}

      {/* Other players positioned around the table */}
      <div className="relative w-full flex-1 flex items-center justify-center">
        {players.map((player, index) => {
          const position = getPlayerPosition(index, players.length);
          return (
            <div key={player.playerId} className="absolute" style={position}>
              <Player
                player={player}
                onClick={handlePlayerClick}
                isClickable={!!selectedCard}
                isCurrentTurn={player.playerId === currentTurnPlayerId}
                gamePhase={gamePhase}
              />
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
            return (
              <Card
                key={index}
                card={card}
                isSelected={selectedCard?.cardId === card.cardId}
                onClick={() => handleCardClick(card, "center")}
              />
            );
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

      {/* Picked cards zone — shown whenever there are traded cards */}
      {myPickedCards.length > 0 && (
        <div className="mb-2 w-full">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-1 text-center">
            Traded cards
            {gamePhase === "plantTrade" ? " — must plant before advancing" : ""}
          </p>
          <div className="flex justify-center gap-4 rounded-xl px-4 py-3 border-2 border-amber-400 bg-amber-50 dark:bg-amber-950">
            {myPickedCards.map((card, index) => (
              <Card
                key={index}
                card={card}
                isSelected={selectedCard?.cardId === card.cardId}
                onClick={() => handleCardClick(card, "picked")}
              />
            ))}
          </div>
        </div>
      )}

      {/* Main player at the bottom */}
      <div className="w-full mt-auto mx-auto">
        <div
          className={`flex justify-center gap-4 ${gamePhase === "plantTrade" ? "opacity-40 pointer-events-none" : ""}`}
        >
          {myHand.map((card, index) => {
            return (
              <Card
                key={index}
                card={card}
                isSelected={selectedCard?.cardId === card.cardId}
                onClick={() => handleCardClick(card, "hand")}
              />
            );
          })}
        </div>
      </div>
    </>
  );
}
