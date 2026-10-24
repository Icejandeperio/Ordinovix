# scripts/init.ps1
$ErrorActionPreference = "Stop"

Write-Host "Initializing Ordinovix workspace..." -ForegroundColor Cyan

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "Node.js is not found in PATH. Please install Node.js >= 20."
    exit 1
}

Write-Host "Installing NPM dependencies..." -ForegroundColor Cyan
& npm.cmd install
if ($LASTEXITCODE -ne 0) {
    Write-Error "npm install failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}

Write-Host "Initialization completed successfully." -ForegroundColor Green
