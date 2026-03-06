"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const AVATAR_COLORS = [
  { label: "Blue", value: "bg-blue-500" },
  { label: "Green", value: "bg-green-500" },
  { label: "Red", value: "bg-red-500" },
  { label: "Amber", value: "bg-amber-400" },
  { label: "Purple", value: "bg-purple-500" },
  { label: "Pink", value: "bg-pink-500" },
  { label: "Cyan", value: "bg-cyan-500" },
  { label: "Orange", value: "bg-orange-500" },
];

export default function IdentifyPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [playerId, setPlayerId] = useState("");
  const [selectedColor, setSelectedColor] = useState(AVATAR_COLORS[0].value);

  const handleSave = () => {
    if (!name.trim() || !playerId.trim()) return;
    localStorage.setItem(
      "playerProfile",
      JSON.stringify({
        name: name.trim(),
        playerId: playerId.trim(),
        color: selectedColor,
      }),
    );
    router.push("/room");
  };

  const isValid = name.trim().length > 0 && playerId.trim().length > 0;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-zinc-800 border border-zinc-700 shadow-2xl p-8 flex flex-col gap-7">
        {/* Header */}
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-white">Identify yourself</h2>
          <p className="text-sm text-zinc-400">
            Set your player details before joining a game.
          </p>
        </div>

        {/* Avatar color picker */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-300">
            Avatar color
          </label>
          <div className="flex flex-wrap gap-2">
            {AVATAR_COLORS.map((c) => (
              <button
                key={c.value}
                title={c.label}
                onClick={() => setSelectedColor(c.value)}
                className={`w-8 h-8 rounded-full ${c.value} transition-transform duration-100 cursor-pointer
                  ${
                    selectedColor === c.value
                      ? "ring-2 ring-white ring-offset-2 ring-offset-zinc-800 scale-110"
                      : "hover:scale-105 opacity-70 hover:opacity-100"
                  }`}
              />
            ))}
          </div>
          {/* Preview */}
          <div className="flex items-center gap-3 mt-1">
            <div
              className={`w-10 h-10 rounded-full ${selectedColor} flex items-center justify-center text-white font-bold text-lg shadow`}
            >
              {name.trim().charAt(0).toUpperCase() || "?"}
            </div>
            <span className="text-zinc-400 text-sm">Preview</span>
          </div>
        </div>

        {/* Player name */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium text-zinc-300">
            Player name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. BeanMaster"
            maxLength={24}
            className="rounded-lg bg-zinc-700 border border-zinc-600 focus:border-blue-500 focus:outline-none text-white placeholder-zinc-500 px-3 py-2 text-sm transition-colors"
          />
        </div>

        {/* Player ID */}
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="playerId"
            className="text-sm font-medium text-zinc-300"
          >
            Player ID
          </label>
          <input
            id="playerId"
            type="text"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value.replace(/\s/g, ""))}
            placeholder="e.g. beanmaster42"
            maxLength={20}
            className="rounded-lg bg-zinc-700 border border-zinc-600 focus:border-blue-500 focus:outline-none text-white placeholder-zinc-500 px-3 py-2 text-sm transition-colors"
          />
          <p className="text-xs text-zinc-500">Unique identifier, no spaces.</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={() => router.back()}
            className="flex-1 rounded-lg border border-zinc-600 hover:border-zinc-400 bg-transparent hover:bg-zinc-700 text-zinc-300 font-medium py-2.5 text-sm transition-all duration-150 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid}
            className="flex-1 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-2.5 text-sm transition-all duration-150 cursor-pointer"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
