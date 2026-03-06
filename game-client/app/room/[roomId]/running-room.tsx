"use client";

import { useRouter } from "next/router";

type RunningRoomProp = {
  roomId: string;
};

export default function RunningRoom({ roomId }: RunningRoomProp) {
  const router = useRouter();
  return (
    <div className="flex flex-col items-center justify-center flex-1 gap-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-amber-600 dark:text-amber-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 
										3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 
										3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 
										15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Game in Progress
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs">
          Room{" "}
          <span className="font-semibold text-gray-700 dark:text-gray-300">
            {roomId}
          </span>{" "}
          already has a game running. You cannot join until the current game
          ends.
        </p>
      </div>
      <button
        onClick={() => router.push("/room")}
        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 
							text-white text-sm font-semibold rounded-xl"
      >
        Back to rooms
      </button>
    </div>
  );
}
