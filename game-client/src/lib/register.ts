export type RegisterResult = {
  player_id: string;
  auth_token: string;
};

export async function register(name: string): Promise<RegisterResult> {
  const res = await fetch("/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text.trim() || "Registration failed. Please try again.");
  }
  return res.json();
}
