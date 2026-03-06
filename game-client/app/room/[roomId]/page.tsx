"use client";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useActions, BroadcastPayload } from "@/hooks/useActions";
import { useGameState, useWaitingLobbyState } from "@/hooks/state";
import WaitingRoom from "@/app/room/[roomId]/waiting-room";
import GameRoom from "./game-room";
import RunningRoom from "./running-room";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost/ws";

function loadProfile() {
  try {
    const raw = localStorage.getItem("playerProfile");
    const profile = raw ? JSON.parse(raw) : null;
    const id = profile?.playerId ?? Math.random().toString(36).substring(7);
    const name = profile?.name ?? `Player_${id}`;
    return { id, name };
  } catch {
    const id = Math.random().toString(36).substring(7);
    return { id, name: `Player_${id}` };
  }
}

export default function Page() {
  const params = useParams();
  const roomId = params.roomId as string;
  const { id: playerId, name: playerName } = loadProfile();
  const [errorPhase, setErrorPhase] = useState<string | null>(null);

  const {
    sendJoin,
    sendLeave,
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
      joinedRef.current = true;
      sendJoin(roomId, { player_name: playerName });
    }
  }, [isConnected, playerId, playerName, roomId, sendJoin]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="relative flex min-h-screen w-full max-w-3xl flex-col items-center py-5 px-5 bg-white dark:bg-black">
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
