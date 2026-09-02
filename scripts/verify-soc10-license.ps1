# SOC-10 smoke: login, license status, site limit gate
$ErrorActionPreference = 'Stop'
$base = 'http://127.0.0.1:3001'
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

function Post-Json($url, $body) {
  Invoke-RestMethod -Uri $url -Method Post -WebSession $session -ContentType 'application/json' -Body ($body | ConvertTo-Json)
}

function Put-Json($url, $body) {
  Invoke-RestMethod -Uri $url -Method Put -WebSession $session -ContentType 'application/json' -Body ($body | ConvertTo-Json)
}

Write-Host '1. Login...'
Post-Json "$base/api/v1/identity/auth/login" @{
  email = 'demo@authority.local'
  password = 'DemoPass123!'
} | Out-Null

Write-Host '2. List companies...'
$companies = Invoke-RestMethod -Uri "$base/api/v1/organization/companies" -WebSession $session
$companyId = $companies[0].id
Write-Host "   companyId=$companyId"

Write-Host '3. Set context (company only)...'
Put-Json "$base/api/v1/organization/me/context" @{ companyId = $companyId } | Out-Null

Write-Host '4. License status...'
$status = Invoke-RestMethod -Uri "$base/api/v1/license/status" -WebSession $session
Write-Host "   maxSites=$($status.limits.maxSites) usage.sites=$($status.usage.sites)"

if ($status.limits.maxSites -ne 2) {
  throw "Expected maxSites=2, got $($status.limits.maxSites)"
}

$suffix = Get-Date -Format 'HHmmss'
$code1 = "V$suffix"
$code2 = "W$suffix"

Write-Host "5. Create site $code1 (expect 201)..."
try {
  $site1 = Post-Json "$base/api/v1/organization/companies/$companyId/sites" @{
    code = $code1
    type = 'DEPOT'
  }
  Write-Host "   created id=$($site1.id)"
} catch {
  if ($_.Exception.Response.StatusCode.value__ -eq 403) {
    Write-Host '   403 — limit already reached; skipping first create'
  } else {
    throw
  }
}

Write-Host "6. Create site $code2 (expect 403 LIMIT_SITES)..."
try {
  Post-Json "$base/api/v1/organization/companies/$companyId/sites" @{
    code = $code2
    type = 'DEPOT'
  }
  throw 'Expected 403 on second site create'
} catch {
  $resp = $_.ErrorDetails.Message
  if ($resp -notmatch 'LIC\.LIMIT_SITES') {
    throw "Expected LIC.LIMIT_SITES, got: $resp"
  }
  Write-Host '   403 LIC.LIMIT_SITES OK'
}

Write-Host 'SOC-10 verification passed.'
