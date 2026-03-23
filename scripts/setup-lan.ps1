<#
.SYNOPSIS
  Windows LAN network setup for Card Game.
  Used by: native Windows make (full flow), and WSL2 bash (-NetworkOnly).
#>
param(
  [string]$IP          = "",    # override auto-detected LAN IP
  [string]$WSLip       = "",    # WSL2 internal IP — enables portproxy
  [int]   $Port        = 80,
  [switch]$Teardown,            # remove firewall/portproxy and exit
  [switch]$NetworkOnly          # skip Docker start (called from WSL2 bash)
)

$ROOT    = Split-Path $PSScriptRoot -Parent
$RULE    = "CardGame-LAN"

Write-Host "=== Card Game LAN Setup ==="
Write-Host "  Port : $Port"
Write-Host ""

# ── Teardown ──────────────────────────────────────────────────────────────────

if ($Teardown) {
  Write-Host "--- Tearing down LAN configuration ---"
  Remove-NetFirewallRule -DisplayName $RULE -ErrorAction SilentlyContinue
  netsh interface portproxy delete v4tov4 listenport=$Port listenaddress=0.0.0.0 2>$null | Out-Null
  Write-Host "  Done."
  exit 0
}

# ── Resolve LAN IP ────────────────────────────────────────────────────────────

if ($IP) {
  $LAN_IP = $IP
} else {
  $LAN_IP = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object {
      $_.IPAddress -notlike '127.*' -and
      $_.IPAddress -notlike '169.254.*' -and
      $_.PrefixOrigin -eq 'Dhcp'
    } |
    Select-Object -First 1 -ExpandProperty IPAddress

  if (-not $LAN_IP) {
    Write-Error "Could not detect LAN IP automatically. Use: make lan IP=<your-ip>"
    exit 1
  }
}

Write-Host "  LAN IP : $LAN_IP"
if ($WSLip) { Write-Host "  WSL IP : $WSLip" }
Write-Host ""

# ── Firewall rule ─────────────────────────────────────────────────────────────

Write-Host "--- Configuring network ---"

$ruleExists = [bool](Get-NetFirewallRule -DisplayName $RULE -ErrorAction SilentlyContinue)
if ($ruleExists) {
  Write-Host "  Firewall rule already exists — skipping."
} else {
  try {
    New-NetFirewallRule -DisplayName $RULE -Direction Inbound -Protocol TCP `
      -LocalPort $Port -Action Allow | Out-Null
    Write-Host "  Firewall rule created."
  } catch {
    Write-Warning "Could not create firewall rule (needs admin elevation)."
    Write-Host "  Run manually in elevated PowerShell:"
    Write-Host "    New-NetFirewallRule -DisplayName '$RULE' -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow"
  }
}

# ── Portproxy (WSL2 only) ─────────────────────────────────────────────────────

if ($WSLip) {
  $proxyExists = [bool](
    netsh interface portproxy show v4tov4 |
    Select-String "0\.0\.0\.0\s+$Port\s"
  )
  if ($proxyExists) {
    Write-Host "  Portproxy already exists — skipping."
  } else {
    netsh interface portproxy add v4tov4 `
      listenport=$Port listenaddress=0.0.0.0 `
      connectport=$Port connectaddress=$WSLip 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Write-Host "  Portproxy created ($Port -> $WSLip)."
    } else {
      Write-Warning "Could not create portproxy (needs admin elevation)."
      Write-Host "  Run manually in elevated PowerShell:"
      Write-Host "    netsh interface portproxy add v4tov4 listenport=$Port listenaddress=0.0.0.0 connectport=$Port connectaddress=$WSLip"
    }
  }
}

Write-Host ""

# ── Docker start (native Windows only) ───────────────────────────────────────

if (-not $NetworkOnly) {
  Write-Host "--- Starting app ---"
  Write-Host "  URL : http://$LAN_IP"
  Write-Host ""
  $env:APP_HOST = $LAN_IP
  docker compose --project-directory $ROOT up --build -d
}
