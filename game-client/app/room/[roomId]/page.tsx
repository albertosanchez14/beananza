"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useActions, BroadcastPayload } from "@/hooks/useActions";

import { CardType, ExternalPlayer, FieldType, Player, WaitingPlayer } from "@/schemas/types";
import Board from "@/components/board";
import WaitingRoom from "@/components/waiting-room";

export default function Page() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;
  // TODO: create a custom hook to track the playerid
  const [playerId, setPlayerId] = useState("");

  useEffect(() => {
    // Generate playerId only on client side to avoid hydration mismatch
    if (!playerId) {
      setPlayerId(Math.random().toString(36).substring(7));
    }
  }, [playerId]);

  // TODO: global hook?
  const WS_URL = "ws://localhost:8080/ws";
  const {
    sendJoin,
    sendLeave,
    isConnected,
    plantBean,
    tradeBean,
    harvestField,
    turnOverBean,
    drawCards,
    setReady,
    myState,
    nextPhase,
  } = useActions({
    wsUrl: WS_URL,
    playerId,
    onMessage: (message) => {
      console.log("Room received message:", message);

      // Handle broadcast events
      if (message.type === "broadcast") {
        const broadcastPayload = message.payload as unknown as BroadcastPayload;

        switch (broadcastPayload.event) {
          case "player_joined": {
            console.log("Player joined:", broadcastPayload.data);
            myState(roomId);
            break;
          }
          case "player_left": {
            console.log("Player left:", broadcastPayload.data);
            myState(roomId);
            break;
          }
          case "player_ready": {
            console.log("Player ready changed:", broadcastPayload.data);
            myState(roomId);
            break;
          }
          case "game_started": {
            console.log("Game started!");
            // Server sends myState automatically, but request it
            // as a fallback to ensure we transition to game phase
            myState(roomId);
            break;
          }
        }
      }

      // Handle state updates
      if (message.type === "myState" || message.type === "state") {
        const payload = message.payload as any;
        setPhase(payload.phase);

        // Game mode
        if (payload.player) {
          setMyHand(payload.player.hand || []);
          setMyField({
            ...payload.player.field,
            slots: payload.player.field?.slots || [],
          });
        }
        setCenterCards(payload.center_cards || []);
        setPlayers(payload.external_players || []);

        if (payload.turn_order && payload.turn_order.length > 0) {
          const playerTurnId = payload.turn_order[payload.current_turn || 0];
          setPlayerTurn(playerTurnId);
        }
      } else if (message.type === "waitingLobbyState") {
        setPhase("waiting");
        const payload = message.payload as any;
        const waitingPlayers: Record<string, WaitingPlayer> =
          payload.players || {};
        setAllPlayers(waitingPlayers);
        setMinPlayers(payload.min_players || 3);
        setMaxPlayers(payload.max_players || 5);
        setCanStart(payload.can_start || false);

        const me = waitingPlayers[playerId];
        setMyReadyState(me?.ready || false);
      }
    },
    onError: (error) => {
      console.error("Room WebSocket error:", error);
    },
  });

  // Waiting room state
  const [allPlayers, setAllPlayers] = useState<Record<string, WaitingPlayer>>({});
  const [minPlayers, setMinPlayers] = useState(3);
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [canStart, setCanStart] = useState(false);
  const [myReadyState, setMyReadyState] = useState(false);

  // Game state
  const [myHand, setMyHand] = useState<CardType[]>([]);
  const [myField, setMyField] = useState<FieldType>({ fieldId: "", slots: [] });
  const [centerCards, setCenterCards] = useState<CardType[]>([]);
  const [players, setPlayers] = useState<ExternalPlayer[]>([]);
  const [playerTurn, setPlayerTurn] = useState<string>("");
  const [gamePhase, setPhase] = useState<string>("");

  useEffect(() => {
    if (isConnected && playerId) {
      sendJoin(roomId, {
        player_name: `Player_${playerId}`,
      });
    }
  }, [isConnected, roomId, playerId, sendJoin]);

  // Action handler functions
  const handlePlantBean = (cardId: string, slotId: string) => {
    plantBean(roomId, playerId, cardId, slotId);
  };

  const handleTradeBean = (cardId: string, toPlayerId: string) => {
    tradeBean(roomId, playerId, toPlayerId, cardId);
  };

  const handleHarvestField = (slotId: string) => {
    harvestField(roomId, playerId, slotId);
  };

  const handleTurnOverBean = () => {
    turnOverBean(roomId);
  };

  const handleDrawCards = () => {
    drawCards(roomId);
  };

  const handleGetStatus = () => {
    myState(roomId);
  };

  const handleNextPhase = () => {
    nextPhase(roomId);
  };

  const handleSetReady = (ready: boolean) => {
    setReady(roomId, ready);
  };

  const handleLeaveRoom = () => {
    sendLeave(roomId);
    router.push("/");
  };

  // Wait for playerId to be generated to avoid hydration mismatch
  if (!playerId) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="relative flex min-h-screen w-full max-w-3xl flex-col items-center py-5 px-5 bg-white dark:bg-black">
        <h1 className="text-2xl font-bold mb-8">Room {roomId}</h1>

        {gamePhase === "waiting" ? (
          <WaitingRoom
            roomId={roomId}
            players={allPlayers}
            currentPlayerId={playerId}
            minPlayers={minPlayers}
            maxPlayers={maxPlayers}
            canStart={canStart}
            myReadyState={myReadyState}
            onSetReady={handleSetReady}
            onLeaveRoom={handleLeaveRoom}
          />
        ) : (
          <>
            <span>Player: {playerId}</span>
            <span>Player Turn: {playerTurn}</span>
            <span>Game Phase: {gamePhase}</span>
            <Board
              myHand={myHand}
              myField={myField}
              players={players}
              centerCards={centerCards}
              currentTurnPlayerId={playerTurn}
              gamePhase={gamePhase}
              onPlantBean={handlePlantBean}
              onTradeBean={handleTradeBean}
              onHarvestField={handleHarvestField}
              onTurnOverBean={handleTurnOverBean}
              onDrawCards={handleDrawCards}
            />
          </>
        )}

        <div className="flex gap-4 pt-2">
          <button onClick={handleGetStatus}>Get Status</button>
          <button onClick={handleNextPhase}>Next Phase</button>
        </div>
      </main>
    </div>
  );
}
