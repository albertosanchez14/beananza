// Docker builds pass NEXT_PUBLIC_HOST (e.g. "localhost" or "192.168.1.42").
// Local dev uses NEXT_PUBLIC_WS_URL pointing directly at the Go server (:8080).
export const apiBaseUrl = process.env.NEXT_PUBLIC_HOST
  ? `http://${process.env.NEXT_PUBLIC_HOST}`
  : "http://localhost:8080";


export const wsUrl = process.env.NEXT_PUBLIC_HOST
  ? `ws://${process.env.NEXT_PUBLIC_HOST}/ws`
  : (process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8080/ws");
