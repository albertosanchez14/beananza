import { createContext, useContext, useState, ReactNode } from "react";
import { CardType } from "@/schemas/types";
import { GameState } from "@/hooks/state";

type GameContextValue = {
  // UI state
  selectedCard: CardType | null;
  dragOverSlot: string | null;
  // Data
  gameState: GameState;
  cardsPerTurn?: number;
  cardLookup: Map<string, CardType>;
  highlightEmpty: boolean;
  // Increments each time the server returns a game-action error so Board
  // can roll back in-flight animations.
  actionErrorSignal: number;
  // Handlers
  handleCardClick: (
    card: CardType,
    source?: "hand" | "picked" | "center",
  ) => void;
  handleFieldSlotClick: (slotId: string, slotIndex: number) => void;
  handleFieldDrop: (slotId: string, slotIndex: number, card: CardType) => void;
  handleDragOver: (e: React.DragEvent, slotId: string) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrawDeckClick: () => void;
  onTurnOverBean: () => void;
  onDrawCards: () => void;
};

export const GameContext = createContext<GameContextValue | null>(null);

export function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGameContext must be used inside GameProvider");
  return ctx;
}

type GameProviderProps = {
  children: ReactNode;
  gameState: GameState;
  cardsPerTurn?: number;
  cardLookup: Map<string, CardType>;
  onPlantBean: (cardId: string, slotId: string) => void;
  onHarvestField: (slotId: string) => void;
  onTurnOverBean: () => void;
  onDrawCards: () => void;
  actionErrorSignal?: number;
};

export function GameProvider({
  children,
  gameState,
  cardsPerTurn,
  cardLookup,
  onPlantBean,
  onHarvestField,
  onTurnOverBean,
  onDrawCards,
  actionErrorSignal = 0,
}: GameProviderProps) {
  const [selectedCard, setSelectedCard] = useState<CardType | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  const handleCardClick = (
    card: CardType,
    source: "hand" | "picked" | "center" = "hand",
  ) => {
    if (gameState.phase === "plantTrade" && source === "hand") return;
    if (selectedCard?.cardId === card.cardId) {
      setSelectedCard(null);
    } else {
      setSelectedCard(card);
    }
  };

  const handleFieldSlotClick = (slotId: string, slotIndex: number) => {
    const slot = gameState.field.slots[slotIndex];
    if (selectedCard) {
      if (!slot || !slot.cardName || slot.cardName === selectedCard.cardName) {
        onPlantBean(selectedCard.cardId, slotId);
        setSelectedCard(null);
      }
    } else {
      if (slot && slot.cardName && slot.slotId.length > 0) {
        onHarvestField(slot.slotId);
      }
    }
  };

  const handleFieldDrop = (
    slotId: string,
    slotIndex: number,
    card: CardType,
  ) => {
    setDragOverSlot(null);
    const slot = gameState.field.slots[slotIndex];
    if (!slot || !slot.cardName || slot.cardName === card.cardName) {
      onPlantBean(card.cardId, slotId);
      setSelectedCard(null);
    }
  };

  const handleDragOver = (e: React.DragEvent, slotId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot(slotId);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear when the pointer truly leaves the slot — not when entering a child element.
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOverSlot(null);
  };

  const handleDrawDeckClick = () => {
    if (gameState.phase === "plantHand") {
      onTurnOverBean();
    } else {
      onDrawCards();
    }
  };

  const value: GameContextValue = {
    gameState,
    cardsPerTurn,
    selectedCard,
    dragOverSlot,
    cardLookup,
    highlightEmpty: !!selectedCard,
    actionErrorSignal,
    handleCardClick,
    handleFieldSlotClick,
    handleFieldDrop,
    handleDragOver,
    handleDragLeave,
    handleDrawDeckClick,
    onTurnOverBean,
    onDrawCards,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
