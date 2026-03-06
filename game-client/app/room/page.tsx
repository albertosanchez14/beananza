"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useWebSocket, { ReadyState } from "react-use-websocket";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8080";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost/ws";

type SessionState = "waiting" | "playing" | "pause";

interface Room {
  id: string;
  player_count: number;
  max_players: number;
  session_state: SessionState;
}

const SESSION_STATE_BADGE: Record<
  SessionState,
  { label: string; className: string }
> = {
  waiting: {
    label: "Waiting",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  },
  playing: {
    label: "In Progress",
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  },
  pause: {
    label: "Paused",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
};

export default function Page() {
  const router = useRouter();
  const [playerId, setPlayerId] = useState<string>("");
  const [playerName, setPlayerName] = useState<string>("");
  const [profile, setProfile] = useState<{ name: string; playerId: string; color: string } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("playerProfile");
      const p = raw ? JSON.parse(raw) : null;
      const id = p?.playerId ?? Math.random().toString(36).substring(7);
      const name = p?.name ?? `Player_${id}`;
      setProfile(p);
      setPlayerId(id);
      setPlayerName(name);
    } catch {
      const id = Math.random().toString(36).substring(7);
      setPlayerId(id);
      setPlayerName(`Player_${id}`);
    }
  }, []);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const { sendJsonMessage, readyState } = useWebSocket(
    WS_URL,
    {
      share: false,
      shouldReconnect: () => true,
    },
  );

  // Fetch rooms on mount and poll every 5 seconds
  useEffect(() => {
    let cancelled = false;

    const fetchRooms = async () => {
      try {
        const res = await fetch(`${API_BASE}/rooms`);
        if (!res.ok) throw new Error(`Server responded with ${res.status}`);
        const data: Room[] = await res.json();
        if (!cancelled) {
          setRooms(data);
          setFetchError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setFetchError(
            err instanceof Error ? err.message : "Failed to load rooms",
          );
        }
      } finally {
        if (!cancelled) setLoadingRooms(false);
      }
    };

    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const handleJoin = (roomId: string) => {
    if (readyState !== ReadyState.OPEN) {
      alert("Connection not ready. Please wait and try again.");
      return;
    }

    sendJsonMessage({
      type: "join",
      room_id: roomId,
      player_id: playerId,
      payload: {
        player_name: playerName,
      },
      timestamp: new Date().toISOString(),
    });

    router.push(`/room/${roomId}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center py-32 px-16 bg-white dark:bg-black sm:items-start">
        {/* Header */}
        <div className="flex items-center justify-between w-full mb-8">
          <h1 className="text-2xl font-bold">Rooms</h1>
          <div className="flex items-center gap-4">
            {profile && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Playing as <span className="font-semibold text-gray-800 dark:text-gray-200">{profile.name}</span>
              </span>
            )}
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
        </div>

        {/* Room list */}
        <div className="w-full mb-8">
          <h2 className="text-xl font-semibold mb-4">Available Rooms</h2>

          {loadingRooms && (
            <p className="text-sm text-gray-500">Loading rooms...</p>
          )}

          {fetchError && <p className="text-sm text-red-500">{fetchError}</p>}

          {!loadingRooms && !fetchError && rooms.length === 0 && (
            <p className="text-sm text-gray-500">
              No rooms available. Be the first to join one!
            </p>
          )}

          {rooms.length > 0 && (
            <div className="grid gap-4">
              {rooms.map((room) => {
                const badge =
                  SESSION_STATE_BADGE[room.session_state] ??
                  SESSION_STATE_BADGE.waiting;
                const isFull = room.player_count >= room.max_players;
                const isJoinable =
                  room.session_state === "waiting" &&
                  !isFull &&
                  readyState === ReadyState.OPEN;

                return (
                  <div
                    key={room.id}
                    className="flex items-center justify-between p-4 border border-gray-300 rounded-lg dark:border-gray-700"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">Room {room.id}</h3>
                        <span
                          className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}
                        >
                          {badge.label}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        Players: {room.player_count}/{room.max_players}
                      </p>
                    </div>
                    <button
                      onClick={() => handleJoin(room.id)}
                      disabled={!isJoinable}
                      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      Join
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
