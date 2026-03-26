<#
.SYNOPSIS
  Windows LAN network setup for Card Game.
#>
param(
  [string]$IP   = "",
	[int]   $Port = 80
)

$ROOT = Split-Path $PSScriptRoot -Parent
$RULE = "CardGame-LAN"

Write-Host "=== Card Game LAN Setup ==="
Write-Host "  Port : $Port"
Write-Host ""

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
    Write-Error "Could not detect LAN IP automatically. Use: .\setup-lan.ps1 -IP <your-ip>"
    exit 1
  }
}

Write-Host "  LAN IP : $LAN_IP"
Write-Host ""


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

Write-Host ""

Write-Host "--- Starting app ---"
Write-Host "  URL : http://${LAN_IP}:${Port}"
Write-Host ""
$env:APP_HOST = "${LAN_IP}:${Port}"
$env:PORT = $Port
docker compose --project-directory $ROOT up --build
