import { WaitingPlayer } from "@/schemas/types";

type WaitingRoomProps = {
  roomId: string;
  currentPlayerId: string;
  players: Record<string, WaitingPlayer>;
  minPlayers: number;
  maxPlayers: number;
  canStart: boolean;
  myReadyState: boolean;
  onSetReady: (ready: boolean) => void;
  onLeaveRoom: () => void;
};

export default function WaitingRoom({
  roomId,
  currentPlayerId,
  players,
  minPlayers,
  maxPlayers,
  canStart,
  myReadyState,
  onSetReady,
  onLeaveRoom,
}: WaitingRoomProps) {
  const playerList = Object.values(players);
  const playerCount = playerList.length;
  const readyCount = playerList.filter((p) => p.ready).length;
  const needMorePlayers = playerCount < minPlayers;

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Header Section */}
      <div className="bg-linear-to-r from-blue-500 to-purple-600 rounded-lg p-6 mb-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold">Waiting Room</h2>
            <p className="text-sm opacity-90">Room ID: {roomId}</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">
              {playerCount}/{maxPlayers}
            </div>
            <div className="text-xs opacity-90">Players</div>
          </div>
        </div>

        {/* Game Start Status */}
        <div className="bg-white/20 rounded-lg p-3 backdrop-blur-sm">
          {canStart ? (
            <div className="flex items-center gap-2 text-green-300">
              <span className="text-xl">✓</span>
              <span className="font-semibold">
                Game will start automatically!
              </span>
            </div>
          ) : needMorePlayers ? (
            <div className="flex items-center gap-2">
              <span className="text-xl">⏳</span>
              <span>
                Waiting for {minPlayers - playerCount} more player
                {minPlayers - playerCount !== 1 ? "s" : ""}... (minimum{" "}
                {minPlayers})
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xl">⏳</span>
              <span>
                Waiting for players to ready up ({readyCount}/{playerCount}{" "}
                ready)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Player List */}
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
          Players
        </h3>
        <div className="space-y-3">
          {playerList.map((player) => {
            const isMe = player.id === currentPlayerId;
            return (
              <div
                key={player.id}
                className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                  isMe
                    ? "bg-blue-50 dark:bg-blue-900/20 border-blue-400"
                    : "bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                      player.ready
                        ? "bg-green-500"
                        : "bg-gray-400 dark:bg-gray-600"
                    }`}
                  >
                    {player.ready ? "✓" : "○"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800 dark:text-gray-100">
                        {player.name}
                      </span>
                      {isMe && (
                        <span className="text-xs px-2 py-1 bg-blue-500 text-white rounded-full">
                          You
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {player.ready ? "Ready" : "Waiting"}
                    </div>
                  </div>
                </div>
                <div>
                  {player.ready ? (
                    <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm font-semibold">
                      Ready
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-sm">
                      Not Ready
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button
          onClick={() => onSetReady(!myReadyState)}
          disabled={needMorePlayers}
          className={`flex-1 py-4 px-6 rounded-lg font-bold text-lg transition-all ${
            myReadyState
              ? "bg-yellow-500 hover:bg-yellow-600 text-white"
              : "bg-green-500 hover:bg-green-600 text-white"
          } disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:bg-gray-400`}
        >
          {myReadyState ? "Not Ready" : "Ready Up"}
        </button>
        <button
          onClick={onLeaveRoom}
          className="px-6 py-4 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition-all"
        >
          Leave Room
        </button>
      </div>
    </div>
  );
}
