import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { CardType, ExternalPlayer, Offer, OfferCard } from "@/schemas/types";
import { GameState } from "@/hooks/state";

type GameContextValue = {
  // UI state
  dragOverSlot: string | null;
  dragOverPlayerId: string | null;
  dragOverBlockReason: string | null;
  selection: CardType[];
  // Data
  gameState: GameState;
  cardsPerTurn?: number;
  cardLookup: Map<string, CardType>;
  highlightEmpty: boolean;
  myPlayerId: string;
  // Handlers
  handleCardClick: (
    card: CardType,
    source?: "hand" | "picked" | "center",
    ctrlKey?: boolean,
  ) => void;
  handleFieldSlotClick: (slotId: string, slotIndex: number) => void;
  handleFieldDrop: (slotId: string, slotIndex: number, card: CardType) => void;
  handleDragOver: (e: React.DragEvent, slotId: string) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handlePlayerDragOver: (
    e: React.DragEvent,
    playerId: string,
    isEligibleTarget: boolean,
    isTurnPlayer: boolean,
  ) => void;
  handlePlayerDragLeave: () => void;
  handlePlayerDrop: (
    e: React.DragEvent,
    targetPlayer: ExternalPlayer,
    isEligibleTarget: boolean,
    isTurnPlayer: boolean,
  ) => void;
  handleDrawDeckClick: () => void;
  onTurnOverBean: () => void;
  onDrawCards: () => void;
  clearSelection: () => void;
  onGiveDrop: (targetPlayer: ExternalPlayer, cardsToGive: CardType[]) => void;
  onRequestDrop: (cardsRequested: CardType[]) => void;
  onCardRightClick: (
    card: CardType,
    targetPlayerId: string | undefined,
  ) => void;
  offers: Offer[];
  onRespondOffer: (
    offerId: string,
    action: "accept" | "reject" | "cancel",
    cardsToGive?: OfferCard[],
  ) => void;
  onCounterOffer: (
    parentId: string,
    offered: OfferCard[],
    requested: OfferCard[],
  ) => void;
};

const GameContext = createContext<GameContextValue | null>(null);

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
  myPlayerId: string;
  onPlantBean: (cardId: string, slotId: string) => void;
  onHarvestField: (slotId: string) => void;
  onTurnOverBean: () => void;
  onDrawCards: () => void;
  onGiveDrop: (targetPlayer: ExternalPlayer, cardsToGive: CardType[]) => void;
  onRequestDrop: (cardsRequested: CardType[]) => void;
  onCardRightClick: (
    card: CardType,
    targetPlayerId: string | undefined,
  ) => void;
  onRespondOffer: (
    offerId: string,
    action: "accept" | "reject" | "cancel",
    cardsToGive?: OfferCard[],
  ) => void;
  onCounterOffer: (
    parentId: string,
    offered: OfferCard[],
    requested: OfferCard[],
  ) => void;
};

export function GameProvider({
  children,
  gameState,
  cardsPerTurn,
  cardLookup,
  myPlayerId,
  onPlantBean,
  onHarvestField,
  onTurnOverBean,
  onDrawCards,
  onGiveDrop,
  onRequestDrop,
  onCardRightClick,
  onRespondOffer,
  onCounterOffer,
}: GameProviderProps) {
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [dragOverPlayerId, setDragOverPlayerId] = useState<string | null>(null);
  const [dragOverBlockReason, setDragOverBlockReason] = useState<string | null>(
    null,
  );
  const [selection, setSelection] = useState<CardType[]>([]);

  const toggleSelection = (card: CardType) => {
    setSelection((prev) =>
      prev.some((c) => c.cardId === card.cardId)
        ? prev.filter((c) => c.cardId !== card.cardId)
        : [...prev, card],
    );
  };

  const singleClickSelect = (card: CardType) => {
    setSelection((prev) => {
      const isSelected = prev.some((c) => c.cardId === card.cardId);
      if (isSelected && prev.length === 1) return [];
      return [card];
    });
  };

  const clearSelection = () => setSelection([]);

  useEffect(() => {
    setSelection([]);
  }, [gameState.phase]);

  const handleCardClick = (
    card: CardType,
    source: "hand" | "picked" | "center" = "hand",
    ctrlKey = false,
  ) => {
    if (gameState.phase === "plantTrade" && source === "hand") return;
    if (gameState.phase === "turnTrade") {
      if (source === "center") {
        if (myPlayerId === gameState.playerTurn) {
          // Turn player: ctrl+click adds to trade selection, regular click selects for planting
          if (ctrlKey) {
            toggleSelection(card);
          } else {
            singleClickSelect(card);
          }
        } else {
          // Non-turn player: ctrl+click toggles, regular click single-selects
          if (ctrlKey) {
            toggleSelection(card);
          } else {
            singleClickSelect(card);
          }
        }
        return;
      }
      // Hand cards
      if (ctrlKey) {
        toggleSelection(card);
      } else {
        singleClickSelect(card);
      }
      return;
    }
    singleClickSelect(card);
  };

  const handleFieldSlotClick = (slotId: string, slotIndex: number) => {
    const slot = gameState.field.slots[slotIndex];
    const card = selection[0];
    if (card) {
      if (!slot || !slot.cardName || slot.cardName === card.cardName) {
        onPlantBean(card.cardId, slotId);
        setSelection([]);
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
      setSelection([]);
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

  const handlePlayerDragOver = (
    e: React.DragEvent,
    playerId: string,
    isEligibleTarget: boolean,
    isTurnPlayer: boolean,
  ) => {
    e.preventDefault();
    let blockReason: string | null = null;
    if (!isEligibleTarget) {
      blockReason = "Can't trade with a non-turn player";
    } else if (
      !isTurnPlayer &&
      e.dataTransfer.types.includes("application/drag-has-center")
    ) {
      blockReason = "Can't give center cards";
    }
    setDragOverPlayerId(playerId);
    setDragOverBlockReason(blockReason);
  };

  const handlePlayerDragLeave = () => {
    setDragOverPlayerId(null);
    setDragOverBlockReason(null);
  };

  const handlePlayerDrop = (
    e: React.DragEvent,
    targetPlayer: ExternalPlayer,
    isEligibleTarget: boolean,
    isTurnPlayer: boolean,
  ) => {
    e.preventDefault();
    setDragOverPlayerId(null);
    setDragOverBlockReason(null);
    if (!isEligibleTarget) return;
    const raw = e.dataTransfer.getData("application/card");
    if (!raw) return;
    try {
      const dragged = JSON.parse(raw) as CardType;
      const isDraggedInSelection = selection.some(
        (c) => c.cardId === dragged.cardId,
      );
      const cardsToDrop = isDraggedInSelection ? [...selection] : [dragged];

      if (!isTurnPlayer) {
        const hasCenterCard = cardsToDrop.some((c) =>
          gameState.centerCards.some((cc) => cc.cardId === c.cardId),
        );
        if (hasCenterCard) {
          clearSelection();
          return;
        }
      }

      clearSelection();
      if (cardsToDrop.length > 0) onGiveDrop(targetPlayer, cardsToDrop);
    } catch {
      // ignore malformed payload
    }
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
    dragOverSlot,
    dragOverPlayerId,
    dragOverBlockReason,
    selection,
    cardLookup,
    highlightEmpty: selection.length === 1,
    myPlayerId,
    handleCardClick,
    handleFieldSlotClick,
    handleFieldDrop,
    handleDragOver,
    handleDragLeave,
    handlePlayerDragOver,
    handlePlayerDragLeave,
    handlePlayerDrop,
    handleDrawDeckClick,
    onTurnOverBean,
    onDrawCards,
    clearSelection,
    onGiveDrop,
    onRequestDrop,
    onCardRightClick,
    offers: gameState.offers,
    onRespondOffer,
    onCounterOffer,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
