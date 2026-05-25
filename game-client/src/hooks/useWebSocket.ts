import { useCallback } from "react";
import useWebSocketLib, { ReadyState } from "react-use-websocket";
import { getWebSocketUrl } from "@/lib/config";

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

export type WebSocketMessage = {
  type: MessageType;
  room_id: string;
  player_id: string;
  auth_token?: string;
  payload: Record<string, unknown>;
  timestamp: string;
};

export type SendFn = (
  type: MessageType,
  roomId: string,
  payload: Record<string, unknown>,
) => boolean;

export type WebSocketConnection = {
  lastMessage: WebSocketMessage | null;
  send: SendFn;
  isConnected: boolean;
};

export function useWebSocket(
  playerId: string,
  authToken: string,
): WebSocketConnection {
  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocketLib(
    getWebSocketUrl(),
    { share: false, shouldReconnect: () => true },
  );

  const send = useCallback<SendFn>(
    (type, roomId, payload) => {
      if (readyState !== ReadyState.OPEN) {
        console.warn("WebSocket is not connected. Cannot send message.");
        return false;
      }
      sendJsonMessage({
        type,
        room_id: roomId,
        player_id: playerId,
        ...(authToken ? { auth_token: authToken } : {}),
        payload,
        timestamp: new Date().toISOString(),
      });
      return true;
    },
    [readyState, playerId, authToken, sendJsonMessage],
  );

  return {
    lastMessage: lastJsonMessage as WebSocketMessage | null,
    send,
    isConnected: readyState === ReadyState.OPEN,
  };
}
