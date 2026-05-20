"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWebSocket, WebSocketMessage } from "@/hooks/useWebSocket";
import { useWaitingRoom, WaitingRoomContext } from "@/hooks/useWaitingRoom";
import { useGameRoom, GameRoomContext } from "@/hooks/useGameRoom";
import { JoinedResponsePayload } from "@/schemas/messages";


export type ViewState =
  | "connecting"
  | "waiting"
  | "dealing"
  | "playing"
  | "pause"
  | "gameAlreadyStarted";

export type GameError = { code: string; message: string };

export type UseRoomConnectionResult = {
  viewState: ViewState;
  game: GameRoomContext;
  waiting: WaitingRoomContext;
  gameError: GameError | null;
  clearGameError: () => void;
  isConnected: boolean;
};

export function useRoomConnection(
  roomId: string,
  playerId: string,
  playerName: string,
  authToken: string,
  avatar: string,
  redirectToIdentify: () => void,
): UseRoomConnectionResult {
  const [viewState, setViewState] = useState<ViewState>("connecting");
  const [joinRetry, setJoinRetry] = useState(0);
  const [gameError, setGameError] = useState<GameError | null>(null);
  const clearGameError = useCallback(() => setGameError(null), []);

  const dealTriggeredRef = useRef(false);
  const joinedRef = useRef(false);

  const { lastMessage, send, isConnected } = useWebSocket(playerId, authToken);
  const prevMessageRef = useRef<WebSocketMessage | null>(null);
  const { requestState, ...game } = useGameRoom(
    send,
    lastMessage,
    roomId,
    playerId,
  );
  const { join, reconnect, ...waiting } = useWaitingRoom(
    send,
    lastMessage,
    roomId,
    playerId,
  );

  // ---------------------------------------------------------------------------
  // Message routing — useEffect instead of onMessage callback avoids the
  // stale-closure risk that comes from capturing state inside a callback ref.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!lastMessage || lastMessage === prevMessageRef.current) return;
    prevMessageRef.current = lastMessage;

    if (lastMessage.type === "joined") {
      const joined = lastMessage.payload as unknown as JoinedResponsePayload;
      if (joined?.session_token) {
        sessionStorage.setItem(`session_token:${roomId}`, joined.session_token);
      }
      const s = joined.session_state;
      if (s === "waiting") {
        setViewState("waiting");
      } else if (s === "playing") {
        dealTriggeredRef.current = true;
        setViewState("playing");
        requestState();
      } else if (s === "pause") {
        dealTriggeredRef.current = true;
        setViewState("pause");
        requestState();
      }
      return;
    }

    if (lastMessage.type === "waitingLobbyState") {
      if (viewState === "dealing" || viewState === "playing" || viewState === "pause") {
        dealTriggeredRef.current = false;
        setViewState("waiting");
      }
      return;
    }

    if (lastMessage.type === "broadcast") {
      const event = (lastMessage.payload as { event: string }).event;
      if (
        event === "player_joined" ||
        event === "player_left" ||
        event === "player_ready"
      ) {
        requestState();
      } else if (event === "game_started") {
        requestState();
        if (!dealTriggeredRef.current) {
          dealTriggeredRef.current = true;
          setViewState("dealing");
        }
      }
      return;
    }

    if (lastMessage.type === "error") {
      const { code, message } = lastMessage.payload as { code: string; message: string };
      if (code === "GAME_ALREADY_STARTED") {
        setViewState("gameAlreadyStarted");
      } else if (code === "unauthorized") {
        redirectToIdentify();
      } else if (code === "invalid_token") {
        sessionStorage.removeItem(`session_token:${roomId}`);
        joinedRef.current = false;
        setJoinRetry((n) => n + 1);
      } else {
        setGameError({ code, message });
      }
    }
  }, [lastMessage, requestState, redirectToIdentify, roomId]);

  // ---------------------------------------------------------------------------
  // Reset joinedRef when the WebSocket drops so the reconnect effect re-fires
  // on the next connection and sends a fresh join/reconnect message.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isConnected) {
      joinedRef.current = false;
    }
  }, [isConnected]);

  // ---------------------------------------------------------------------------
  // Join / reconnect — fires once on connect; joinedRef guards against re-sends
  // when deps change reference. Resetting joinedRef on invalid_token re-triggers.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isConnected && playerId && playerName && !joinedRef.current) {
      const storedToken = sessionStorage.getItem(`session_token:${roomId}`);
      joinedRef.current = true;
      if (storedToken) {
        reconnect(storedToken, playerName);
      } else {
        join(playerName, avatar);
      }
    }
  }, [
    avatar,
    isConnected,
    playerId,
    playerName,
    roomId,
    join,
    reconnect,
    joinRetry,
  ]);

  return { viewState, game, waiting, gameError, clearGameError, isConnected };
}
