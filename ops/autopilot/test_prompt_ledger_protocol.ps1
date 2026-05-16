$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-JsonCommand {
  param([string[]]$Arguments)
  $output = & powershell -NoProfile -ExecutionPolicy Bypass @Arguments 2>&1
  $code = $LASTEXITCODE
  $raw = ($output -join "`n")
  return [pscustomobject]@{
    exit_code = $code
    output = $raw
    json = if ($raw) { ($raw | ConvertFrom-Json) } else { $null }
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\prompt_ledger_tests" (Get-Date -Format "yyyyMMdd_HHmmss")
$fixtureRoot = Join-Path $PSScriptRoot "fixtures"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$scoreScript = Join-Path $PSScriptRoot "score_prompt_execution.ps1"
$recordScript = Join-Path $PSScriptRoot "record_prompt_ledger_entry.ps1"
$analyzeScript = Join-Path $PSScriptRoot "analyze_prompt_ledger.ps1"
$ledgerPath = Join-Path $runDir "prompt_ledger.jsonl"

$cleanScore = Invoke-JsonCommand -Arguments @("-File", $scoreScript, "-InputPath", (Join-Path $fixtureRoot "prompt_ledger_success_clean.json"))
$repairScore = Invoke-JsonCommand -Arguments @("-File", $scoreScript, "-InputPath", (Join-Path $fixtureRoot "prompt_ledger_repair_needed.json"))
$mismatchScore = Invoke-JsonCommand -Arguments @("-File", $scoreScript, "-InputPath", (Join-Path $fixtureRoot "prompt_ledger_contract_mismatch.json"))
$lowProductScore = Invoke-JsonCommand -Arguments @("-File", $scoreScript, "-InputPath", (Join-Path $fixtureRoot "prompt_ledger_low_product_value.json"))
$requestMoreScore = Invoke-JsonCommand -Arguments @("-File", $scoreScript, "-InputPath", (Join-Path $fixtureRoot "prompt_ledger_request_more_used.json"))
$redTierScore = Invoke-JsonCommand -Arguments @("-File", $scoreScript, "-InputPath", (Join-Path $fixtureRoot "prompt_ledger_red_tier_rejected.json"))

$appendResults = @()
foreach ($fixture in @(
  "prompt_ledger_success_clean.json",
  "prompt_ledger_repair_needed.json",
  "prompt_ledger_contract_mismatch.json",
  "prompt_ledger_low_product_value.json",
  "prompt_ledger_request_more_used.json",
  "prompt_ledger_red_tier_rejected.json"
)) {
  $appendResults += Invoke-JsonCommand -Arguments @("-File", $recordScript, "-InputPath", (Join-Path $fixtureRoot $fixture), "-LedgerPath", $ledgerPath)
}

$analysis = Invoke-JsonCommand -Arguments @("-File", $analyzeScript, "-LedgerPath", $ledgerPath, "-OutDir", (Join-Path $runDir "analysis"))
$ledgerLines = @((Get-Content -LiteralPath $ledgerPath) | Where-Object { $_.Trim() })
$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
$docsRebuildDirty = (git -C $repoRoot status --short docs/rebuild)
$productDirty = (git -C $repoRoot status --short frontend backend plan package.json package-lock.json App.tsx)
$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

Assert-True ($cleanScore.exit_code -eq 0 -and [int]$cleanScore.json.prompt_execution_score -ge 90) "clean success entry should score high"
Assert-True (($repairScore.json.penalties -join "`n") -match "prompt required repair") "repair-needed entry should receive repair penalty"
Assert-True ([int]$repairScore.json.prompt_execution_score -lt [int]$cleanScore.json.prompt_execution_score) "repair-needed score should be below clean score"
Assert-True (($mismatchScore.json.penalties -join "`n") -match "Mission Contract mismatch") "contract mismatch should receive major penalty"
Assert-True (($lowProductScore.json.penalties -join "`n") -match "product value missing") "low product value should receive product penalty"
Assert-True (-not (($requestMoreScore.json.penalties -join "`n") -match "REQUEST_MORE")) "REQUEST_MORE should not be penalized unless unnecessary"
Assert-True (($redTierScore.json.penalties -join "`n") -match "red-tier outside quarantine") "red-tier rejected entry should score with red-tier penalty"
Assert-True ([bool]$redTierScore.json.self_rated_quality_score_ignored) "score must ignore self-rated quality_score"
Assert-True (@($appendResults | Where-Object { $_.exit_code -eq 0 -and [bool]$_.json.append_only }).Count -eq 6 -and $ledgerLines.Count -eq 6) "ledger append should preserve existing entries"
Assert-True ($analysis.exit_code -eq 0 -and [int]$analysis.json.total_prompts -eq 6) "analyzer should summarize ledger"
Assert-True (($analysis.json.most_common_failure_codes | ConvertTo-Json -Compress -Depth 10) -match "STOP_CONTRACT_MISMATCH") "analyzer should summarize failure codes"
Assert-True ([int]$analysis.json.prompts_requiring_repair -ge 1) "analyzer should count repair prompts"
Assert-True ([int]$analysis.json.prompts_causing_contract_mismatch -ge 1) "analyzer should count contract mismatch prompts"
Assert-True ([int]$analysis.json.prompts_with_low_product_value -ge 1) "analyzer should count low product value prompts"
Assert-True (Test-Path -LiteralPath ([string]$analysis.json.markdown_summary_path)) "analyzer should write markdown summary"
Assert-True (-not [bool]$state.prompt_ledger_enabled) "Prompt Ledger live enforcement must remain disabled"
Assert-True ([bool]$state.prompt_execution_score_available) "Prompt Execution Score should be available"
Assert-True ([bool]$state.prompt_failure_taxonomy_available) "Prompt Failure Taxonomy should be available"
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
    clean_success_scores_high = "PASS"
    repair_penalty = "PASS"
    contract_mismatch_penalty = "PASS"
    low_product_value_penalty = "PASS"
    request_more_policy = "PASS"
    red_tier_recorded = "PASS"
    append_only = "PASS"
    analyzer_failure_codes = "PASS"
    self_quality_score_ignored = "PASS"
    no_live_chatgpt_call = $true
    no_product_mission = $true
    no_frontend_backend_docs_rebuild_touched = $true
  }
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "prompt_ledger_protocol_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10
exit 0
