"use client";
import { useCallback } from "react";
import { useWaitingLobbyState, WaitingLobbyState } from "@/hooks/state";
import { SendFn, WebSocketMessage } from "@/hooks/useWebSocket";

export type WaitingRoomContext = {
  waitingLobbyState: WaitingLobbyState;
  leave: () => boolean;
  setReady: (ready: boolean) => boolean;
};

type UseWaitingRoomResult = WaitingRoomContext & {
  join: (playerName: string) => boolean;
  reconnect: (sessionToken: string, playerName: string) => boolean;
};

export function useWaitingRoom(
  send: SendFn,
  lastMessage: WebSocketMessage | null,
  roomId: string,
  playerId: string,
): UseWaitingRoomResult {
  const waitingLobbyState = useWaitingLobbyState(lastMessage, playerId);

  const join = useCallback(
    (playerName: string) => send("join", roomId, { player_name: playerName }),
    [send, roomId],
  );

  const reconnect = useCallback(
    (sessionToken: string, playerName: string) =>
      send("reconnect", roomId, {
        session_token: sessionToken,
        player_name: playerName,
      }),
    [send, roomId],
  );

  const leave = useCallback(() => send("leave", roomId, {}), [send, roomId]);

  const setReady = useCallback(
    (ready: boolean) => send("ready", roomId, { ready }),
    [send, roomId],
  );

  return { waitingLobbyState, join, reconnect, leave, setReady };
}
