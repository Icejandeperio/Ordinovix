# scripts/preview.ps1
$ErrorActionPreference = "Stop"

Write-Host "Starting Ordinovix preview server on localhost:5173..." -ForegroundColor Cyan

& npm.cmd run dev -- --host
