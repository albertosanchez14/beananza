"use client";

import { m } from "motion/react";

type ToastProps = {
  message: string;
  depth: number;
};

export default function Toast({ message, depth }: ToastProps) {
  return (
    <m.div
      initial={{ y: -160, opacity: 0 }}
      animate={{
        y: depth * 6,
        scale: 1 - depth * 0.04,
        opacity: 1 - depth * 0.08,
        rotate: depth === 0 ? [0, -3, 2.5, -2, 1.5, -0.8, 0] : 0,
      }}
      exit={{ y: -160, opacity: 0 }}
      transition={{
        y: { type: "spring", stiffness: 280, damping: 22 },
        scale: { type: "spring", stiffness: 280, damping: 22 },
        opacity: { duration: 0.2 },
        rotate: { duration: 0.65, ease: "easeOut", delay: 0.08 },
      }}
      style={{ zIndex: 10 - depth }}
      className="absolute inset-0"
    >
      <img
        src="/toastboard.webp"
        alt=""
        draggable={false}
        className="absolute inset-0 w-full h-full object-fill select-none pointer-events-none"
      />
      <div
        className="absolute flex items-center justify-center"
        style={{ top: "43%", left: "11%", right: "11%", bottom: "10%" }}
      >
        <span className="text-sm font-semibold text-[#5c3a1e] text-center leading-snug">
          {message}
        </span>
      </div>
    </m.div>
  );
}
