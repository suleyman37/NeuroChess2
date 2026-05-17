param(
  [string]$Message = "",
  [switch]$DryRun,
  [switch]$AllowOneShotFallback
)

$ErrorActionPreference = "Stop"

if ($Message -match '(?i)MICRO_PROMPT|backend|frontend|product mission|docs/rebuild|Night Mode') {
  throw "Persistent transport smoke messages must be non-mission and must not request product work."
}

$sessionPath = Join-Path $PSScriptRoot "local\chatgpt_sessions.local.json"
$transportKnown = $false
if (Test-Path -LiteralPath $sessionPath) {
  $session = Get-Content -LiteralPath $sessionPath -Raw | ConvertFrom-Json
  $transportKnown = [bool]$session.persistent_transport_mode_enabled
}

if (-not $transportKnown -and -not $AllowOneShotFallback) {
  $result = [ordered]@{
    status = "fail"
    reason = "NO_PERSISTENT_TRANSPORT_HANDLE"
    instructions = "Use start_persistent_chatgpt_transport.ps1 -LiveSmoke for the bounded same-process smoke, or A18H for a real single-process loop controller."
    browser_called = $false
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
    micro_prompt_requested = $false
  }
  $result | ConvertTo-Json -Depth 8
  exit 2
}

$result = [ordered]@{
  status = "pass"
  mode = if ($DryRun) { "dry_run" } else { "report_only" }
  note = "General cross-process persistent sends are intentionally not implemented in A18G; live proof uses one Node process."
  browser_called = $false
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
  micro_prompt_requested = $false
}
$result | ConvertTo-Json -Depth 8
exit 0
