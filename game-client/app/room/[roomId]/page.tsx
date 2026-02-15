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

  // TODO: global hook?
  const WS_URL = "ws://localhost:8080/ws";
  const { sendJoin, isConnected } = useActions({
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

  // TODO: Get from the server
  const [myHand] = useState<CardType[]>(myDeckData);
  const [myField] = useState<FieldType>(myFieldData);
  const [centerCards] = useState<CardType[]>(centerCardsData);
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
          myHand={myHand}
          myField={myField}
          players={players}
          centerCards={centerCards}
        />
      </main>
    </div>
  );
}
