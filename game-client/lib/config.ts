function requiredUrl(name: string, value: string | undefined) {
  const url = value?.trim();

  if (!url) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return url;
}

export function getServerApiBaseUrl() {
  return requiredUrl("INTERNAL_API_URL", process.env.INTERNAL_API_URL);
}

export function getWebSocketUrl() {
  if (typeof window === "undefined") {
    return "/ws";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}
