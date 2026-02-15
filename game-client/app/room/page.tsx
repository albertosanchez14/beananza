"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import useWebSocket, { ReadyState } from "react-use-websocket";

interface Room {
  id: string;
  name: string;
  players: number;
  maxPlayers: number;
}

// MOCK ROOMS
const INITIAL_ROOMS: Room[] = Array.from({ length: 8 }, (_, i) => ({
  id: (1111 + i).toString(),
  name: `Room ${1111 + i}`,
  players: 0,
  maxPlayers: 4,
}));

export default function Page() {
  const router = useRouter();
  const WS_URL = "ws://localhost:8080/ws";
  const [playerId] = useState(() => Math.random().toString(36).substring(7));
  const [rooms] = useState<Room[]>(INITIAL_ROOMS);
  const { sendJsonMessage, lastJsonMessage, readyState } = useWebSocket(
    WS_URL,
    {
      share: false,
      shouldReconnect: () => true,
    },
  );

  const handleJoin = (roomId: string) => {
    console.log("Send join message for room:", roomId);

    // Ensure WebSocket is connected before sending
    if (readyState !== ReadyState.OPEN) {
      console.error("WebSocket is not connected");
      alert("Connection not ready. Please wait and try again.");
      return;
    }

    // Send join message
    sendJsonMessage({
      type: "join",
      room_id: roomId,
      player_id: playerId,
      payload: {
        player_name: `Player_${playerId}`,
      },
      timestamp: new Date().toISOString(),
    });

    // Navigate to the room page
    router.push(`/room/${roomId}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center py-32 px-16 bg-white dark:bg-black sm:items-start">
        <div className="flex items-center justify-between w-full mb-8">
          <h1 className="text-2xl font-bold">Rooms</h1>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${
                readyState === ReadyState.OPEN
                  ? "bg-green-500"
                  : readyState === ReadyState.CONNECTING
                    ? "bg-yellow-500"
                    : "bg-red-500"
              }`}
            />
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {readyState === ReadyState.OPEN
                ? "Connected"
                : readyState === ReadyState.CONNECTING
                  ? "Connecting..."
                  : "Disconnected"}
            </span>
          </div>
        </div>

        <div className="w-full mb-8">
          <h2 className="text-xl font-semibold mb-4">Available Rooms</h2>
          <div className="grid gap-4">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="flex items-center justify-between p-4 border border-gray-300 rounded-lg dark:border-gray-700"
              >
                <div>
                  <h3 className="font-semibold">{room.name}</h3>
                  <p className="text-sm text-gray-500">
                    Players: {room.players}/{room.maxPlayers}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleJoin(room.id)}
                    disabled={
                      room.players >= room.maxPlayers ||
                      readyState !== ReadyState.OPEN
                    }
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Join
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 w-full">
          <h2 className="text-xl font-semibold mb-4">Server Messages</h2>
          <div className="max-h-64 overflow-y-auto border border-gray-300 rounded p-4">
            {lastJsonMessage ? (
              <div className="mb-2 p-2 rounded shadow bg-gray-100 dark:bg-gray-800">
                {JSON.stringify(lastJsonMessage, null, 2)}
              </div>
            ) : (
              <p className="text-gray-500">No messages received yet</p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
