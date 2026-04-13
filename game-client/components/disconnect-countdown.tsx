"use client";

import { useEffect, useState } from "react";

type DisconnectCountdownProps = {
  deadline: string;
};

export default function DisconnectCountdown({
  deadline,
}: DisconnectCountdownProps) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    Math.max(0, Math.round((new Date(deadline).getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    const update = () => {
      const remaining = Math.max(
        0,
        Math.round((new Date(deadline).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
    };
    update();
    const id = setInterval(update, 500);
    return () => clearInterval(id);
  }, [deadline]);

  if (secondsLeft <= 0) return null;

  return <span className="tabular-nums">{secondsLeft}</span>;
}
