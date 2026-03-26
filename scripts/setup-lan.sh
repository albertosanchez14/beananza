#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-80}"
TEARDOWN="${TEARDOWN:-false}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# ── LAN IP helpers ────────────────────────────────────────────────────────────

get_lan_ip_linux() { hostname -I | awk '{print $1}'; }
get_lan_ip_macos()  { ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null; }

# ── Teardown ──────────────────────────────────────────────────────────────────

teardown_linux() {
  if command -v ufw &>/dev/null; then
    sudo ufw delete allow "$PORT/tcp" 2>/dev/null || true
    echo "  ufw rule removed."
  fi
}

teardown_macos() {
  echo "  Nothing to tear down on macOS."
}

# ── Setup helpers ─────────────────────────────────────────────────────────────

setup_linux() {
  if command -v ufw &>/dev/null && sudo ufw status 2>/dev/null | grep -q "Status: active"; then
    echo "  Opening port $PORT in ufw..."
    sudo ufw allow "$PORT/tcp"
  else
    echo "  ufw not active — ensure port $PORT is reachable on your firewall."
  fi
}

setup_macos() {
  echo "  macOS: Docker Desktop forwards ports automatically."
  echo "  If blocked, allow port $PORT in System Settings → Network → Firewall."
}

# ── Detect OS ─────────────────────────────────────────────────────────────────

if [[ "$(uname)" == "Darwin" ]]; then
  ENV="macos"
else
  ENV="linux"
fi

# ── Main ─────────────────────────────────────────────────────────────────────

echo "=== Card Game LAN Setup ==="
echo "  Environment : $ENV"
echo "  Port        : $PORT"
echo ""

if [[ "$TEARDOWN" == "true" ]]; then
  echo "--- Tearing down LAN configuration ---"
  "teardown_${ENV}"
  exit 0
fi

LAN_IP="${IP:-$(get_lan_ip_${ENV})}"
if [[ -z "$LAN_IP" ]]; then
  echo "ERROR: Could not detect LAN IP automatically."
  echo "Set it manually:  IP=<your-ip> bash scripts/setup-lan.sh"
  exit 1
fi

echo "--- Configuring network ---"
"setup_${ENV}" "$LAN_IP"
echo ""

echo "--- Starting app ---"
echo "  URL : http://$LAN_IP:$PORT"
echo ""

APP_HOST="$LAN_IP:$PORT" PORT="$PORT" docker compose -f "$ROOT_DIR/docker-compose.yml" up --build
