"use client";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center">
      <main className="flex flex-col items-center justify-center gap-10 px-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <h1 className="text-6xl font-extrabold tracking-tight text-white drop-shadow-lg">
            BOHNANZA
          </h1>
          <p className="text-lg text-zinc-400 font-medium">
            To Bean or not to Bean!
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-xs sm:max-w-sm">
          <button
            onClick={() => router.push("/room")}
            className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 
						text-white font-semibold text-lg py-3 px-8 cursor-pointer"
          >
            Play Now
          </button>
          <button
            onClick={() => router.push("/identify")}
            className="flex-1 rounded-xl border border-zinc-600 hover:border-zinc-400 
						bg-zinc-800 hover:bg-zinc-700 active:bg-zinc-900 text-zinc-200 font-semibold
						text-lg py-3 px-8 cursor-pointer"
          >
            Identify
          </button>
        </div>
      </main>
    </div>
  );
}
