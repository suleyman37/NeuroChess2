param(
  [string]$ResultPath
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Resolve-PathFromRepo {
  param([string]$Path)
  if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
  return (Join-Path (Get-RepoRoot) $Path)
}

if (-not $ResultPath) { throw "ResultPath is required" }
$raw = Get-Content -LiteralPath (Resolve-PathFromRepo -Path $ResultPath) -Raw
$result = $raw | ConvertFrom-Json
$violations = New-Object System.Collections.Generic.List[string]

if ($raw -match "(?i)MICRO_PROMPT|codex_prompt") { $violations.Add("prompt_injection_field_or_text") | Out-Null }
foreach ($field in @("schema_version", "provider", "verdict", "hard_gates", "runtime_user_input_required")) {
  if ($null -eq $result.PSObject.Properties[$field]) { $violations.Add("missing_$field") | Out-Null }
}
if ($result.verdict -and @("PASS_VISUAL", "WARNING_VISUAL", "BLOCK_VISUAL") -notcontains [string]$result.verdict) {
  $violations.Add("invalid_verdict") | Out-Null
}
if ($null -ne $result.runtime_user_input_required -and [bool]$result.runtime_user_input_required) {
  $violations.Add("runtime_user_input_requested") | Out-Null
}
$requiredHardGates = @("cta_truthfulness", "no_fake_gamification", "no_fake_xp_rank_transfer", "board_central", "desktop_first", "not_generic_saas")
foreach ($gate in $requiredHardGates) {
  if ($null -eq $result.hard_gates -or $null -eq $result.hard_gates.PSObject.Properties[$gate]) {
    $violations.Add("missing_hard_gate_$gate") | Out-Null
  }
}

if ($violations.Count -gt 0) {
  $name = "REJECT_JURY_RESULT"
  $action = "REPAIR_OR_DISCARD_RESULT"
  $exitCode = 2
} else {
  $name = "PASS"
  $action = "CONTINUE"
  $exitCode = 0
}

$out = [ordered]@{
  design_jury_result_validation = $name
  provider = [string]$result.provider
  verdict = [string]$result.verdict
  violations = @($violations)
  recommended_action = $action
  runtime_user_input_required = $false
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$out | ConvertTo-Json -Depth 10
exit $exitCode
