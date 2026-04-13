import { createContext, useContext, useState, ReactNode } from "react";
import {
  BaseCard,
  CardType,
  ExternalPlayer,
  Offer,
  OfferCard,
} from "@/schemas/types";
import { GameState } from "@/hooks/state";

type GameContextValue = {
  gameState: GameState;
  cardsPerTurn: number;
  cardLookup: Map<string, CardType>;
  myPlayerId: string;
  // Cards state and handlers
  selection: CardType[];
  clearSelection: () => void;
  handleCardClick: (
    card: CardType,
    source?: "hand" | "picked" | "center",
    ctrlKey?: boolean,
  ) => void;
  handleCardDrag: (
    e: React.DragEvent,
    card: BaseCard | CardType,
    source: "center" | "hand",
  ) => void;
  // Slot state and handlers
  dragOverSlot: string | null;
  dragSourceIsHand: boolean;
  dragSourceIsCenter: boolean;
  canPlantFromHand: boolean;
  canPlantCenterCard: boolean;
  handleSlotClick: (slotId: string) => void;
  handleSlotDrop: (e: React.DragEvent, slotId: string) => void;
  handleSlotDragOver: (e: React.DragEvent, slotId: string) => void;
  handleSlotDragLeave: (e: React.DragEvent) => void;
  // Opponent players sate and handlers
  dragOverPlayerId: string | null;
  dragOverBlockReason: string | null;
  handlePlayerDragOver: (e: React.DragEvent, targetPlayerId: string) => void;
  handlePlayerDragLeave: () => void;
  handlePlayerDrop: (e: React.DragEvent, targetPlayer: ExternalPlayer) => void;
  playerDropResult: { player: ExternalPlayer; cards: CardType[] } | null;
  clearPlayerDropResult: () => void;
  ////
  handleDrawDeckClick: () => void;
  // Offers state and handlers
  offers: Offer[];
  onCreateOffer: (
    offered: OfferCard[],
    requested: OfferCard[],
    targetId?: string,
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

const GameContext = createContext<GameContextValue | null>(null);

export function useGameContext(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGameContext must be used inside GameProvider");
  return ctx;
}

type GameProviderProps = {
  children: ReactNode;
  gameState: GameState;
  cardsPerTurn: number;
  cardLookup: Map<string, CardType>;
  myPlayerId: string;
  onPlantBean: (cardId: string, slotId: string) => void;
  onHarvestField: (slotId: string) => void;
  onTurnOverBean: () => void;
  onDrawCards: () => void;
  onCreateOffer: (
    offered: OfferCard[],
    requested: OfferCard[],
    targetId?: string,
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
  onCreateOffer,
  onRespondOffer,
  onCounterOffer,
}: GameProviderProps) {
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [dragSourceIsHand, setDragSourceIsHand] = useState(false);
  const [dragSourceIsCenter, setDragSourceIsCenter] = useState(false);
  const [dragOverPlayerId, setDragOverPlayerId] = useState<string | null>(null);
  const canPlantFromHand =
    gameState.phase === "plantHand" && gameState.playerTurn === myPlayerId;
  const canPlantCenterCard = gameState.playerTurn === myPlayerId;
  const [dragOverBlockReason, setDragOverBlockReason] = useState<string | null>(
    null,
  );
  const [playerDropResult, setPlayerDropResult] = useState<{
    player: ExternalPlayer;
    cards: CardType[];
  } | null>(null);
  const clearPlayerDropResult = () => setPlayerDropResult(null);
  const [selectionState, setSelectionState] = useState<{
    phase: string;
    cards: CardType[];
  }>({ phase: gameState.phase, cards: [] });
  const selection =
    selectionState.phase === gameState.phase ? selectionState.cards : [];

  const setSelection = (cards: CardType[]) =>
    setSelectionState({ phase: gameState.phase, cards });

  const toggleSelection = (card: CardType) => {
    setSelection(
      selection.some((c) => c.cardId === card.cardId)
        ? selection.filter((c) => c.cardId !== card.cardId)
        : [...selection, card],
    );
  };

  const singleClickSelect = (card: CardType) => {
    const isSelected = selection.some((c) => c.cardId === card.cardId);
    setSelection(isSelected && selection.length === 1 ? [] : [card]);
  };

  const clearSelection = () => setSelection([]);

  const handleCardClick = (
    card: CardType,
    source: "hand" | "picked" | "center" = "hand",
    ctrlKey = false,
  ) => {
    if (gameState.phase === "plantTrade" && source === "hand") return;
    if (gameState.phase === "turnTrade") {
      if (source === "center") {
        if (ctrlKey) {
          toggleSelection(card);
        } else {
          singleClickSelect(card);
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

  const handleCardDrag = (
    e: React.DragEvent,
    card: BaseCard | CardType,
    source: "center" | "hand",
  ) => {
    e.dataTransfer.setData("application/card", JSON.stringify(card));
    e.dataTransfer.effectAllowed = "move";

    if (source === "hand") {
      e.dataTransfer.setData("application/drag-from-hand", "");
    }

    const centerCardIds = new Set(gameState.centerCards.map((c) => c.cardId));
    const cardId = (card as CardType).cardId;
    const isInSelection = selection.some((c) => c.cardId === cardId);
    const selectionHasCenter = selection.some((c) =>
      centerCardIds.has(c.cardId),
    );

    const hasCenterCard =
      source === "center" ||
      (source === "hand" &&
        gameState.phase === "turnTrade" &&
        isInSelection &&
        selectionHasCenter);

    if (hasCenterCard) {
      e.dataTransfer.setData("application/drag-has-center", "true");
    }
  };

  const handleSlotClick = (slotId: string) => {
    const slot = gameState.field.slots.find((slot) => slot.slotId == slotId);
    const card = selection[0];
    if (card) {
      const isHandCard = gameState.hand.some((c) => c.cardId === card.cardId);
      if (isHandCard && !canPlantFromHand) return;
      const isCenterCard = gameState.centerCards.some(
        (c) => c.cardId === card.cardId,
      );
      if (isCenterCard && !canPlantCenterCard) return;
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

  const handleSlotDrop = (e: React.DragEvent, slotId: string) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/card");
    if (!raw) return;
    try {
      const card = JSON.parse(raw);
      setDragOverSlot(null);
      setDragSourceIsHand(false);
      setDragSourceIsCenter(false);
      const isHandCard = gameState.hand.some((c) => c.cardId === card.cardId);
      if (isHandCard && !canPlantFromHand) return;
      const isCenterCard = gameState.centerCards.some(
        (c) => c.cardId === card.cardId,
      );
      if (isCenterCard && !canPlantCenterCard) return;
      const slot = gameState.field.slots.find((slot) => slot.slotId == slotId);
      if (!slot || !slot.cardName || slot.cardName === card.cardName) {
        onPlantBean(card.cardId, slotId);
        setSelection([]);
      }
    } catch {
      // ignore malformed payload
    }
  };

  const handleSlotDragOver = (e: React.DragEvent, slotId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverSlot(slotId);
    setDragSourceIsHand(
      e.dataTransfer.types.includes("application/drag-from-hand"),
    );
    setDragSourceIsCenter(
      e.dataTransfer.types.includes("application/drag-has-center"),
    );
  };

  const handleSlotDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setDragOverSlot(null);
    setDragSourceIsHand(false);
    setDragSourceIsCenter(false);
  };

  const handlePlayerDragOver = (e: React.DragEvent, targetPlayerId: string) => {
    const isTurnPlayer = myPlayerId === gameState.playerTurn;
    const isEligibleTarget =
      isTurnPlayer || targetPlayerId === gameState.playerTurn;
    e.preventDefault();
    let blockReason: string | null = null;
    if (
      e.dataTransfer.types.includes("application/drag-from-hand") &&
      gameState.phase !== "turnTrade"
    ) {
      blockReason = "Trading only allowed during trade phase";
    } else if (!isEligibleTarget) {
      blockReason = "Can't trade with a non-turn player";
    } else if (
      !isTurnPlayer &&
      e.dataTransfer.types.includes("application/drag-has-center")
    ) {
      blockReason = "Can't give center cards";
    }
    setDragOverPlayerId(targetPlayerId);
    setDragOverBlockReason(blockReason);
  };

  const handlePlayerDragLeave = () => {
    setDragOverPlayerId(null);
    setDragOverBlockReason(null);
  };

  const handlePlayerDrop = (
    e: React.DragEvent,
    targetPlayer: ExternalPlayer,
  ) => {
    const isTurnPlayer = myPlayerId === gameState.playerTurn;
    const isEligibleTarget =
      isTurnPlayer || targetPlayer.playerId === gameState.playerTurn;

    e.preventDefault();
    setDragOverPlayerId(null);
    setDragOverBlockReason(null);
    if (!isEligibleTarget) return;
    const raw = e.dataTransfer.getData("application/card");
    if (!raw) return;
    try {
      const dragged = JSON.parse(raw) as CardType;
      const isHandCard = gameState.hand.some((c) => c.cardId === dragged.cardId);
      if (isHandCard && gameState.phase !== "turnTrade") return;

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
      if (cardsToDrop.length > 0)
        setPlayerDropResult({ player: targetPlayer, cards: cardsToDrop });
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
    cardLookup,
    myPlayerId,
    selection,
    clearSelection,
    handleCardClick,
    handleCardDrag,
    dragOverSlot,
    dragSourceIsHand,
    dragSourceIsCenter,
    canPlantFromHand,
    canPlantCenterCard,
    handleSlotClick,
    handleSlotDrop,
    handleSlotDragOver,
    handleSlotDragLeave,
    dragOverPlayerId,
    dragOverBlockReason,
    handlePlayerDragOver,
    handlePlayerDragLeave,
    handlePlayerDrop,
    playerDropResult,
    clearPlayerDropResult,
    handleDrawDeckClick,
    offers: gameState.offers,
    onCreateOffer,
    onRespondOffer,
    onCounterOffer,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
