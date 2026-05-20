import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";

export function useAppRouter() {
  const navigate = useNavigate();

  return useMemo(
    () => ({
      push: (to: string) => void navigate({ href: to }),
      replace: (to: string) => void navigate({ href: to, replace: true }),
      back: () => window.history.back(),
      prefetch: (_to: string) => {},
    }),
    [navigate],
  );
}
