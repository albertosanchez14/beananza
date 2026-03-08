"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useActions, BroadcastPayload } from "@/hooks/useActions";
import { useGameState, useWaitingLobbyState } from "@/hooks/state";
import { JoinedResponsePayload } from "@/schemas/messages";
import WaitingRoom from "./waiting-room";
import GameRoom from "./game-room";
import RunningRoom from "./running-room";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost/ws";

function loadProfile() {
  try {
    const raw = localStorage.getItem("playerProfile");
    const profile = raw ? JSON.parse(raw) : null;
    if (!profile?.playerId || !profile?.name) return null;
    return { id: profile.playerId as string, name: profile.name as string };
  } catch {
    return null;
  }
}

export default function Page() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  const [profile, setProfile] = useState<{ id: string; name: string } | null>(
    null,
  );
  const [errorPhase, setErrorPhase] = useState<string | null>(null);

  // Resolve profile on the client; redirect to /identify if missing
  useEffect(() => {
    const p = loadProfile();
    if (!p) {
      router.replace("/identify");
    } else {
      setProfile(p);
    }
  }, [router]);

  const playerId = profile?.id ?? "";
  const playerName = profile?.name ?? "";

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
    onMessage: (message) => {
      console.log("Room received message:", message);

      if (message.type === "joined") {
        // Store the session token for reconnect support
        const joined = message.payload as unknown as JoinedResponsePayload;
        if (joined?.session_token) {
          sessionStorage.setItem(
            `session_token:${roomId}`,
            joined.session_token,
          );
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
      if (error.code === "gameAlreadyStarted") {
        setErrorPhase("gameAlreadyStarted");
      }
    },
  });
  const waitingLobbyState = useWaitingLobbyState(lastMessage, playerId);
  const gameState = useGameState(lastMessage);
  const gamePhase = errorPhase ?? gameState.phase;

  // Send join once connected and profile is loaded
  const joinedRef = useRef(false);
  useEffect(() => {
    if (isConnected && playerId && playerName && !joinedRef.current) {
      // Attempt to reconnect with a stored session token first
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

  // Don't render until the profile check completes (avoids flash with empty playerId)
  if (!profile) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 font-sans dark:bg-black">
      <main className="relative flex h-screen w-full flex-col bg-white dark:bg-black">
        {gamePhase === "gameAlreadyStarted" ? (
          <RunningRoom roomId={roomId} />
        ) : gameState.phase === "waiting" ? (
          <WaitingRoom
            roomId={roomId}
            playerId={playerId}
            waitingLobbyState={waitingLobbyState}
            setReady={setReady}
            sendLeave={sendLeave}
          />
        ) : (
          <GameRoom
            roomId={roomId}
            playerId={playerId}
            gameState={gameState}
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
