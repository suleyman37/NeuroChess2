$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-PulseResponse {
  param([string]$Fixture, [string]$OutDir, [string]$BacklogPath)
  $out = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "handle_strategic_pulse_response.ps1") `
    -InputPath $Fixture `
    -Nonce "TEST_STRATEGIC_NONCE" `
    -OutDir $OutDir `
    -BacklogPath $BacklogPath 2>$null
  $code = $LASTEXITCODE
  $json = if ($out) { ($out -join "`n") | ConvertFrom-Json } else { $null }
  return [ordered]@{ exit_code = $code; result = $json }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\strategic_pulse_tests" (Get-Date -Format "yyyyMMdd_HHmmss")
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$fixtureRoot = Join-Path $PSScriptRoot "fixtures"
$backlogPath = Join-Path $runDir "strategic_backlog_test.md"
Set-Content -LiteralPath $backlogPath -Value "# Test Strategic Backlog" -Encoding UTF8

$continue = Invoke-PulseResponse -Fixture (Join-Path $fixtureRoot "strategic_pulse_valid_continue.txt") -OutDir (Join-Path $runDir "continue") -BacklogPath $backlogPath
$returnProduct = Invoke-PulseResponse -Fixture (Join-Path $fixtureRoot "strategic_pulse_valid_return_to_product.txt") -OutDir (Join-Path $runDir "return_product") -BacklogPath $backlogPath
$missingDone = Invoke-PulseResponse -Fixture (Join-Path $fixtureRoot "strategic_pulse_invalid_missing_done.txt") -OutDir (Join-Path $runDir "missing_done") -BacklogPath $backlogPath
$unknownDecision = Invoke-PulseResponse -Fixture (Join-Path $fixtureRoot "strategic_pulse_invalid_unknown_decision.txt") -OutDir (Join-Path $runDir "unknown_decision") -BacklogPath $backlogPath

$digest = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "build_strategic_digest.ps1") `
  -StatePath (Join-Path $fixtureRoot "strategic_digest_example.json") `
  -OutDir (Join-Path $runDir "digest")) | ConvertFrom-Json

$normalStatePath = Join-Path $runDir "normal_state.json"
@{ successful_missions_since_last_pulse = 3; successful_missions_since_last_deep_pulse = 3 } | ConvertTo-Json | Set-Content -LiteralPath $normalStatePath -Encoding UTF8
$deepStatePath = Join-Path $runDir "deep_state.json"
@{ successful_missions_since_last_pulse = 9; successful_missions_since_last_deep_pulse = 9 } | ConvertTo-Json | Set-Content -LiteralPath $deepStatePath -Encoding UTF8
$emergencyStatePath = Join-Path $runDir "emergency_state.json"
@{ successful_missions_since_last_pulse = 1; successful_missions_since_last_deep_pulse = 1; consecutive_failures = 2 } | ConvertTo-Json | Set-Content -LiteralPath $emergencyStatePath -Encoding UTF8

$normalDue = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check_strategic_pulse_due.ps1") -StatePath $normalStatePath -OutDir (Join-Path $runDir "normal_due")) | ConvertFrom-Json
$deepDue = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check_strategic_pulse_due.ps1") -StatePath $deepStatePath -OutDir (Join-Path $runDir "deep_due")) | ConvertFrom-Json
$emergencyDue = (& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "check_strategic_pulse_due.ps1") -StatePath $emergencyStatePath -OutDir (Join-Path $runDir "emergency_due")) | ConvertFrom-Json

$backlogText = Get-Content -LiteralPath $backlogPath -Raw
$digestText = Get-Content -LiteralPath $digest.digest_path -Raw
$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

Assert-True ($continue.exit_code -eq 0) "valid CONTINUE response should parse"
Assert-True ($continue.result.decision -eq "CONTINUE") "CONTINUE decision mismatch"
Assert-True ($returnProduct.exit_code -eq 0) "valid RETURN_TO_PRODUCT response should parse"
Assert-True ($returnProduct.result.decision -eq "RETURN_TO_PRODUCT") "RETURN_TO_PRODUCT decision mismatch"
Assert-True ($missingDone.exit_code -ne 0) "missing DONE should fail"
Assert-True (-not [bool]$missingDone.result.valid) "missing DONE result should be invalid"
Assert-True ($unknownDecision.exit_code -ne 0) "unknown decision should fail"
Assert-True (-not [bool]$unknownDecision.result.valid) "unknown decision result should be invalid"
Assert-True ($digest.status -eq "pass") "strategic digest builder should pass"
Assert-True ($digestText -match "<STRATEGIC_DIGEST>") "strategic digest block missing"
Assert-True (-not [bool]$digest.includes_full_patch) "strategic digest should not include full patch"
Assert-True ($normalDue.pulse_due -and $normalDue.pulse_type -eq "normal") "normal pulse due after 3 missions"
Assert-True ($deepDue.pulse_due -and $deepDue.pulse_type -eq "deep") "deep pulse due after 9 missions"
Assert-True ($emergencyDue.pulse_due -and $emergencyDue.pulse_type -eq "emergency") "emergency pulse should trigger on failures"
Assert-True ($backlogText -match "Genius Spark") "Genius Spark should be recorded"
Assert-True ($backlogText -match "Not auto-executed") "Genius Spark should be backlog only"
Assert-True (-not [bool]$continue.result.live_chatgpt_called) "handler must not call live ChatGPT"
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
    valid_continue_parses = $true
    valid_return_to_product_parses = $true
    invalid_missing_done_fails = $true
    invalid_unknown_decision_fails = $true
    strategic_digest_builder_passes = $true
    normal_pulse_due_after_3 = $true
    deep_pulse_due_after_9 = $true
    emergency_pulse_due = $true
    genius_spark_backlog_only = $true
    no_live_chatgpt_call = $true
  }
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "strategic_pulse_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10
exit 0
