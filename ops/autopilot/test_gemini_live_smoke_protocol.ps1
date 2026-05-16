$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-JsonCommand {
  param([string[]]$Arguments, [int]$ExpectedExitCode = 0)
  $output = & powershell -NoProfile -ExecutionPolicy Bypass @Arguments 2>&1
  $code = $LASTEXITCODE
  $raw = ($output -join "`n")
  Assert-True ($code -eq $ExpectedExitCode) "Unexpected exit code $code. Output: $raw"
  return [pscustomobject]@{
    exit_code = $code
    output = $raw
    json = if ($raw) { ($raw | ConvertFrom-Json) } else { $null }
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\gemini_live_smoke_tests" (Get-Date -Format "yyyyMMdd_HHmmss")
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$bridgePath = Join-Path $PSScriptRoot "browser\gemini_bridge.mjs"
$askScript = Join-Path $PSScriptRoot "ask_gemini_web.ps1"
$closeScript = Join-Path $PSScriptRoot "close_gemini_profile_processes.ps1"
$validator = Join-Path $PSScriptRoot "validate_gemini_audit_response.ps1"
$fixtureRoot = Join-Path $PSScriptRoot "fixtures"
$nonce = "A16H_TEST_NONCE"

$bridgeSource = Get-Content -LiteralPath $bridgePath -Raw
Assert-True ($bridgeSource.Contains("GeminiAuditorChromeProfile")) "Gemini bridge must use dedicated Gemini auditor profile"
Assert-True (-not $bridgeSource.Contains("ChatGPTSupervisorChromeProfile")) "Gemini bridge must not use ChatGPT supervisor profile"
Assert-True ($bridgeSource.Contains("STOP_MANUAL_GEMINI_LOGIN_REQUIRED")) "Gemini bridge must fail safely when login is required"
Assert-True ($bridgeSource.Contains("NC_GEMINI_AUDIT")) "Gemini bridge must extract NC_GEMINI_AUDIT"
Assert-True ($bridgeSource.Contains("NC_GEMINI_AUDIT_JSON/1")) "Gemini bridge must extract JSON audit responses"
Assert-True ($bridgeSource.Contains("REQUEST_CONTAINS_FORBIDDEN_PROMPT_TOKEN")) "Gemini bridge must reject request prompt tokens"

$nodeCheck = & node --check $bridgePath 2>&1
Assert-True ($LASTEXITCODE -eq 0) "node --check failed: $($nodeCheck -join "`n")"

$profileCheck = Invoke-JsonCommand -Arguments @("-File", $closeScript, "-OutDir", (Join-Path $runDir "profile_check"))
Assert-True ([bool]$profileCheck.json.no_global_chrome_kill) "Gemini profile closer must never kill all Chrome"
Assert-True ($profileCheck.json.profile_path -match "GeminiAuditorChromeProfile") "Gemini profile closer should target Gemini profile"

$dryRun = Invoke-JsonCommand -Arguments @("-File", $askScript, "-DryRun", "-Fixture", (Join-Path $fixtureRoot "gemini_json_prompt_audit_approve.txt"), "-OutDir", (Join-Path $runDir "dry_run"))
Assert-True ($dryRun.json.status -eq "pass") "Gemini dry-run should pass"
Assert-True (-not [bool]$dryRun.json.browser_called) "Dry-run must not call browser"
Assert-True (-not [bool]$dryRun.json.codex_execution) "Dry-run must not execute Codex"
Assert-True (-not [bool]$dryRun.json.commit) "Dry-run must not commit"
Assert-True (-not [bool]$dryRun.json.push) "Dry-run must not push"

$invalid = Invoke-JsonCommand -Arguments @("-File", $validator, "-InputPath", (Join-Path $fixtureRoot "gemini_live_smoke_invalid_codex_prompt.txt"), "-Nonce", $nonce) -ExpectedExitCode 1
Assert-True (($invalid.json.violations -join "`n") -match "codex_prompt") "Validator should reject codex_prompt"

$safePacket = Get-Content -LiteralPath (Join-Path $fixtureRoot "gemini_live_smoke_safe_audit_packet.json") -Raw | ConvertFrom-Json
$unsafePacket = Get-Content -LiteralPath (Join-Path $fixtureRoot "gemini_live_smoke_unsafe_audit_packet.json") -Raw | ConvertFrom-Json
Assert-True ([bool]$safePacket.smoke_test_only -and [bool]$safePacket.no_product_mission -and [bool]$safePacket.no_codex_execution) "Safe packet should be smoke-only"
Assert-True (($unsafePacket.proposed_micro_prompt -match "git add -A") -and ($unsafePacket.proposed_micro_prompt -match "Practice") -and ($unsafePacket.proposed_micro_prompt -match "due_at")) "Unsafe packet should contain canary hazards"

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
Assert-True (-not [bool]$state.gemini_live_bridge_enabled) "Gemini live bridge must remain disabled in real loop"
Assert-True (-not [bool]$state.gemini_auditor_enabled) "Gemini auditor enforcement must remain disabled"

$docsRebuildDirty = (git -C $repoRoot status --short docs/rebuild)
$productDirty = (git -C $repoRoot status --short frontend backend plan package.json package-lock.json App.tsx)
$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
Assert-True ($docsRebuildDirty.Count -eq 0) "docs/rebuild must not be touched by tests"
Assert-True ($productDirty.Count -eq 0) "frontend/backend/plan/package/App.tsx must not be touched by tests"
Assert-True ($endBranch -eq $startBranch) "test should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "test should leave HEAD unchanged"

$summary = [ordered]@{
  status = "pass"
  report_dir = $runDir
  start_branch = $startBranch
  end_branch = $endBranch
  start_head = $startHead
  end_head = $endHead
  checks = [ordered]@{
    gemini_bridge_node_check = "PASS"
    dedicated_profile = "PASS"
    profile_closer_report_only = "PASS"
    dry_run_pass = "PASS"
    invalid_codex_prompt_rejected = "PASS"
    safe_packet_smoke_only = "PASS"
    unsafe_packet_canary = "PASS"
    no_live_gemini_call = $true
    no_live_chatgpt_call = $true
    no_product_mission = $true
    no_frontend_backend_docs_rebuild_touched = $true
  }
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "gemini_live_smoke_protocol_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10
exit 0
