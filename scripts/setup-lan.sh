#!/usr/bin/env bash
set -euo pipefail

PORT=80
TEARDOWN="${TEARDOWN:-false}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

# ── Environment detection ─────────────────────────────────────────────────────

detect_env() {
  if grep -qi microsoft /proc/version 2>/dev/null; then
    echo "wsl2"
  elif uname -s 2>/dev/null | grep -qiE 'MINGW|CYGWIN|MSYS'; then
    echo "windows"
  elif [[ "$(uname)" == "Darwin" ]]; then
    echo "macos"
  else
    echo "linux"
  fi
}

# ── LAN IP helpers ────────────────────────────────────────────────────────────

get_lan_ip_wsl2() {
  powershell.exe -NoProfile -Command "
    Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
      \$_.IPAddress -notlike '127.*' -and
      \$_.IPAddress -notlike '169.254.*' -and
      \$_.IPAddress -notlike '172.*' -and
      \$_.PrefixOrigin -eq 'Dhcp'
    } |
    Select-Object -First 1 -ExpandProperty IPAddress
  " 2>/dev/null | tr -d '\r\n'
}

get_lan_ip_linux()   { hostname -I | awk '{print $1}'; }
get_lan_ip_macos()   { ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null; }
get_lan_ip_windows() { get_lan_ip_wsl2; }  # Git Bash — same PowerShell path

# ── Teardown ──────────────────────────────────────────────────────────────────

teardown_wsl2() {
  local ps_script
  ps_script="$(wslpath -w "${SCRIPT_DIR}/setup-lan.ps1")"
  powershell.exe -ExecutionPolicy Bypass -File "$ps_script" -Teardown -Port "$PORT"
}

teardown_windows() { teardown_wsl2; }

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

setup_wsl2() {
  local win_ip="$1"
  local wsl_ip
  wsl_ip="$(hostname -I | awk '{print $1}')"

  local ps_script
  ps_script="$(wslpath -w "${SCRIPT_DIR}/setup-lan.ps1")"

  powershell.exe -ExecutionPolicy Bypass -File "$ps_script" \
    -IP "$win_ip" -WSLip "$wsl_ip" -Port "$PORT" -NetworkOnly
}

setup_windows() {
  local win_ip="$1"
  local ps_script
  ps_script="$(wslpath -w "${SCRIPT_DIR}/setup-lan.ps1" 2>/dev/null || echo "${SCRIPT_DIR}/setup-lan.ps1")"

  powershell.exe -ExecutionPolicy Bypass -File "$ps_script" \
    -IP "$win_ip" -Port "$PORT" -NetworkOnly
}

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

# ── Main ─────────────────────────────────────────────────────────────────────

ENV="$(detect_env)"

echo "=== Card Game LAN Setup ==="
echo "  Environment : $ENV"
echo "  Port        : $PORT"
echo ""

if [[ "$TEARDOWN" == "true" ]]; then
  echo "--- Tearing down LAN configuration ---"
  "teardown_${ENV}"
  exit 0
fi

# Resolve LAN IP — env var IP overrides auto-detection
LAN_IP="${IP:-$(get_lan_ip_${ENV})}"
if [[ -z "$LAN_IP" ]]; then
  echo "ERROR: Could not detect LAN IP automatically."
  echo "Set it manually:  make lan IP=<your-ip>"
  exit 1
fi

echo "--- Configuring network ---"
"setup_${ENV}" "$LAN_IP"
echo ""

echo "--- Starting app ---"
echo "  URL : http://$LAN_IP"
echo ""

APP_HOST="$LAN_IP" docker compose -f "$ROOT_DIR/docker-compose.yml" up --build -d
