import { CardType, ExternalPlayer } from "@/schemas/types";
import NewField from "@/components/new-field";
import NewSlot from "@/components/new-slot";
import Card from "@/components/card";
import { Coins, Leaf } from "lucide-react";

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
// Fan helpers (adapted from player-hand.tsx)
// ---------------------------------------------------------------------------
function getFanStyle(index: number, total: number): React.CSSProperties {
  if (total === 0) return {};
  const center = (total - 1) / 2;
  const offset = index - center;
  const rotateDeg = offset * 5;
  const arcDrop = Math.abs(offset) ** 1.5 * 3;

  return {
    transform: `rotate(${rotateDeg}deg) translateY(${arcDrop}px)`,
    transformOrigin: "bottom center",
    zIndex: total - index,
    marginLeft: index === 0 ? 0 : -52,
    position: "relative",
  };
}

// A fan of N face-down cards rendered at reduced scale.
function OpponentCardFan({ count, backImage }: { count: number; backImage: string }) {
  const capped = Math.min(count, 12);
  if (capped === 0) return null;

  return (
    <div
      className="flex items-end justify-center"
      style={{
        // The cards are w-24 (96px) scaled to 0.42 ≈ 40px wide, so reserve
        // enough width for the widest spread (12 cards with -14px overlap each).
        minWidth: 60,
        // Scale the whole fan down; keep it anchored at the bottom so it
        // visually sits "in hand" in front of the avatar torso.
        transform: "scale(0.28)",
        transformOrigin: "bottom center",
        // Compensate for the space the unscaled cards would occupy above
        // (h-36 = 144px at full scale → 144*0.42 ≈ 60px visual height).
        // We pull the container up with a negative margin so the fan overlaps
        // the bottom of the avatar SVG naturally.
        marginTop: -8,
      }}
    >
      {Array.from({ length: capped }).map((_, index) => (
        <Card
          key={index}
          card={{ backImage }}
          flipped={true}
          style={getFanStyle(index, capped)}
        />
      ))}
    </div>
  );
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
function MiiAvatar({
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
type PlayerProps = {
  player: ExternalPlayer;
  isCurrentTurn?: boolean;
  gamePhase?: string;
  cardLookup?: Map<string, CardType>;
};

export default function Player({
  player,
  isCurrentTurn = false,
  gamePhase,
  cardLookup,
}: PlayerProps) {
  const showPickedCards =
    gamePhase === "plantTrade" && (player.playerPickedCardsCount ?? 0) > 0;

  return (
    <div className="flex flex-col items-center gap-1 transition-all duration-200">
      {/* Avatar block — name/stats on top, avatar in middle, fan in front */}
      <div
        className="relative flex flex-col items-center"
        style={{ width: 64 }}
      >
        {/* Name + stats above the avatar */}
        <div className="flex flex-col items-center gap-0.5 mb-1">
          <p
            className="text-xs font-bold text-white leading-tight"
            style={{ textShadow: "0 1px 4px rgba(0,0,0,0.9)" }}
          >
            {player.playerName}
          </p>
          <div className="flex items-center gap-2">
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
                {player.playerCoins}
              </span>
            </div>
            {showPickedCards && (
              <div className="flex items-center gap-1 text-[10px] text-emerald-300 font-semibold">
                <Leaf size={9} strokeWidth={2} className="shrink-0" />
                <span
                  className="tabular-nums"
                  style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
                >
                  {player.playerPickedCardsCount}
                </span>
              </div>
            )}
          </div>
          {player.playerStatus !== "active" && (
            <span className="text-[8px] px-1 py-px rounded-full text-gray-400 border border-gray-600/60 tracking-wide uppercase">
              {player.playerStatus}
            </span>
          )}
        </div>

        {/* Mii avatar */}
        <MiiAvatar name={player.playerName} isCurrentTurn={isCurrentTurn} />

        {/* Card fan — in front of the avatar torso */}
        <div
          className="absolute left-1/2"
          style={{ bottom: -6, transform: "translateX(-50%)", zIndex: 10 }}
        >
          <OpponentCardFan count={player.playerHandSize} backImage={[...cardLookup?.values() ?? []][0]?.backImage ?? ""} />
        </div>
      </div>

      {/* Compact field below — margin to clear the fan overhang */}
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
          <NewField>
            {player.playerField.slots.map((slot, index) => {
              const cardForSlot = cardLookup?.get(slot.cardName) ?? null;
              return (
                <NewSlot
                  key={slot.slotId}
                  slot={slot}
                  index={index}
                  interactive={false}
                  rotated={true}
                >
                  {cardForSlot && (
                    <Card
                      card={cardForSlot}
                      flipped={false}
                      noTransition={true}
                    />
                  )}
                </NewSlot>
              );
            })}
          </NewField>
        </div>
      </div>
    </div>
  );
}
