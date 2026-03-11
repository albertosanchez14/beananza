"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useActions, BroadcastPayload } from "@/hooks/useActions";
import {
  useGameState,
  useSessionState,
  useWaitingLobbyState,
} from "@/hooks/state";
import { useGameConfig } from "@/hooks/useGameConfig";
import { JoinedResponsePayload } from "@/schemas/messages";
import WaitingRoom from "./waiting-room";
import GameRoom from "./game-room";
import RunningRoom from "./running-room";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost/ws";

function loadProfile() {
  try {
    const raw = localStorage.getItem("playerProfile");
    const profile = raw ? JSON.parse(raw) : null;
    // Require all three fields — a missing authToken means the profile was
    // created before auth was introduced and the user must re-register.
    if (!profile?.playerId || !profile?.name || !profile?.authToken) return null;
    return {
      id: profile.playerId as string,
      name: profile.name as string,
      authToken: profile.authToken as string,
    };
  } catch {
    return null;
  }
}

export default function Page() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const [profile, setProfile] = useState<{
    id: string;
    name: string;
    authToken: string;
  } | null>(null);

  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      router.replace(`/identify?returnTo=/room/${roomId}`);
    } else {
      setProfile(p);
    }
  }, [router, roomId]);

  const playerId = profile?.id ?? "";
  const playerName = profile?.name ?? "";
  const authToken = profile?.authToken ?? "";

  const {
    sendJoin,
    sendLeave,
    sendReconnect,
    isConnected,
    lastMessage,
    plantBean,
    harvestField,
    turnOverBean,
    drawCards,
    setReady,
    myState,
    createOffer,
    counterOffer,
    respondOffer,
  } = useActions({
    wsUrl: WS_URL,
    playerId,
    authToken,
    onMessage: (message) => {
      console.log("Room received message:", message);

      if (message.type === "joined") {
        // Store the session token for reconnect support.
        const joined = message.payload as unknown as JoinedResponsePayload;
        if (joined?.session_token) {
          sessionStorage.setItem(
            `session_token:${roomId}`,
            joined.session_token,
          );
        }
        // If the session is already playing or paused, pull our game state.
        if (
          joined.session_state === "playing" ||
          joined.session_state === "pause"
        ) {
          myState(roomId);
        }
        return;
      }

      if (message.type === "broadcast") {
        const broadcastPayload = message.payload as BroadcastPayload;
        switch (broadcastPayload.event) {
          case "player_joined":
          case "player_left":
          case "player_ready":
          case "game_started":
            myState(roomId);
            break;
        }
      }
    },
    onError: (error) => {
      console.error("Room WebSocket error:", error);
      if (error.code === "unauthorized") {
        // Stale or missing auth token — wipe the profile and force re-registration,
        // then return the user directly back to this room.
        localStorage.removeItem("playerProfile");
        router.replace(`/identify?returnTo=/room/${roomId}`);
      }
      // Other errors are surfaced reactively via useSessionState reading lastMessage.
    },
  });

  const sessionState = useSessionState(lastMessage);
  const waitingLobbyState = useWaitingLobbyState(lastMessage, playerId);
  const gameState = useGameState(lastMessage);
  const { config, cardLookup } = useGameConfig();

  // Send join once connected and profile is loaded.
  const joinedRef = useRef(false);
  useEffect(() => {
    if (isConnected && playerId && playerName && !joinedRef.current) {
      const storedToken = sessionStorage.getItem(`session_token:${roomId}`);
      if (storedToken) {
        joinedRef.current = true;
        sendReconnect(roomId, {
          session_token: storedToken,
          player_name: playerName,
        });
      } else {
        joinedRef.current = true;
        sendJoin(roomId, { player_name: playerName });
      }
    }
  }, [isConnected, playerId, playerName, roomId, sendJoin, sendReconnect]);

  // Don't render until the profile check completes.
  if (!profile) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-black">
      <main className="relative flex h-screen w-full flex-col bg-white dark:bg-black">
        {sessionState === "connecting" && (
          <div className="flex h-full items-center justify-center">
            <span className="text-sm text-zinc-400 dark:text-zinc-600">
              Connecting...
            </span>
          </div>
        )}

        {sessionState === "gameAlreadyStarted" && (
          <RunningRoom roomId={roomId} />
        )}

        {sessionState === "waiting" && (
          <WaitingRoom
            roomId={roomId}
            playerId={playerId}
            waitingLobbyState={waitingLobbyState}
            setReady={setReady}
            sendLeave={sendLeave}
          />
        )}

        {(sessionState === "playing" || sessionState === "pause") && (
          <GameRoom
            roomId={roomId}
            playerId={playerId}
            gameState={gameState}
            cardsPerTurn={config?.cards_per_turn}
            cardLookup={cardLookup}
            plantBean={plantBean}
            harvestField={harvestField}
            turnOverBean={turnOverBean}
            drawCards={drawCards}
            createOffer={createOffer}
            counterOffer={counterOffer}
            respondOffer={respondOffer}
          />
        )}
      </main>
    </div>
  );
}
