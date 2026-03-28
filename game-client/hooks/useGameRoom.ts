"use client";
import { useCallback } from "react";
import { useGameState, GameState } from "@/hooks/state";
import { useGameConfig } from "@/hooks/useGameConfig";
import { SendFn, WebSocketMessage } from "@/hooks/useWebSocket";
import { CardType, OfferCard } from "@/schemas/types";

export type GameRoomContext = {
  gameState: GameState;
  cardLookup: Map<string, CardType>;
  cardsPerTurn?: number;
  plantBean: (cardId: string, slotId: string) => boolean;
  harvestField: (slotId: string) => boolean;
  turnOverBean: () => boolean;
  drawCards: () => boolean;
  createOffer: (
    offered: OfferCard[],
    requested: OfferCard[],
    targetId?: string,
  ) => boolean;
  counterOffer: (
    parentId: string,
    offered: OfferCard[],
    requested: OfferCard[],
  ) => boolean;
  respondOffer: (
    offerId: string,
    action: "accept" | "reject" | "cancel",
    cardsToGive?: OfferCard[],
  ) => boolean;
};

type UseGameRoomResult = GameRoomContext & {
  requestState: () => boolean;
};

export function useGameRoom(
  send: SendFn,
  lastMessage: WebSocketMessage | null,
  roomId: string,
  playerId: string,
): UseGameRoomResult {
  const gameState = useGameState(lastMessage);
  const { config, cardLookup } = useGameConfig();

  const requestState = useCallback(
    () => send("myState", roomId, { type: "myState" }),
    [send, roomId],
  );

  const plantBean = useCallback(
    (cardId: string, slotId: string) =>
      send("action", roomId, { type: "plantBean", playerId, cardId, slotId }),
    [send, roomId, playerId],
  );

  const harvestField = useCallback(
    (slotId: string) =>
      send("action", roomId, { type: "harvestField", playerId, slotId }),
    [send, roomId, playerId],
  );

  const turnOverBean = useCallback(
    () => send("action", roomId, { type: "turnOverBean" }),
    [send, roomId],
  );

  const drawCards = useCallback(
    () => send("action", roomId, { type: "drawCards" }),
    [send, roomId],
  );

  const createOffer = useCallback(
    (offered: OfferCard[], requested: OfferCard[], targetId?: string) =>
      send("action", roomId, {
        type: "createOffer",
        cards_offered: offered,
        cards_requested: requested,
        ...(targetId ? { target_player_id: targetId } : {}),
      }),
    [send, roomId],
  );

  const counterOffer = useCallback(
    (parentId: string, offered: OfferCard[], requested: OfferCard[]) =>
      send("action", roomId, {
        type: "counterOffer",
        parent_offer_id: parentId,
        cards_offered: offered,
        cards_requested: requested,
      }),
    [send, roomId],
  );

  const respondOffer = useCallback(
    (offerId: string, action: "accept" | "reject" | "cancel", cardsToGive?: OfferCard[]) =>
      send("action", roomId, {
        type: "respondOffer",
        offer_id: offerId,
        action,
        ...(cardsToGive && cardsToGive.length > 0 ? { cards_to_give: cardsToGive } : {}),
      }),
    [send, roomId],
  );

  return {
    gameState,
    cardLookup,
    cardsPerTurn: config?.cards_per_turn,
    requestState,
    plantBean,
    harvestField,
    turnOverBean,
    drawCards,
    createOffer,
    counterOffer,
    respondOffer,
  };
}
