# SOC-08 — vérifie Login + PATCH /me (audit + outbox)
$ErrorActionPreference = "Stop"
$base = "http://127.0.0.1:3001"

Write-Host "1. Health..." -ForegroundColor Cyan
try {
  $health = Invoke-RestMethod -Uri "$base/health/live" -Method Get -TimeoutSec 5
  Write-Host "   OK - $($health.status)" -ForegroundColor Green
} catch {
  Write-Host "   ECHEC - L'API ne repond pas sur $base" -ForegroundColor Red
  Write-Host "   Lancez dans un terminal : cd C:\Users\admin\Projects\Authority ; npm run dev:api" -ForegroundColor Yellow
  exit 1
}

Write-Host "2. Login (demo)..." -ForegroundColor Cyan
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$loginBody = @{ email = "demo@authority.local"; password = "DemoPass123!" } | ConvertTo-Json
$login = Invoke-RestMethod -Uri "$base/api/v1/identity/auth/login" -Method Post `
  -ContentType "application/json" -Body $loginBody -WebSession $session
Write-Host "   OK - session $($login.session.id)" -ForegroundColor Green

Write-Host "3. PATCH /me..." -ForegroundColor Cyan
$patchBody = @{ displayName = "Demo Operator" } | ConvertTo-Json
$patch = Invoke-RestMethod -Uri "$base/api/v1/identity/me" -Method Patch `
  -ContentType "application/json" -Body $patchBody -WebSession $session
Write-Host "   OK - displayName = $($patch.displayName)" -ForegroundColor Green
Write-Host ""
Write-Host "SOC-08 PATCH : tout est bon." -ForegroundColor Green
