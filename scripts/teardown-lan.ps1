<#
.SYNOPSIS
  Windows LAN network teardown for Card Game.
  Stops Docker containers and removes the firewall rule set up by setup-lan.ps1.
#>

$ROOT = Split-Path $PSScriptRoot -Parent
$RULE = "CardGame-LAN"

Write-Host "=== Card Game LAN Teardown ==="
Write-Host ""

Write-Host "--- Stopping app ---"
docker compose --project-directory $ROOT down -v
Write-Host ""

Write-Host "--- Removing network configuration ---"
Remove-NetFirewallRule -DisplayName $RULE -ErrorAction SilentlyContinue
Write-Host "  Firewall rule removed (or did not exist)."

Write-Host ""
Write-Host "  Done."
