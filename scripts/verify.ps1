# scripts/verify.ps1
param (
    [switch]$Fast,
    [string]$Tier = "T1"
)

$ErrorActionPreference = "Stop"

Write-Host "Running Ordinovix verification gate (Tier: $Tier, Fast: $Fast)..." -ForegroundColor Cyan

# Step 1: Type check
Write-Host "Running TypeScript typecheck..." -ForegroundColor Cyan
& npx.cmd tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Error "TypeScript type check failed"
    exit $LASTEXITCODE
}

# Step 2: Unit tests
Write-Host "Running Vitest test suite..." -ForegroundColor Cyan
& npm.cmd run test:run
if ($LASTEXITCODE -ne 0) {
    Write-Error "Vitest unit tests failed"
    exit $LASTEXITCODE
}

if (-not $Fast) {
    # Step 3: Production build check
    Write-Host "Running Vite build check..." -ForegroundColor Cyan
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Build verification failed"
        exit $LASTEXITCODE
    }
}

Write-Host "All verification checks passed!" -ForegroundColor Green
