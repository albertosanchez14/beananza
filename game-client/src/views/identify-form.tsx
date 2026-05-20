import { useRef, useState } from "react";
import { register } from "@/lib/register";
import { useAppRouter } from "@/lib/router";
import { uploadAvatar } from "@/lib/uploadAvatar";
import { saveProfile } from "@/hooks/usePlayerProfile";

const PRESET_AVATARS = [
  "/avatars/bandit.webp",
  "/avatars/barman.webp",
  "/avatars/cowboy.webp",
  "/avatars/cowgirl.webp",
  "/avatars/gungirl.webp",
  "/avatars/ladydress.webp",
  "/avatars/native.webp",
  "/avatars/oldman.webp",
  "/avatars/sheriff.webp",
  "/avatars/sheriff2.webp",
  "/avatars/telescopegirl.webp",
  "/avatars/wantedgirl.webp",
];

type IdentifyFormProps = {
  returnTo: string;
};

export function IdentifyForm({ returnTo }: IdentifyFormProps) {
  const router = useAppRouter();

  const [name, setName] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState(PRESET_AVATARS[0]);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    try {
      const fullUrl = await uploadAvatar(file);
      setCustomAvatar(fullUrl);
      setSelectedAvatar(fullUrl);
    } catch {
      setError("Could not upload image. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;

    setLoading(true);
    setError(null);

    try {
      const data = await register(trimmedName);
      saveProfile(trimmedName, data.player_id, data.auth_token, selectedAvatar);
      router.push(returnTo);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not reach the server. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const isValid = name.trim().length > 0;

  return (
    <div
      className="relative w-full max-w-sm rounded-2xl shadow-2xl p-8 flex flex-col gap-7"
        style={{
          background: "rgba(20, 10, 3, 0.82)",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(180,120,60,0.25)",
        }}
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-white uppercase tracking-widest [text-shadow:0_1px_4px_#000]">
            Identify yourself
          </h2>
          <p className="text-sm text-white/60">
            Set your player name before joining a game.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium text-white">Avatar</p>
          <div className="flex flex-wrap gap-2">
            {PRESET_AVATARS.map((src) => (
              <button
                key={src}
                title={src}
                onClick={() => setSelectedAvatar(src)}
                className={`w-12 h-12 rounded-full overflow-hidden 
									transition-transform duration-100 cursor-pointer
                  ${
                    selectedAvatar === src
                      ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-transparent scale-110"
                      : "hover:scale-105 opacity-70 hover:opacity-100"
                  }`}
              >
                <img
                  src={src}
                  alt=""
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              </button>
            ))}

            {customAvatar && (
              <button
                title="Your uploaded avatar"
                onClick={() => setSelectedAvatar(customAvatar)}
                className={`w-12 h-12 rounded-full overflow-hidden
                  transition-transform duration-100 cursor-pointer
                  ${
                    selectedAvatar === customAvatar
                      ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-transparent scale-110"
                      : "hover:scale-105 opacity-70 hover:opacity-100"
                  }`}
              >
                <img
                  src={customAvatar}
                  alt="Custom"
                  className="w-full h-full object-contain"
                />
              </button>
            )}

            <button
              title="Upload custom avatar"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-12 h-12 rounded-full border-2 border-dashed
							border-amber-700 hover:border-amber-400 flex items-center
							justify-center text-white/70 hover:text-white
							transition-all cursor-pointer disabled:opacity-40
							disabled:cursor-not-allowed"
            >
              {uploading ? (
                <span className="text-[10px] font-semibold">...</span>
              ) : (
                <span className="text-xl leading-none">+</span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="name" className="text-sm font-medium text-white">
            Player name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. BeanMaster"
            maxLength={24}
            className="western-input rounded-lg bg-black/30 border border-amber-800
						focus:border-amber-500 focus:outline-none text-white
						px-3 py-2 text-sm transition-colors"
            style={{
              WebkitBoxShadow: "0 0 0 1000px rgba(20, 10, 3, 0.9) inset",
            }}
          />
        </div>

        {error && <p className="text-sm text-red-400 -mt-3">{error}</p>}

        <div className="flex gap-3 pt-1">
          <button
            onClick={() => router.back()}
            disabled={loading}
            className="flex-1 rounded-lg border border-amber-800
						hover:border-amber-500 bg-transparent hover:bg-amber-900/40
						text-white font-medium py-2.5 text-sm transition-all
						duration-150 cursor-pointer disabled:opacity-40
						disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!isValid || loading}
            className="flex-1 rounded-lg bg-amber-700 hover:bg-amber-600
						active:bg-amber-800 disabled:opacity-40 disabled:cursor-not-allowed
						text-white font-semibold py-2.5 text-sm transition-all duration-150
						cursor-pointer"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
  );
}
