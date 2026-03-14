"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiBaseUrl } from "@/lib/config";

type RoomSessionState = "waiting" | "playing" | "pause";

interface Room {
  id: string;
  player_count: number;
  max_players: number;
  session_state: RoomSessionState;
}

const SESSION_STATE_BADGE: Record<
  RoomSessionState,
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

type Tab = "waiting" | "playing";

export default function Page() {
  const router = useRouter();
  const [profile, setProfile] = useState<{
    name: string;
    playerId: string;
    color: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("waiting");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("playerProfile");
      const p = raw ? JSON.parse(raw) : null;
      if (!p?.playerId || !p?.name) {
        router.replace("/identify");
        return;
      }
      setProfile(p);
    } catch {
      router.replace("/identify");
    }
  }, [router]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Fetch rooms on mount and poll every 5 seconds
  useEffect(() => {
    let cancelled = false;

    const fetchRooms = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/rooms`);
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

  const generateRoomId = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    return Array.from({ length: 6 }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length)),
    ).join("");
  };

  const handleCreate = () => {
    const roomId = generateRoomId();
    router.push(`/room/${roomId}`);
  };

  const handleJoin = (roomId: string) => {
    router.push(`/room/${roomId}`);
  };

  const waitingRooms = rooms.filter((r) => r.session_state === "waiting");
  const playingRooms = rooms.filter(
    (r) => r.session_state === "playing" || r.session_state === "pause",
  );

  const renderRoomCard = (room: Room) => {
    const badge =
      SESSION_STATE_BADGE[room.session_state] ?? SESSION_STATE_BADGE.waiting;
    const isFull = room.player_count >= room.max_players;
    const isJoinable = room.session_state === "waiting" && !isFull;

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
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <main
        className="flex min-h-screen w-full max-w-3xl flex-col 
			items-center py-32 px-16 bg-white dark:bg-black sm:items-start"
      >
        {/* Header */}
        <div className="flex items-center justify-between w-full mb-8">
          <h1 className="text-2xl font-bold">Rooms</h1>
          <div className="flex items-center gap-4">
            {profile && (
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Playing as{" "}
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {profile.name}
                </span>
              </span>
            )}
            <button
              onClick={handleCreate}
              className="px-4 py-2 bg-blue-500 text-white text-sm font-medium 
							rounded hover:bg-blue-600"
            >
              New Room
            </button>
          </div>
        </div>

        {loadingRooms && (
          <p className="text-sm text-gray-500">Loading rooms...</p>
        )}

        {fetchError && <p className="text-sm text-red-500">{fetchError}</p>}

        {!loadingRooms && !fetchError && (
          <div className="w-full">
            {/* Tabs */}
            <div className="flex border-b border-gray-200 dark:border-gray-800 mb-6">
              <button
                onClick={() => setActiveTab("waiting")}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === "waiting"
                    ? "border-gray-900 text-gray-900 dark:border-white dark:text-white"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                Waiting
                {waitingRooms.length > 0 && (
                  <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded-full">
                    {waitingRooms.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("playing")}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === "playing"
                    ? "border-gray-900 text-gray-900 dark:border-white dark:text-white"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                In Progress
                {playingRooms.length > 0 && (
                  <span className="ml-2 text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded-full">
                    {playingRooms.length}
                  </span>
                )}
              </button>
            </div>

            {/* Tab content */}
            {activeTab === "waiting" &&
              (waitingRooms.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No rooms currently waiting.
                </p>
              ) : (
                <div className="grid gap-4">
                  {waitingRooms.map(renderRoomCard)}
                </div>
              ))}

            {activeTab === "playing" &&
              (playingRooms.length === 0 ? (
                <p className="text-sm text-gray-500">
                  No games currently in progress.
                </p>
              ) : (
                <div className="grid gap-4">
                  {playingRooms.map(renderRoomCard)}
                </div>
              ))}
          </div>
        )}
      </main>
    </div>
  );
}
