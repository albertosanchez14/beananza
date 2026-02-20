"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useActions } from "@/hooks/useActions";

import { CardType, ExternalPlayer, FieldType } from "@/schemas/types";
import Board from "@/components/board";
import { playersData } from "@/data/sample";

export default function Page() {
  const params = useParams();
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
    isConnected,
    plantBean,
    tradeBean,
    harvestField,
    turnOverBean,
    myState,
    nextPhase,
  } = useActions({
    wsUrl: WS_URL,
    playerId,
    onMessage: (message) => {
      // TODO: Update players state based on broadcast messages
      console.log("Room received message:", message);
      if (message.type === "myState") {
        const payload = message.payload as {
          player: { hand: CardType[]; field: FieldType };
          center_cards: CardType[];
          turn_order: string[];
          current_turn: number;
          phase: string;
        };
        setMyHand(payload.player.hand);
        setMyField({
          ...payload.player.field,
          slots: payload.player.field.slots || [],
        });
        setCenterCards(payload.center_cards);
        const playerTurnId = payload.turn_order[payload.current_turn];
        setPlayerTurn(playerTurnId);
        setPhase(payload.phase);
      }
    },
    onError: (error) => {
      console.error("Room WebSocket error:", error);
    },
  });

  // TODO: Get from the server
  const [myHand, setMyHand] = useState<CardType[]>([]);
  const [myField, setMyField] = useState<FieldType>({ fieldId: "", slots: [] });
  const [centerCards, setCenterCards] = useState<CardType[]>([]);
  const [players, setPlayers] = useState<ExternalPlayer[]>(playersData);
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
  const handlePlantBean = (
    cardId: string,
    fieldId: string,
    slotIndex: number,
  ) => {
    console.log(
      `Planting bean: cardId=${cardId}, fieldId=${fieldId}, slotIndex=${slotIndex}`,
    );
    plantBean(roomId, playerId, cardId, `${fieldId}-slot-${slotIndex}`);
  };

  const handleTradeBean = (cardId: string, toPlayerId: string) => {
    console.log(`Trading bean: cardId=${cardId}, toPlayerId=${toPlayerId}`);
    tradeBean(roomId, playerId, toPlayerId, cardId);
  };

  const handleHarvestField = (fieldId: string, slotIndex: number) => {
    console.log(`Harvesting field: fieldId=${fieldId}, slotIndex=${slotIndex}`);
    harvestField(roomId, playerId, `${fieldId}-slot-${slotIndex}`);
  };

  const handleTurnOverBean = () => {
    console.log("Turning over bean from center deck");
    turnOverBean(roomId);
  };

  const handleGetStatus = () => {
    myState(roomId);
  };

  const handleNextPhase = () => {
    nextPhase(roomId);
  };

  // Wait for playerId to be generated to avoid hydration mismatch
  if (!playerId) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="relative flex min-h-screen w-full max-w-3xl flex-col items-center py-5 px-5 bg-white dark:bg-black">
        <h1 className="text-2xl font-bold mb-8">Room {roomId}</h1>
        <span>Player: {playerId}</span>
        <span>Player Turn: {playerTurn}</span>
        <span>Game Phase: {gamePhase}</span>
        <Board
          myHand={myHand}
          myField={myField}
          players={players}
          centerCards={centerCards}
          onPlantBean={handlePlantBean}
          onTradeBean={handleTradeBean}
          onHarvestField={handleHarvestField}
          onTurnOverBean={handleTurnOverBean}
        />
        <div className="flex gap-4 pt-2">
          <button onClick={handleGetStatus}>Get Status</button>
          <button onClick={handleNextPhase}>Next Phase</button>
        </div>
      </main>
    </div>
  );
}
