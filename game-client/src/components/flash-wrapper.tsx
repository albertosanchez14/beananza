"use client";

import { motion, useAnimation } from "motion/react";
import { useEffect, ReactNode } from "react";

const SHAKE_SEQUENCE = [0, -6, 6, -5, 5, -3, 3, 0];

export function FlashWrapper({
  flashSignal,
  children,
}: {
  flashSignal: number;
  children: ReactNode;
}) {
  const controls = useAnimation();

  useEffect(() => {
    if (!flashSignal) return;
    controls.start({
      x: SHAKE_SEQUENCE,
      boxShadow: [
        "0 0 0px 0px rgba(239,68,68,0)",
        "0 0 18px 6px rgba(239,68,68,0.85)",
        "0 0 0px 0px rgba(239,68,68,0)",
        "0 0 18px 6px rgba(239,68,68,0.85)",
        "0 0 0px 0px rgba(239,68,68,0)",
        "0 0 18px 6px rgba(239,68,68,0.85)",
        "0 0 0px 0px rgba(239,68,68,0)",
      ],
      transition: {
        x: { duration: 0.45, ease: "easeInOut" },
        boxShadow: { duration: 1.8, ease: "easeInOut" },
      },
    });
  }, [flashSignal, controls]);

  return (
    <motion.div animate={controls} style={{ borderRadius: 12 }}>
      {children}
    </motion.div>
  );
}
