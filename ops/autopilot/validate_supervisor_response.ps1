param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$Nonce,
  [string]$OutDir = ""
)

$ErrorActionPreference = "Continue"
if (-not $OutDir) {
  $OutDir = Join-Path (Split-Path -Parent (Resolve-Path $InputPath)) "validation"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$extractScript = Join-Path $PSScriptRoot "extract_supervisor_response.ps1"
$firewallScript = Join-Path $PSScriptRoot "prompt_firewall.ps1"
$extractOut = & powershell -NoProfile -ExecutionPolicy Bypass -File $extractScript -InputPath $InputPath -Nonce $Nonce -OutDir $OutDir 2>&1
$extractCode = $LASTEXITCODE
$extractOut | Set-Content -LiteralPath (Join-Path $OutDir "extract_stdout.txt") -Encoding UTF8

if ($extractCode -ne 0) {
  $summary = [ordered]@{
    verdict = "fail"
    stage = "extract"
    exit_code = $extractCode
    output = ($extractOut -join "`n")
  }
  $summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutDir "supervisor_validation.json") -Encoding UTF8
  $summary | ConvertTo-Json -Depth 8
  exit 1
}

$extractionJson = Join-Path $OutDir "supervisor_extraction.json"
$extraction = Get-Content -LiteralPath $extractionJson -Raw | ConvertFrom-Json

if ($extraction.verdict -eq "STOP") {
  $summary = [ordered]@{
    verdict = "pass"
    supervisor_verdict = "STOP"
    eligible_for_execution = $false
    extraction = $extractionJson
  }
  $summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutDir "supervisor_validation.json") -Encoding UTF8
  $summary | ConvertTo-Json -Depth 8
  exit 0
}

$firewallOut = & powershell -NoProfile -ExecutionPolicy Bypass -File $firewallScript -ExtractionJson $extractionJson -OutDir $OutDir 2>&1
$firewallCode = $LASTEXITCODE
$firewallOut | Set-Content -LiteralPath (Join-Path $OutDir "firewall_stdout.txt") -Encoding UTF8

$summary = [ordered]@{
  verdict = if ($firewallCode -eq 0) { "pass" } else { "fail" }
  supervisor_verdict = $extraction.verdict
  eligible_for_execution = ($firewallCode -eq 0)
  extraction = $extractionJson
  firewall = (Join-Path $OutDir "prompt_firewall.json")
  firewall_output = ($firewallOut -join "`n")
}
$summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $OutDir "supervisor_validation.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 8
exit $firewallCode
