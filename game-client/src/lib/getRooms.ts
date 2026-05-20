export interface Room {
  id: string;
  player_count: number;
  max_players: number;
  session_state: "waiting" | "playing" | "pause";
}

export async function getRooms(): Promise<Room[]> {
  const res = await fetch("/rooms");
  if (!res.ok) throw new Error(`Server responded with ${res.status}`);
  const data: Room[] = await res.json();
  return data;
}
