"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type PlayerProfile = {
  id: string;
  name: string;
  authToken: string;
  avatar: string;
};

export function saveProfile(
  name: string,
  playerId: string,
  authToken: string,
  avatar: string,
): void {
  localStorage.setItem(
    "playerProfile",
    JSON.stringify({ name, playerId, authToken, avatar }),
  );
}

function loadProfile(): PlayerProfile | null {
  try {
    const raw = localStorage.getItem("playerProfile");
    const profile = raw ? JSON.parse(raw) : null;
    if (!profile?.playerId || !profile?.name || !profile?.authToken)
      return null;
    return {
      id: profile.playerId as string,
      name: profile.name as string,
      authToken: profile.authToken as string,
      avatar: (profile.avatar as string) ?? "",
    };
  } catch {
    return null;
  }
}

export function usePlayerProfile(roomId: string) {
  const router = useRouter();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setProfile(loadProfile());
    setChecked(true);
  }, []);

  useEffect(() => {
    if (checked && !profile) {
      router.replace(`/identify?returnTo=/room/${roomId}`);
    }
  }, [router, roomId, profile, checked]);

  const redirectToIdentify = useCallback(() => {
    localStorage.removeItem("playerProfile");
    router.replace(`/identify?returnTo=/room/${roomId}`);
  }, [router, roomId]);

  return { profile, redirectToIdentify };
}
