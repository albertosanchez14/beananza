"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useActions, BroadcastPayload } from "@/hooks/useActions";
import { useGameState, useWaitingLobbyState } from "@/hooks/state";
import { useGameConfig } from "@/hooks/useGameConfig";
import { JoinedResponsePayload } from "@/schemas/messages";
import { wsUrl } from "@/lib/config";
import WaitingRoom from "./waiting-room";
import GameRoom from "./game-room";
import RunningRoom from "./running-room";

// ---------------------------------------------------------------------------
// View state — single source of truth for what to render.
// "dealing" is a client-only transient between "waiting" and "playing" that
// shows the deal animation overlaid on top of the already-mounted GameRoom.
// ---------------------------------------------------------------------------
type ViewState =
  | "connecting"
  | "waiting"
  | "dealing"
  | "playing"
  | "pause"
  | "gameAlreadyStarted";

function loadProfile() {
  try {
    const raw = localStorage.getItem("playerProfile");
    const profile = raw ? JSON.parse(raw) : null;
    if (!profile?.playerId || !profile?.name || !profile?.authToken)
      return null;
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

  // Single view-state enum — updated synchronously inside onMessage so there
  // is never a frame where state is inconsistent.
  const [viewState, setViewState] = useState<ViewState>("connecting");
  // Prevent multiple game_started events from re-triggering the deal anim.
  const dealTriggeredRef = useRef(false);

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
    wsUrl,
    playerId,
    authToken,
    onMessage: (message) => {
      console.log("Room received message:", message);

      if (message.type === "joined") {
        const joined = message.payload as unknown as JoinedResponsePayload;
        if (joined?.session_token) {
          sessionStorage.setItem(
            `session_token:${roomId}`,
            joined.session_token,
          );
        }
        const s = joined.session_state;
        if (s === "waiting") {
          setViewState("waiting");
        } else if (s === "playing") {
          // Reconnect / refresh straight into a live game — skip deal anim.
          dealTriggeredRef.current = true;
          setViewState("playing");
          myState(roomId);
        } else if (s === "pause") {
          dealTriggeredRef.current = true;
          setViewState("pause");
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
            myState(roomId);
            break;
          case "game_started":
            // Fetch game state immediately so GameRoom is ready underneath.
            myState(roomId);
            if (!dealTriggeredRef.current) {
              dealTriggeredRef.current = true;
              // Transition to "dealing" — GameRoom will mount underneath the
              // overlay so it has real state by the time the anim finishes.
              setViewState("dealing");
            }
            break;
        }
      }

      if (message.type === "error") {
        const errorPayload = message.payload as { code: string };
        if (errorPayload.code === "GAME_ALREADY_STARTED") {
          setViewState("gameAlreadyStarted");
        }
        if (errorPayload.code === "unauthorized") {
          localStorage.removeItem("playerProfile");
          router.replace(`/identify?returnTo=/room/${roomId}`);
        }
      }
    },
    onError: (error) => {
      console.error("Room WebSocket error:", error);
      if (error.code === "unauthorized") {
        localStorage.removeItem("playerProfile");
        router.replace(`/identify?returnTo=/room/${roomId}`);
      }
    },
  });

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

  if (!profile) return null;

  const showGame =
    viewState === "playing" || viewState === "pause" || viewState === "dealing";

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-black">
      <main className="relative flex h-screen w-full flex-col bg-white dark:bg-black">
        {viewState === "connecting" && (
          <div className="flex h-full items-center justify-center">
            <span className="text-sm text-zinc-400 dark:text-zinc-600">
              Connecting...
            </span>
          </div>
        )}

        {viewState === "gameAlreadyStarted" && <RunningRoom roomId={roomId} />}

        {viewState === "waiting" && (
          <WaitingRoom
            roomId={roomId}
            playerId={playerId}
            waitingLobbyState={waitingLobbyState}
            setReady={setReady}
            sendLeave={sendLeave}
          />
        )}

        {/* GameRoom — mounted as soon as game starts (underneath deal overlay) */}
        {showGame && (
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
