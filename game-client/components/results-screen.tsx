"use client";

import { m } from "motion/react";
import { useRouter } from "next/navigation";
import Image from "next/image";

type ResultsPlayer = {
  playerId: string;
  playerName: string;
  playerAvatar?: string;
  coins: number;
  isMe?: boolean;
};

type ResultsScreenProps = {
  players: ResultsPlayer[];
};

function WantedPoster({
  player,
  isWinner,
  delay,
  large,
}: {
  player: ResultsPlayer;
  isWinner: boolean;
  delay: number;
  large?: boolean;
}) {
  const width = large ? 240 : 148;
  const avatarSize = large ? 120 : 64;

  return (
    <m.div
      initial={
        isWinner ? { y: -380, rotate: -10, opacity: 0 } : { x: 220, opacity: 0 }
      }
      animate={
        isWinner ? { y: 0, rotate: 0, opacity: 1 } : { x: 0, opacity: 1 }
      }
      transition={{
        type: "spring",
        stiffness: isWinner ? 260 : 280,
        damping: isWinner ? 22 : 24,
        delay,
      }}
      className="relative shrink-0"
      style={{
        width,
        aspectRatio: "2 / 3",
        filter: "drop-shadow(5px 8px 18px rgba(0,0,0,0.75))",
      }}
    >
      <Image
        src="/wanted-poster-bg.webp"
        alt=""
        fill
        className="object-cover"
        priority
      />

      <div
        className="absolute inset-0 flex flex-col items-center z-10"
        style={{ padding: large ? "28px" : "18px 12px 14px" }}
      >
        {/* WANTED — top */}
        <p
          className="text-amber-950 font-black tracking-widest uppercase shrink-0"
          style={{ fontSize: large ? "2.5rem" : "0.85rem" }}
        >
          WANTED
        </p>

        {/* Spacer above avatar */}
        <div className="flex-1" />

        {/* Avatar + stamp wrapper */}
        <div
          className="relative shrink-0"
          style={{ width: avatarSize, height: avatarSize }}
        >
          <div
            className="
              rounded-full overflow-hidden border-2 border-amber-900
              bg-amber-200 w-full h-full flex items-center justify-center
            "
            style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.45)" }}
          >
            {player.playerAvatar ? (
              <Image
                src={player.playerAvatar}
                alt={player.playerName}
                width={avatarSize}
                height={avatarSize}
                className="object-contain w-full h-full"
              />
            ) : (
              <span
                className="font-bold text-amber-800"
                style={{ fontSize: large ? "3rem" : "1.8rem" }}
              >
                {player.playerName[0]?.toUpperCase() ?? "?"}
              </span>
            )}
          </div>

          {/* WINNER stamp — centered on avatar */}
          {isWinner && (
            <m.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.88 }}
              transition={{
                type: "spring",
                stiffness: 520,
                damping: 16,
                delay: delay + 0.55,
              }}
              className="
                absolute inset-0 flex items-center
                justify-center pointer-events-none
              "
            >
              <div style={{ transform: "rotate(-15deg)" }}>
                <p
                  className="
                    border-[3px] border-red-700 text-red-700
                    font-black uppercase tracking-widest px-2 py-1
                  "
                  style={{
                    fontSize: large ? "2.1rem" : "1.1rem",
                    textShadow: "0 0 10px rgba(185,28,28,0.35)",
                    boxShadow: "0 0 10px rgba(185,28,28,0.25)",
                  }}
                >
                  WINNER
                </p>
              </div>
            </m.div>
          )}

          {/* OUTLAW stamp — centered on avatar */}
          {!isWinner && (
            <m.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 0.42 }}
              transition={{
                type: "spring",
                stiffness: 420,
                damping: 18,
                delay: delay + 0.45,
              }}
              className="
                absolute inset-0 flex items-center
                justify-center pointer-events-none
              "
            >
              <div style={{ transform: "rotate(-12deg)" }}>
                <p
                  className="
                    border-2 border-gray-600 text-gray-700
                    font-black uppercase tracking-widest px-1 py-0.5
                  "
                  style={{ fontSize: large ? "1rem" : "0.7rem" }}
                >
                  OUTLAW
                </p>
              </div>
            </m.div>
          )}
        </div>

        {/* Name — directly below avatar */}
        <p
          className="
            text-amber-950 font-bold text-center
            w-full truncate shrink-0
          "
          style={{
            fontSize: large ? "1rem" : "0.8rem",
            marginTop: large ? "6px" : "4px",
          }}
        >
          {player.playerName}
        </p>

        {/* Spacer pushes reward to bottom */}
        <div className="flex-1" />

        {/* ——— REWARD ——— pinned at bottom */}
        <div className="flex flex-col items-center w-full shrink-0">
          <div className="flex items-center w-full">
            <div className="flex-1 border-t border-amber-800/50" />
            <span
              className="
                text-amber-950 font-black tracking-widest uppercase px-1
              "
              style={{ fontSize: large ? "1.5rem" : "0.7rem" }}
            >
              REWARD
            </span>
            <div className="flex-1 border-t border-amber-800/50" />
          </div>
          <p
            className="text-amber-950 font-bold text-center"
            style={{ fontSize: large ? "1rem" : "0.75rem" }}
          >
            {player.coins} coins
          </p>
        </div>
      </div>
    </m.div>
  );
}

export default function ResultsScreen({ players }: ResultsScreenProps) {
  const router = useRouter();
  const sorted = [...players].sort((a, b) => b.coins - a.coins);
  const winner = sorted[0];
  const losers = sorted.slice(1);

  return (
    <div
      className="
        fixed inset-0 z-50 bg-black/60 backdrop-blur-sm
        flex flex-col items-center justify-center gap-8 px-6
      "
    >
      <m.h1
        initial={{ y: -80, opacity: 0, rotate: -3 }}
        animate={{ y: 0, opacity: 1, rotate: 0 }}
        transition={{
          type: "spring",
          stiffness: 340,
          damping: 22,
          delay: 0.08,
        }}
        className="text-amber-300 uppercase tracking-widest"
        style={{
          fontSize: "clamp(2rem, 6vw, 3.75rem)",
          textShadow:
            "0 2px 14px rgba(0,0,0,0.9), 0 0 32px rgba(251,191,36,0.25)",
        }}
      >
        Game Over
      </m.h1>

      <div className="flex items-center gap-10">
        {winner && <WantedPoster player={winner} isWinner delay={0.3} large />}

        {losers.length > 0 && (
          <div className="flex flex-col gap-4">
            {losers.map((player, i) => (
              <WantedPoster
                key={player.playerId}
                player={player}
                isWinner={false}
                delay={0.62 + i * 0.15}
              />
            ))}
          </div>
        )}
      </div>

      <m.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.25, duration: 0.38, ease: "easeOut" }}
        className="flex gap-4"
      >
        <button
          onClick={() => router.push("/room")}
          className="
            px-6 py-2.5 bg-amber-700 hover:bg-amber-600 active:bg-amber-800
            text-amber-100 font-bold uppercase tracking-widest
            border-2 border-amber-500 transition-colors cursor-pointer
          "
          style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
        >
          Ride Again
        </button>
        <button
          onClick={() => router.push("/")}
          className="
            px-6 py-2.5 bg-transparent hover:bg-amber-900/40 active:bg-amber-900/60
            text-amber-300 font-bold uppercase tracking-widest
            border-2 border-amber-700 transition-colors cursor-pointer
          "
          style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
        >
          Leave Town
        </button>
      </m.div>
    </div>
  );
}
