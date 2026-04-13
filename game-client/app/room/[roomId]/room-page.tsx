"use client";
import { useParams } from "next/navigation";
import { usePlayerProfile } from "@/hooks/usePlayerProfile";
import { useRoomConnection } from "@/hooks/useRoomConnection";

import WaitingRoom from "./waiting-room";
import GameRoom from "./game-room";
import RunningRoom from "./running-room";

export default function RoomPage() {
  const roomId = useParams().roomId as string;
  const { profile, redirectToIdentify } = usePlayerProfile(roomId);

  const { viewState, game, waiting, gameError, clearGameError, isConnected } =
    useRoomConnection(
      roomId,
      profile?.id ?? "",
      profile?.name ?? "",
      profile?.authToken ?? "",
      profile?.avatar ?? "",
      redirectToIdentify,
    );

  if (!profile)
    return (
      <div
        className="relative min-h-screen overflow-hidden"
        style={{
          backgroundImage: "url('/fields/field6.jpeg')",
          backgroundSize: "cover",
          backgroundPosition: "bottom",
        }}
      >
        <div className="absolute inset-0 bg-black/50" />
      </div>
    );

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
            playerId={profile.id}
            myAvatar={profile.avatar}
            isConnected={isConnected}
            {...waiting}
          />
        )}

        {showGame && (
          <GameRoom
            roomId={roomId}
            playerId={profile.id}
            {...game}
            gameError={gameError}
            clearGameError={clearGameError}
            isConnected={isConnected}
          />
        )}
      </main>
    </div>
  );
}
