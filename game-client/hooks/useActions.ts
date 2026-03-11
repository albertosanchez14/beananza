import { useCallback } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";
import { OfferCard } from "@/schemas/types";
import {
  JoinedResponsePayload,
  PlayerJoinedBroadcastData,
  PlayerLeftBroadcastData,
  PlayerReadyBroadcastData,
} from "@/schemas/messages";

// ---------------------------------------------------------------------------
// Message types
// ---------------------------------------------------------------------------

/**
 * All WebSocket message type strings used in the protocol.
 *
 * Client → Server:
 *   join              — join a room
 *   leave             — leave a room
 *   ready             — set ready state in the waiting lobby
 *   action            — game action (plantBean, tradeBean, …)
 *   myState           — request the server to push a fresh personalised state
 *   reconnect         — re-bind to a session using a stored token
 *
 * Server → Client:
 *   joined            — server acknowledges join; contains session_token
 *   myState           — personalised game state snapshot
 *   waitingLobbyState — waiting lobby snapshot
 *   broadcast         — room-wide event (player_joined, game_started, …)
 *   error             — error response
 */
export type MessageType =
  | "join"
  | "leave"
  | "ready"
  | "action"
  | "myState"
  | "reconnect"
  | "joined"
  | "waitingLobbyState"
  | "broadcast"
  | "error";

// ---------------------------------------------------------------------------
// Broadcast event types
// ---------------------------------------------------------------------------

/** Discriminated union of all broadcast event payloads. */
export type BroadcastEvent =
  | { event: "player_joined"; data: PlayerJoinedBroadcastData }
  | { event: "player_left"; data: PlayerLeftBroadcastData }
  | { event: "player_ready"; data: PlayerReadyBroadcastData }
  | { event: "game_started"; data: Record<string, never> }
  | { event: "state_updated"; data: Record<string, never> };

/** Convenience alias matching the old shape — use BroadcastEvent where possible. */
export type BroadcastPayload = BroadcastEvent;

// ---------------------------------------------------------------------------
// Action payload types (Client → Server inside a "action" message)
// ---------------------------------------------------------------------------

export type PlantBeanActionPayload = {
  type: "plantBean";
  playerId: string;
  cardId: string;
  slotId: string;
};

export type TradeBeanActionPayload = {
  type: "tradeBean";
  fromPlayerId: string;
  toPlayerId: string;
  /** Card IDs that fromPlayer gives to toPlayer. */
  cardsGiven: string[];
  /** Card IDs that fromPlayer receives from toPlayer. */
  cardsReceived: string[];
};

export type HarvestFieldActionPayload = {
  type: "harvestField";
  playerId: string;
  slotId: string;
};

export type TurnOverBeanActionPayload = {
  type: "turnOverBean";
};

export type DrawCardsActionPayload = {
  type: "drawCards";
};

export type CreateOfferActionPayload = {
  type: "createOffer";
  cards_offered: OfferCard[];
  cards_requested: OfferCard[];
  target_player_id?: string;
};

export type CounterOfferActionPayload = {
  type: "counterOffer";
  parent_offer_id: string;
  cards_offered: OfferCard[];
  cards_requested: OfferCard[];
};

export type RespondOfferActionPayload = {
  type: "respondOffer";
  offer_id: string;
  action: "accept" | "reject" | "cancel";
};

export type ActionPayload =
  | PlantBeanActionPayload
  | TradeBeanActionPayload
  | HarvestFieldActionPayload
  | TurnOverBeanActionPayload
  | DrawCardsActionPayload
  | CreateOfferActionPayload
  | CounterOfferActionPayload
  | RespondOfferActionPayload;

// ---------------------------------------------------------------------------
// Envelope types (Client → Server)
// ---------------------------------------------------------------------------

export interface WebSocketMessage {
  type: MessageType;
  room_id: string;
  player_id: string;
  auth_token?: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface JoinPayload extends Record<string, unknown> {
  player_name: string;
  metadata?: Record<string, unknown>;
}

export interface LeavePayload extends Record<string, unknown> {
  reason?: string;
}

export interface ReconnectPayload extends Record<string, unknown> {
  session_token: string;
  player_name?: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
}

// Re-export for consumers that import JoinedResponsePayload from here
export type { JoinedResponsePayload };

// ---------------------------------------------------------------------------
// Hook options / return types
// ---------------------------------------------------------------------------

export interface UseActionsOptions {
  wsUrl: string;
  playerId: string;
  authToken?: string;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: ErrorPayload) => void;
  shouldReconnect?: boolean;
}

export interface UseActionsReturn {
  // Connection state
  readyState: ReadyState;
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnected: boolean;

  lastMessage: WebSocketMessage | null;

  // Lifecycle
  sendJoin: (roomId: string, payload: JoinPayload) => boolean;
  sendLeave: (roomId: string, payload?: LeavePayload) => boolean;
  sendReconnect: (roomId: string, payload: ReconnectPayload) => boolean;
  sendCustomMessage: (message: Partial<WebSocketMessage>) => boolean;

  // Game actions
  plantBean: (
    roomId: string,
    playerId: string,
    cardId: string,
    slotId: string,
  ) => boolean;
  /**
   * Trade beans between two players.
   * @param cardsGiven    IDs of cards fromPlayer gives to toPlayer.
   * @param cardsReceived IDs of cards fromPlayer receives from toPlayer.
   */
  tradeBean: (
    roomId: string,
    fromPlayerId: string,
    toPlayerId: string,
    cardsGiven: string[],
    cardsReceived: string[],
  ) => boolean;
  harvestField: (roomId: string, playerId: string, slotId: string) => boolean;
  turnOverBean: (roomId: string) => boolean;
  drawCards: (roomId: string) => boolean;
  setReady: (roomId: string, ready: boolean) => boolean;
  myState: (roomId: string) => boolean;
  createOffer: (
    roomId: string,
    cardsOffered: OfferCard[],
    cardsRequested: OfferCard[],
    targetPlayerId?: string,
  ) => boolean;
  counterOffer: (
    roomId: string,
    parentOfferId: string,
    cardsOffered: OfferCard[],
    cardsRequested: OfferCard[],
  ) => boolean;
  respondOffer: (
    roomId: string,
    offerId: string,
    action: "accept" | "reject" | "cancel",
  ) => boolean;
}

// ---------------------------------------------------------------------------
// Hook implementation
// ---------------------------------------------------------------------------

/**
 * Custom hook to manage WebSocket actions for the card game.
 */
export function useActions({
  wsUrl,
  playerId,
  authToken,
  onMessage,
  onError,
  shouldReconnect = true,
}: UseActionsOptions): UseActionsReturn {
  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(wsUrl, {
    share: false,
    shouldReconnect: () => shouldReconnect,
    onMessage: (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;

        if (message.type === "error" && onError) {
          const errorPayload = message.payload as unknown as ErrorPayload;
          onError(errorPayload);
        }

        if (onMessage) {
          onMessage(message);
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    },
  });

  const isConnectionReady = useCallback(() => {
    if (readyState !== ReadyState.OPEN) {
      console.warn("WebSocket is not connected. Cannot send message.");
      return false;
    }
    return true;
  }, [readyState]);

  const createMessage = useCallback(
    (
      type: MessageType,
      roomId: string,
      payload: Record<string, unknown>,
    ): WebSocketMessage => ({
      type,
      room_id: roomId,
      player_id: playerId,
      ...(authToken ? { auth_token: authToken } : {}),
      payload,
      timestamp: new Date().toISOString(),
    }),
    [playerId, authToken],
  );

  // -------------------------------------------------------------------------
  // Lifecycle actions
  // -------------------------------------------------------------------------

  const sendJoin = useCallback(
    (roomId: string, payload: JoinPayload): boolean => {
      if (!isConnectionReady()) return false;
      sendJsonMessage(createMessage("join", roomId, payload));
      return true;
    },
    [isConnectionReady, createMessage, sendJsonMessage],
  );

  const sendLeave = useCallback(
    (roomId: string, payload: LeavePayload = {}): boolean => {
      if (!isConnectionReady()) return false;
      sendJsonMessage(createMessage("leave", roomId, payload));
      return true;
    },
    [isConnectionReady, createMessage, sendJsonMessage],
  );

  const sendReconnect = useCallback(
    (roomId: string, payload: ReconnectPayload): boolean => {
      if (!isConnectionReady()) return false;
      sendJsonMessage(
        createMessage("reconnect", roomId, payload as Record<string, unknown>),
      );
      return true;
    },
    [isConnectionReady, createMessage, sendJsonMessage],
  );

  const sendCustomMessage = useCallback(
    (message: Partial<WebSocketMessage>): boolean => {
      if (!isConnectionReady()) return false;

      if (!message.type) {
        console.error("Message type is required");
        return false;
      }

      const fullMessage: WebSocketMessage = {
        type: message.type,
        room_id: message.room_id ?? "",
        player_id: message.player_id || playerId,
        payload: message.payload || {},
        timestamp: message.timestamp || new Date().toISOString(),
      };

      sendJsonMessage(fullMessage);
      return true;
    },
    [isConnectionReady, playerId, sendJsonMessage],
  );

  // -------------------------------------------------------------------------
  // Game actions
  // -------------------------------------------------------------------------

  const plantBean = useCallback(
    (
      roomId: string,
      playerId: string,
      cardId: string,
      slotId: string,
    ): boolean => {
      if (!isConnectionReady()) return false;
      const payload: PlantBeanActionPayload = {
        type: "plantBean",
        playerId,
        cardId,
        slotId,
      };
      sendJsonMessage(createMessage("action", roomId, payload));
      return true;
    },
    [isConnectionReady, createMessage, sendJsonMessage],
  );

  const tradeBean = useCallback(
    (
      roomId: string,
      fromPlayerId: string,
      toPlayerId: string,
      cardsGiven: string[],
      cardsReceived: string[],
    ): boolean => {
      if (!isConnectionReady()) return false;
      const payload: TradeBeanActionPayload = {
        type: "tradeBean",
        fromPlayerId,
        toPlayerId,
        cardsGiven,
        cardsReceived,
      };
      sendJsonMessage(createMessage("action", roomId, payload));
      return true;
    },
    [isConnectionReady, createMessage, sendJsonMessage],
  );

  const harvestField = useCallback(
    (roomId: string, playerId: string, slotId: string): boolean => {
      if (!isConnectionReady()) return false;
      const payload: HarvestFieldActionPayload = {
        type: "harvestField",
        playerId,
        slotId,
      };
      sendJsonMessage(createMessage("action", roomId, payload));
      return true;
    },
    [isConnectionReady, createMessage, sendJsonMessage],
  );

  const turnOverBean = useCallback(
    (roomId: string): boolean => {
      if (!isConnectionReady()) return false;
      const payload: TurnOverBeanActionPayload = { type: "turnOverBean" };
      sendJsonMessage(createMessage("action", roomId, payload));
      return true;
    },
    [isConnectionReady, createMessage, sendJsonMessage],
  );

  const drawCards = useCallback(
    (roomId: string): boolean => {
      if (!isConnectionReady()) return false;
      const payload: DrawCardsActionPayload = { type: "drawCards" };
      sendJsonMessage(createMessage("action", roomId, payload));
      return true;
    },
    [isConnectionReady, createMessage, sendJsonMessage],
  );

  const myState = useCallback(
    (roomId: string): boolean => {
      if (!isConnectionReady()) return false;
      const payload = { type: "myState" };
      sendJsonMessage(createMessage("myState", roomId, payload));
      return true;
    },
    [isConnectionReady, createMessage, sendJsonMessage],
  );

  const setReady = useCallback(
    (roomId: string, ready: boolean): boolean => {
      if (!isConnectionReady()) return false;
      sendJsonMessage(createMessage("ready", roomId, { ready }));
      return true;
    },
    [isConnectionReady, createMessage, sendJsonMessage],
  );

  const createOffer = useCallback(
    (
      roomId: string,
      cardsOffered: OfferCard[],
      cardsRequested: OfferCard[],
      targetPlayerId?: string,
    ): boolean => {
      if (!isConnectionReady()) return false;
      const payload: CreateOfferActionPayload = {
        type: "createOffer",
        cards_offered: cardsOffered,
        cards_requested: cardsRequested,
        ...(targetPlayerId ? { target_player_id: targetPlayerId } : {}),
      };
      sendJsonMessage(createMessage("action", roomId, payload));
      return true;
    },
    [isConnectionReady, createMessage, sendJsonMessage],
  );

  const counterOffer = useCallback(
    (
      roomId: string,
      parentOfferId: string,
      cardsOffered: OfferCard[],
      cardsRequested: OfferCard[],
    ): boolean => {
      if (!isConnectionReady()) return false;
      const payload: CounterOfferActionPayload = {
        type: "counterOffer",
        parent_offer_id: parentOfferId,
        cards_offered: cardsOffered,
        cards_requested: cardsRequested,
      };
      sendJsonMessage(createMessage("action", roomId, payload));
      return true;
    },
    [isConnectionReady, createMessage, sendJsonMessage],
  );

  const respondOffer = useCallback(
    (
      roomId: string,
      offerId: string,
      action: "accept" | "reject" | "cancel",
    ): boolean => {
      if (!isConnectionReady()) return false;
      const payload: RespondOfferActionPayload = {
        type: "respondOffer",
        offer_id: offerId,
        action,
      };
      sendJsonMessage(createMessage("action", roomId, payload));
      return true;
    },
    [isConnectionReady, createMessage, sendJsonMessage],
  );

  return {
    readyState,
    isConnected: readyState === ReadyState.OPEN,
    isConnecting: readyState === ReadyState.CONNECTING,
    isDisconnected:
      readyState === ReadyState.CLOSED || readyState === ReadyState.CLOSING,

    lastMessage: lastJsonMessage as WebSocketMessage | null,

    sendJoin,
    sendLeave,
    sendReconnect,
    sendCustomMessage,

    plantBean,
    tradeBean,
    harvestField,
    turnOverBean,
    drawCards,
    setReady,
    myState,

    createOffer,
    counterOffer,
    respondOffer,
  };
}
