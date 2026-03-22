import { WaitingRoomContext } from "@/hooks/useWaitingRoom";
import Player from "@/components/player";
import Table from "@/components/table";
import { useRouter } from "next/navigation";
import Center from "@/components/center";
import { CardPile } from "@/components/card-pile";
import Opponents from "@/components/opponents";
import Field from "@/components/field";
import NewSlot from "@/components/slot";

type WaitingRoomProps = { roomId: string; playerId: string; myAvatar?: string } & WaitingRoomContext;

function GhostSeat({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 opacity-30">
      <div
        className="rounded-full border-2 border-dashed border-gray-400 flex items-center justify-center"
        style={{ width: 56, height: 56 }}
      >
        <span className="text-gray-400 text-xs font-medium">{label}</span>
      </div>
      <span
        className="text-[10px] text-gray-400 font-medium"
        style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
      >
        Empty
      </span>
    </div>
  );
}

export default function WaitingRoom({
  roomId,
  playerId,
  myAvatar,
  waitingLobbyState,
  setReady,
  leave,
}: WaitingRoomProps) {
  const router = useRouter();

  const playerList = Object.values(waitingLobbyState.allPlayers);
  const playerCount = playerList.length;
  const readyCount = playerList.filter((p) => p.ready).length;
  const needMorePlayers = playerCount < waitingLobbyState.minPlayers;

  const me = waitingLobbyState.allPlayers[playerId];
  const opponents = playerList.filter((p) => p.id !== playerId);

  const emptyOpponentSlots = Math.max(
    0,
    waitingLobbyState.maxPlayers - 1 - opponents.length,
  );

  const handleSetReady = (ready: boolean) => setReady(ready);
  const handleLeaveRoom = () => {
    leave();
    router.push("/room");
  };

  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{ background: "#1a1008" }}
    >
      <Table>
        <Opponents>
          {opponents.map((player) => (
            <Player
              key={player.id}
              playerId={player.id}
              playerName={player.name}
              playerAvatar={player.avatar}
              playerReady={player.ready}
              playerStatus={"waiting"}
              field={
                <Field>
                  {Array.from({ length: 2 }).map((_, index) => {
                    return (
                      <NewSlot key={index} index={index} interactive={false} />
                    );
                  })}
                </Field>
              }
            />
          ))}
          {Array.from({ length: emptyOpponentSlots }).map((_, i) => (
            <GhostSeat
              key={`ghost-${i}`}
              label={`${opponents.length + i + 2}`}
            />
          ))}
        </Opponents>

        <Center>
          <CardPile label="Draw" count={0} topCard={null} />
          <div
            className="flex flex-col self-center items-center gap-2 px-5 py-3 rounded-xl"
            style={{
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(6px)",
              border: "1px solid rgba(255,255,255,0.08)",
              minWidth: 140,
            }}
          >
            <span
              className="font-mono text-xs tracking-widest text-gray-300 uppercase"
              style={{ letterSpacing: "0.18em" }}
            >
              {roomId}
            </span>

            <div className="w-full h-px bg-white/10" />

            {waitingLobbyState.canStart ? (
              <span
                className="flex items-center gap-1.5 text-green-400 
							font-semibold text-xs"
              >
                <span
                  className="w-1.5 h-1.5 rounded-full bg-green-400 
								animate-pulse inline-block"
                />
                Game starting…
              </span>
            ) : needMorePlayers ? (
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-white font-bold text-lg tabular-nums leading-none">
                  {playerCount}
                  <span className="text-gray-400 font-normal text-sm">
                    /{waitingLobbyState.maxPlayers}
                  </span>
                </span>
                <span className="text-gray-400 text-[10px] text-center leading-tight">
                  need {waitingLobbyState.minPlayers - playerCount} more
                </span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                <span className="text-white font-bold text-lg tabular-nums leading-none">
                  {readyCount}
                  <span className="text-gray-400 font-normal text-sm">
                    /{playerCount}
                  </span>
                </span>
                <span className="text-gray-400 text-[10px]">ready</span>
              </div>
            )}
          </div>
          <CardPile label="Discard" count={0} topCard={null} />
        </Center>

        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "94%",
            transform: "translate(-50%, -50%)",
            zIndex: 15,
          }}
        >
          {me ? (
            <Player
              playerId={me.id}
              playerName={me.name}
              playerAvatar={myAvatar ?? me.avatar}
              playerReady={me.ready}
              playerStatus={"waiting"}
              field={<></>}
            />
          ) : (
            <GhostSeat label="?" />
          )}
        </div>
      </Table>

      <div className="absolute bottom-0 left-0 right-0 z-30">
        <div className="flex flex-col items-center gap-3 px-6 pb-4 pt-6">
          {/* Action buttons */}
          <div className="flex gap-3 w-full max-w-sm">
            <button
              onClick={() => handleSetReady(!waitingLobbyState.myReadyState)}
              disabled={needMorePlayers}
              className={`flex-1 py-3 px-5 rounded-xl font-bold text-sm transition-all shadow-lg ${
                waitingLobbyState.myReadyState
                  ? "bg-yellow-500 hover:bg-yellow-400 text-black"
                  : "bg-green-500 hover:bg-green-400 text-white"
              } disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {waitingLobbyState.myReadyState ? "Not Ready" : "Ready Up"}
            </button>
            <button
              onClick={handleLeaveRoom}
              className="px-5 py-3 bg-white/10 hover:bg-white/20 text-white
							rounded-xl font-semibold text-sm transition-all disabled:opacity-40 
							disabled:cursor-not-allowed"
            >
              Leave
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
