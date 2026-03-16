"use client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Desert landscape background */}
      <img
        src="/hero/desert_landscape_4k.png"
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-bottom"
      />

      {/* Clouds layer — separate element for future animation */}
      <img
        src="/hero/clouds_4k_landscape_sharpened.png"
        alt=""
        className="absolute bottom-80 left-0 w-full h-auto"
        style={{ display: "block" }}
      />

      {/* Bottom-up dark vignette for text legibility */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 60%)",
        }}
      />

      {/* Main content — centered */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <div className="flex flex-col items-center gap-3 mb-8">
          <h1
            className="text-7xl font-bold tracking-widest text-amber-300"
            style={{ textShadow: "2px 4px 12px rgba(0,0,0,0.8)" }}
          >
            BOHNANZA
          </h1>
          <p className="text-lg text-amber-200/80 italic">
            To Bean or not to Bean!
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs sm:max-w-sm">
          <button
            onClick={() => router.push("/room")}
            className="flex-1 rounded-xl bg-amber-700 hover:bg-amber-600 active:bg-amber-800 border border-amber-500 text-white font-semibold text-lg py-3 px-8 cursor-pointer"
          >
            Play Now
          </button>
          <button
            onClick={() => router.push("/identify")}
            className="flex-1 rounded-xl border border-amber-600/60 hover:border-amber-400 text-amber-200 font-semibold text-lg py-3 px-8 cursor-pointer"
          >
            Identify
          </button>
        </div>
      </main>
    </div>
  );
}
