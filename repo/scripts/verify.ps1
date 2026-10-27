# scripts/verify.ps1 (human-owned). Thin PowerShell wrapper around the cross-platform gate.
# Usage: .\scripts\verify.ps1            full gate
#        .\scripts\verify.ps1 --fast     typecheck, lint, unit
#        .\scripts\verify.ps1 --no-e2e   everything except acceptance
& node "$PSScriptRoot/verify.mjs" @args
exit $LASTEXITCODE
