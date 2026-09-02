# SOC-11 — full flow: login -> context -> settings
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:3001'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

Write-Host '1. Health...'
try {
  $health = Invoke-RestMethod -Uri "$base/health/live" -TimeoutSec 5
  Write-Host "   OK - $($health.status)"
} catch {
  Write-Host "   FAIL - API not running on $base"
  Write-Host '   Run: cd C:\Users\admin\Projects\Authority ; npm run dev:api'
  exit 1
}

Write-Host '2. Login demo...'
Invoke-RestMethod -Uri "$base/api/v1/identity/auth/login" -Method Post `
  -WebSession $session -ContentType 'application/json' `
  -Body (@{ email = 'demo@authority.local'; password = 'DemoPass123!' } | ConvertTo-Json) | Out-Null
Write-Host '   OK'

Write-Host '3. Set company context DEMO...'
$companies = Invoke-RestMethod -Uri "$base/api/v1/organization/companies" -WebSession $session
$demo = $companies | Where-Object { $_.code -eq 'DEMO' } | Select-Object -First 1
if (-not $demo) { throw 'DEMO company not found' }
Invoke-RestMethod -Uri "$base/api/v1/organization/me/context" -Method Put `
  -WebSession $session -ContentType 'application/json' `
  -Body (@{ companyId = $demo.id } | ConvertTo-Json) | Out-Null
Write-Host "   OK - company $($demo.code)"

Write-Host '4. GET settings/effective...'
$effective = Invoke-RestMethod -Uri "$base/api/v1/settings/effective" -WebSession $session
$theme = $effective.settings | Where-Object { $_.key -eq 'ui.theme' }
Write-Host "   OK - ui.theme=$($theme.value) source=$($theme.source)"

Write-Host '5. PUT settings (ui.theme=dark)...'
$updated = Invoke-RestMethod -Uri "$base/api/v1/settings" -Method Put `
  -WebSession $session -ContentType 'application/json' `
  -Body (@{ key = 'ui.theme'; value = 'dark' } | ConvertTo-Json)
Write-Host "   OK - ui.theme=$($updated.value) source=$($updated.source)"

Write-Host '6. Check pref does not grant admin permission...'
$check = Invoke-RestMethod -Uri "$base/api/v1/identity/permissions/check" -Method Post `
  -WebSession $session -ContentType 'application/json' `
  -Body (@{ permissionKey = 'identity.user.manage' } | ConvertTo-Json)
if ($check.allowed -eq $true) { throw 'identity.user.manage should be denied' }
Write-Host '   OK - identity.user.manage still denied'

Write-Host ''
Write-Host 'SOC-11 Settings verification passed.'
