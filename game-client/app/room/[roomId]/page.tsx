"use client";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useActions } from "@/hooks/useActions";

import { CardType, ExternalPlayer, FieldType } from "@/schemas/types";
import Board from "@/components/board";
import {
  centerCardsData,
  myDeckData,
  myFieldData,
  playersData,
} from "@/data/sample";

export default function Page() {
  const params = useParams();
  const roomId = params.roomId as string;
  // TODO: create a custom hook to track the playerid
  const [playerId] = useState(() => Math.random().toString(36).substring(7));

  // TODO: custom hook for the connection and actions
  const WS_URL = "ws://localhost:8080/ws";
  const { sendJoin, isConnected, lastMessage } = useActions({
    wsUrl: WS_URL,
    playerId,
    onMessage: (message) => {
      console.log("Room received message:", message);
      // TODO: Update players state based on broadcast messages
    },
    onError: (error) => {
      console.error("Room WebSocket error:", error);
    },
  });

  // TODO: Get the player cards from the server
  const [myDeck] = useState<CardType[]>(myDeckData);
  const [myField] = useState<FieldType>(myFieldData);

  // TODO: Get the player cards from the server
  const [centerCards] = useState<CardType[]>(centerCardsData);

  // TODO: get the players state from the server: min 2 and max 4
  const [players] = useState<ExternalPlayer[]>(playersData);

  useEffect(() => {
    if (isConnected) {
      sendJoin(roomId, {
        player_name: `Player_${playerId}`,
      });
    }
  }, [isConnected, roomId, playerId, sendJoin]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="relative flex min-h-screen w-full max-w-3xl flex-col items-center py-5 px-5 bg-white dark:bg-black">
        <h1 className="text-2xl font-bold mb-8">Room {roomId}</h1>
        <Board
          myDeck={myDeck}
          myField={myField}
          players={players}
          centerCards={centerCards}
        />
      </main>
    </div>
  );
}
