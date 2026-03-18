import { Coins, Leaf } from "lucide-react";
import { ReactNode } from "react";

// ---------------------------------------------------------------------------
// Deterministic hash from a string (djb2)
// ---------------------------------------------------------------------------
function hash(str: string): number {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  return h >>> 0; // unsigned 32-bit
}

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

// ---------------------------------------------------------------------------
// Palette tables
// ---------------------------------------------------------------------------
const SKIN_TONES = ["#f5c8a0", "#e8b07a", "#c68642", "#f0d5b0"];
const SHIRT_COLORS = [
  "#e63946",
  "#4a90d9",
  "#43aa8b",
  "#9b5de5",
  "#f4a261",
  "#2ec4b6",
  "#e91e8c",
  "#f7b731",
];
const HAIR_COLORS = ["#2c1810", "#1a1a1a", "#7b3f00", "#c8a96e", "#5c3317"];

// ---------------------------------------------------------------------------
// MiiAvatar — inline SVG character
// ---------------------------------------------------------------------------
export function MiiAvatar({
  name,
  isCurrentTurn,
}: {
  name: string;
  isCurrentTurn: boolean;
}) {
  const h0 = hash(name);
  const h1 = hash(name + "1");
  const h2 = hash(name + "2");
  const h3 = hash(name + "3");

  const skin = pick(SKIN_TONES, h0);
  const shirt = pick(SHIRT_COLORS, h1);
  const hairColor = pick(HAIR_COLORS, h2);
  const hairStyle = h3 % 3; // 0 | 1 | 2

  // geometry constants (viewBox 0 0 64 80)
  const cx = 32; // head center x
  const headY = 26; // head center y
  const headR = 16; // head radius

  // Hair paths — clipped to a circle slightly larger than the head
  const hairPaths = [
    // 0: round cap (full top arc)
    `M ${cx - headR} ${headY}
     A ${headR} ${headR} 0 0 1 ${cx + headR} ${headY}
     Q ${cx + headR + 3} ${headY - headR - 4} ${cx} ${headY - headR - 6}
     Q ${cx - headR - 3} ${headY - headR - 4} ${cx - headR} ${headY} Z`,

    // 1: side-swept fringe (covers top + sweeps right)
    `M ${cx - headR} ${headY - 2}
     A ${headR} ${headR} 0 0 1 ${cx + headR} ${headY - 2}
     Q ${cx + headR + 5} ${headY - headR} ${cx + 4} ${headY - headR - 7}
     Q ${cx - 4} ${headY - headR - 9} ${cx - headR - 2} ${headY - 6} Z`,

    // 2: short flat top
    `M ${cx - headR + 2} ${headY - 4}
     A ${headR - 2} ${headR - 2} 0 0 1 ${cx + headR - 2} ${headY - 4}
     L ${cx + headR + 1} ${headY - headR - 1}
     L ${cx - headR - 1} ${headY - headR - 1} Z`,
  ];

  const glowId = `glow-${name.replace(/\W/g, "")}`;

  return (
    <svg
      viewBox="0 0 64 80"
      width={64}
      height={80}
      xmlns="http://www.w3.org/2000/svg"
      style={{
        filter: isCurrentTurn
          ? "drop-shadow(0 0 7px #facc15) drop-shadow(0 0 3px #facc15)"
          : undefined,
        transition: "filter 0.3s ease",
      }}
    >
      <defs>
        <clipPath id={`headClip-${glowId}`}>
          <circle cx={cx} cy={headY} r={headR + 1} />
        </clipPath>
      </defs>

      {/* Turn ring behind avatar */}
      {isCurrentTurn && (
        <circle
          cx={cx}
          cy={headY}
          r={headR + 5}
          fill="none"
          stroke="#facc15"
          strokeWidth={2}
          opacity={0.85}
        />
      )}

      {/* Body / torso */}
      <rect
        x={cx - 12}
        y={headY + headR + 2}
        width={24}
        height={22}
        rx={6}
        fill={shirt}
      />

      {/* Neck */}
      <rect
        x={cx - 5}
        y={headY + headR - 1}
        width={10}
        height={8}
        fill={skin}
      />

      {/* Head */}
      <circle cx={cx} cy={headY} r={headR} fill={skin} />

      {/* Ear left */}
      <circle cx={cx - headR + 1} cy={headY + 2} r={3.5} fill={skin} />
      {/* Ear right */}
      <circle cx={cx + headR - 1} cy={headY + 2} r={3.5} fill={skin} />

      {/* Hair (clipped to head outline) */}
      <g clipPath={`url(#headClip-${glowId})`}>
        <path d={hairPaths[hairStyle]} fill={hairColor} />
      </g>

      {/* Eyes */}
      <ellipse cx={cx - 5.5} cy={headY + 2} rx={2.5} ry={3} fill="#1a1a2e" />
      <ellipse cx={cx + 5.5} cy={headY + 2} rx={2.5} ry={3} fill="#1a1a2e" />

      {/* Eye shine */}
      <circle cx={cx - 4.5} cy={headY + 1} r={0.9} fill="white" />
      <circle cx={cx + 6.5} cy={headY + 1} r={0.9} fill="white" />

      {/* Smile */}
      <path
        d={`M ${cx - 4} ${headY + 8} Q ${cx} ${headY + 12} ${cx + 4} ${headY + 8}`}
        fill="none"
        stroke="#1a1a2e"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Player component
// ---------------------------------------------------------------------------

type WaitingPlayerProps = {
  playerId: string;
  playerName: string;
  playerStatus: "waiting";
  playerReady: boolean;
  isMe?: boolean;
  field?: ReactNode;
};

type ActivePlayerProps = {
  playerId: string;
  playerName: string;
  playerStatus: "active";
  playerCoins?: number;
  playerPickedCardsCount?: number;
  isCurrentTurn?: boolean;
  gamePhase?: string;
  field?: ReactNode;
  hand?: ReactNode;
  isDragTarget?: boolean;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
};

type PlayerProps = WaitingPlayerProps | ActivePlayerProps;

export default function Player(props: PlayerProps) {
  if (props.playerStatus === "waiting") {
    return <WaitingPlayer {...props} />;
  }

  return <ActivePlayer {...props} />;
}

function WaitingPlayer({
  playerName,
  playerReady = false,
  isMe = false,
  field,
}: WaitingPlayerProps) {
  return (
    <div className="flex flex-col items-center gap-0.5 transition-all duration-200">
      <div className="relative">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: playerReady ? "2.5px solid #4ade80" : "2.5px solid #9ca3af",
            boxShadow: playerReady ? "0 0 0 0 rgba(74,222,128,0.4)" : undefined,
            animation: !playerReady
              ? "pulse-ring 2s ease-in-out infinite"
              : undefined,
            margin: -4,
            width: "calc(100% + 8px)",
            height: "calc(100% + 8px)",
          }}
        />
        <MiiAvatar name={playerName} isCurrentTurn={false} />
      </div>

      <p
        className="text-[10px] font-bold text-white leading-tight max-w-[72px] text-center truncate"
        style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}
      >
        {playerName}
        {isMe && (
          <span className="ml-0.5 text-blue-300 font-normal">(you)</span>
        )}
      </p>

      <span
        className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full leading-none ${
          playerReady
            ? "bg-green-500/80 text-white"
            : "bg-gray-700/80 text-gray-300"
        }`}
      >
        {playerReady ? "Ready" : "Waiting"}
      </span>

      {field && (
        <div
          className="scale-75 origin-top"
          style={{ marginTop: 12, perspective: "700px" }}
        >
          <div
            style={{
              transform: "rotateX(25deg) scaleX(1.08)",
              transformOrigin: "bottom center",
            }}
          >
            {field}
          </div>
        </div>
      )}
    </div>
  );
}

function ActivePlayer({
  playerName,
  playerStatus,
  playerCoins,
  playerPickedCardsCount,
  isCurrentTurn = false,
  gamePhase,
  field,
  hand,
  isDragTarget = false,
  onDragOver,
  onDragLeave,
  onDrop,
}: ActivePlayerProps) {
  const showPickedCards =
    gamePhase === "plantTrade" && (playerPickedCardsCount ?? 0) > 0;

  return (
    <div
      className="flex flex-col items-center gap-1 transition-all duration-200"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div
        className="relative flex flex-col items-center"
        style={{ width: 64 }}
      >
        <div className="flex flex-col items-center gap-0.5 mb-1">
          <p
            className="text-xs font-bold text-white leading-tight"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}
          >
            {playerName}
          </p>

          <div className="flex items-center gap-2">
            {playerCoins !== undefined && (
              <div className="flex items-center gap-1 text-[10px] text-gray-200">
                <Coins
                  size={9}
                  strokeWidth={2}
                  className="text-yellow-300 shrink-0"
                />
                <span
                  className="font-medium tabular-nums"
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
                >
                  {playerCoins}
                </span>
              </div>
            )}

            {showPickedCards && (
              <div className="flex items-center gap-1 text-[10px] text-emerald-300 font-semibold">
                <Leaf size={9} strokeWidth={2} className="shrink-0" />
                <span
                  className="tabular-nums"
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
                >
                  {playerPickedCardsCount}
                </span>
              </div>
            )}
          </div>

          {playerStatus !== "active" && (
            <span className="text-[8px] px-1 py-px rounded-full text-gray-400 border border-gray-600/60 tracking-wide uppercase">
              {playerStatus}
            </span>
          )}
        </div>

        <div style={isDragTarget ? { filter: "drop-shadow(0 0 8px #4ade80) drop-shadow(0 0 3px #4ade80)", transition: "filter 0.15s" } : undefined}>
          <MiiAvatar name={playerName} isCurrentTurn={isCurrentTurn} />
        </div>

        {hand && (
          <div
            className="absolute left-1/2"
            style={{ bottom: -6, transform: "translateX(-50%)", zIndex: 10 }}
          >
            {hand}
          </div>
        )}
      </div>

      {field && (
        <div
          className="scale-75 origin-top"
          style={{ marginTop: 18, perspective: "700px" }}
        >
          <div
            style={{
              transform: "rotateX(25deg) scaleX(1.08)",
              transformOrigin: "bottom center",
            }}
          >
            {field}
          </div>
        </div>
      )}
    </div>
  );
}
