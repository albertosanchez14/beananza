import { useCallback } from "react";
import useWebSocket, { ReadyState } from "react-use-websocket";

// Message Types
export type MessageType = "join" | "leave" | "action" | "error";

// Base Message Structure
export interface WebSocketMessage {
  type: MessageType;
  room_id?: string;
  player_id: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

// Join Message Payload
export interface JoinPayload extends Record<string, unknown> {
  player_name: string;
  metadata?: Record<string, unknown>;
}

// Leave Message Payload
export interface LeavePayload extends Record<string, unknown> {
  reason?: string;
}

// Error Message Payload
export interface ErrorPayload {
  code: string;
  message: string;
}

// Hook Options
export interface UseActionsOptions {
  wsUrl: string;
  playerId: string;
  onMessage?: (message: WebSocketMessage) => void;
  onError?: (error: ErrorPayload) => void;
  shouldReconnect?: boolean;
}

// Hook Return Type
export interface UseActionsReturn {
  // Connection state
  readyState: ReadyState;
  isConnected: boolean;
  isConnecting: boolean;
  isDisconnected: boolean;

  // Last message received
  lastMessage: WebSocketMessage | null;

  // Action methods
  sendJoin: (roomId: string, payload: JoinPayload) => boolean;
  sendLeave: (roomId: string, payload?: LeavePayload) => boolean;
  sendCustomMessage: (message: Partial<WebSocketMessage>) => boolean;

  plantBean: (
    roomId: string,
    playerId: string,
    cardId: string,
    fieldId: string,
  ) => boolean;
  tradeBean: (
    roomId: string,
    fromPlayerId: string,
    toPlayerId: string,
    cardId: string,
  ) => boolean;
  harvestField: (roomId: string, playerId: string, fieldId: string) => boolean;
  turnOverBean: (roomId: string) => boolean;
}

/**
 * Custom hook to manage WebSocket actions for the card game
 *
 * @example
 * const { sendJoin, sendMove, isConnected } = useActions({
 *   wsUrl: 'ws://localhost:8080/ws',
 *   playerId: 'player-123',
 *   onMessage: (msg) => console.log('Received:', msg),
 *   onError: (err) => console.error('Error:', err)
 * });
 *
 * // Join a room
 * sendJoin('room-456', { player_name: 'John' });
 *
 * // Make a move
 * sendMove('room-456', { action: 'play_card', data: { card_id: 'ace-spades' } });
 */
export function useActions({
  wsUrl,
  playerId,
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

        // Handle error messages
        if (message.type === "error" && onError) {
          const errorPayload = message.payload as unknown as ErrorPayload;
          onError(errorPayload);
        }

        // Call custom message handler
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
      roomId: string | undefined,
      payload: Record<string, unknown>,
    ): WebSocketMessage => ({
      type,
      room_id: roomId,
      player_id: playerId,
      payload,
      timestamp: new Date().toISOString(),
    }),
    [playerId],
  );

  const sendJoin = useCallback(
    (roomId: string, payload: JoinPayload): boolean => {
      if (!isConnectionReady()) return false;

      const message = createMessage("join", roomId, payload);
      sendJsonMessage(message);
      return true;
    },
    [isConnectionReady, createMessage, sendJsonMessage],
  );

  const sendLeave = useCallback(
    (roomId: string, payload: LeavePayload = {}): boolean => {
      if (!isConnectionReady()) return false;

      const message = createMessage("leave", roomId, payload);
      sendJsonMessage(message);
      return true;
    },
    [isConnectionReady, createMessage, sendJsonMessage],
  );

  const sendCustomMessage = useCallback(
    (message: Partial<WebSocketMessage>): boolean => {
      if (!isConnectionReady()) return false;

      // Ensure type is defined
      if (!message.type) {
        console.error("Message type is required");
        return false;
      }

      const fullMessage: WebSocketMessage = {
        type: message.type,
        room_id: message.room_id,
        player_id: message.player_id || playerId,
        payload: message.payload || {},
        timestamp: message.timestamp || new Date().toISOString(),
      };

      sendJsonMessage(fullMessage);
      return true;
    },
    [isConnectionReady, playerId, sendJsonMessage],
  );

  const plantBean = useCallback(
    (
      roomId: string,
      playerId: string,
      cardId: string,
      fieldId: string,
    ): boolean => {
      if (!isConnectionReady()) return false;

      const payload = { type: "plantBean", playerId, cardId, fieldId };
      const message = createMessage("action", roomId, payload);
      sendJsonMessage(message);
      return true;
    },
    [isConnectionReady, createMessage, sendJsonMessage],
  );

  const tradeBean = useCallback(
    (
      roomId: string,
      fromPlayerId: string,
      toPlayerId: string,
      cardId: string,
    ): boolean => {
      if (!isConnectionReady()) return false;

      const payload = { type: "tradeBean", fromPlayerId, toPlayerId, cardId };
      const message = createMessage("action", roomId, payload);
      sendJsonMessage(message);
      return true;
    },
    [isConnectionReady, createMessage, sendJsonMessage],
  );

  const harvestField = useCallback(
    (roomId: string, playerId: string, fieldId: string): boolean => {
      if (!isConnectionReady()) return false;

      const payload = { type: "harvestField", playerId, fieldId };
      const message = createMessage("action", roomId, payload);
      sendJsonMessage(message);
      return true;
    },
    [isConnectionReady, createMessage, sendJsonMessage],
  );

  const turnOverBean = useCallback(
    (roomId: string): boolean => {
      if (!isConnectionReady()) return false;

      const payload = { type: "harvestField" };
      const message = createMessage("action", roomId, payload);
      sendJsonMessage(message);
      return true;
    },
    [isConnectionReady, createMessage, sendJsonMessage],
  );

  return {
    // Connection state
    readyState,
    isConnected: readyState === ReadyState.OPEN,
    isConnecting: readyState === ReadyState.CONNECTING,
    isDisconnected:
      readyState === ReadyState.CLOSED || readyState === ReadyState.CLOSING,

    // Last message
    lastMessage: lastJsonMessage as WebSocketMessage | null,

    // Actions
    sendJoin,
    sendLeave,
    sendCustomMessage,

    plantBean,
    tradeBean,
    harvestField,
    turnOverBean,
  };
}
