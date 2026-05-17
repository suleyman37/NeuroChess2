$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
$runner = Join-Path $PSScriptRoot "run_rolling_loop_controller_dryrun.ps1"
$statePath = Join-Path $PSScriptRoot "state.json"

function Invoke-Runner {
  param([string]$Scenario)
  $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $runner -Scenario $Scenario 2>&1
  $code = $LASTEXITCODE
  $raw = ($output -join "`n")
  if ($code -notin @(0, 2)) {
    throw "Scenario $Scenario failed with exit code $code. Output: $raw"
  }
  return [pscustomobject]@{
    exit_code = $code
    raw = $raw
    json = ($raw | ConvertFrom-Json)
  }
}

function Assert-True {
  param([bool]$Condition, [string]$Name)
  if (-not $Condition) { throw "FAIL: $Name" }
}

function Assert-Eq {
  param($Actual, $Expected, [string]$Name)
  if ($Actual -ne $Expected) { throw "FAIL: $Name expected=[$Expected] actual=[$Actual]" }
}

function Test-JsonPath {
  param([string]$Path)
  Assert-True (Test-Path -LiteralPath $Path) "report exists: $Path"
  Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json | Out-Null
}

try {
  $startStatus = git -C $repoRoot status --short docs/rebuild frontend backend plan package.json package-lock.json App.tsx

  $success = Invoke-Runner -Scenario "success_sequence"
  Assert-Eq $success.json.final_verdict "PASS_ROLLING_LOOP_DRY_RUN" "successful sequence verdict"
  Assert-True ($success.json.missions_processed -eq 3) "successful sequence processed all missions"
  Assert-True (@($success.json.missions_accepted).Count -eq 3) "successful sequence accepted three missions"
  Assert-True (@($success.json.phase_transitions | Where-Object { $_.current_phase -eq "EXPANSION" -and $_.next_phase -eq "CONSOLIDATION" }).Count -eq 1) "expansion to consolidation"
  Assert-True (@($success.json.phase_transitions | Where-Object { $_.current_phase -eq "CONSOLIDATION" -and $_.next_phase -eq "DRAIN" }).Count -eq 1) "consolidation to drain"
  Test-JsonPath ([string]$success.json.report_path)

  $phase = Invoke-Runner -Scenario "phase_transition"
  Assert-Eq $phase.json.final_verdict "PASS_ROLLING_LOOP_DRY_RUN" "phase transition scenario verdict"
  Assert-True (@($phase.json.phase_transitions).Count -ge 2) "phase transition scenario produced transitions"

  $repeat = Invoke-Runner -Scenario "repeat_hash_stop"
  Assert-Eq $repeat.json.final_verdict "FAIL_REPEAT_MISSION_HASH" "repeat hash verdict"
  Assert-True ($repeat.json.missions_processed -eq 1) "repeat hash stops before later mission"
  Assert-True (@($repeat.json.missions_rejected | Where-Object { $_.repeat_decision -eq "STOP_REPEAT_MISSION_HASH" }).Count -eq 1) "repeat hash stop recorded"
  Test-JsonPath ([string]$repeat.json.report_path)

  $noProgress = Invoke-Runner -Scenario "no_progress_stop"
  Assert-Eq $noProgress.json.final_verdict "FAIL_NO_FORWARD_PROGRESS" "no progress verdict"
  Assert-True (@($noProgress.json.missions_accepted | Where-Object { $_.forward_progress_decision -eq "WARN_NO_PROGRESS" }).Count -eq 1) "first no progress warns"
  Assert-True (@($noProgress.json.missions_accepted | Where-Object { $_.forward_progress_decision -eq "STOP_NO_FORWARD_PROGRESS" }).Count -eq 1) "second no progress stops"

  $red = Invoke-Runner -Scenario "red_tier_reject"
  Assert-Eq $red.json.final_verdict "QUARANTINE_REQUIRED" "red-tier rejection verdict"
  Assert-True (@($red.json.missions_rejected).Count -eq 1) "red-tier rejected before execution"

  $rollover = Invoke-Runner -Scenario "rollover_due"
  Assert-Eq $rollover.json.final_verdict "ROLLOVER_REQUIRED" "rollover verdict"
  Assert-True ($rollover.json.product_mission_executed -eq $false) "rollover did not execute product mission"

  $lowProduct = Invoke-Runner -Scenario "low_product_value"
  Assert-Eq $lowProduct.json.final_verdict "STOP_LOW_PRODUCT_VALUE" "low product value verdict"
  Assert-True (@($lowProduct.json.missions_rejected | Where-Object { $_.product_gate -in @("WARN", "STRATEGIC_PULSE_REQUIRED", "FAIL") }).Count -eq 1) "low product value gate recorded"

  foreach ($report in @($success, $repeat, $noProgress, $red, $rollover, $lowProduct)) {
    Assert-True ($report.json.live_chatgpt_called -eq $false) "no live ChatGPT call"
    Assert-True ($report.json.live_gemini_called -eq $false) "no live Gemini call"
    Assert-True ($report.json.product_mission_executed -eq $false) "no product mission executed"
  }

  $scriptTexts = @(
    (Get-Content -LiteralPath $runner -Raw),
    (Get-Content -LiteralPath (Join-Path $PSScriptRoot "build_rolling_loop_report.ps1") -Raw),
    (Get-Content -LiteralPath $PSCommandPath -Raw)
  ) -join "`n"
  $badPatterns = @(
    ("git\s+add\s+" + "-A"),
    ("git\s+reset\s+" + "--hard"),
    ("git\s+clean" + "\b"),
    ("push\s+" + "--force")
  )
  foreach ($pattern in $badPatterns) {
    Assert-True (-not ($scriptTexts -match $pattern)) "no destructive command pattern in A18 scripts: $pattern"
  }

  Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json | Out-Null
  $endStatus = git -C $repoRoot status --short docs/rebuild frontend backend plan package.json package-lock.json App.tsx
  Assert-Eq (($startStatus -join "`n").Trim()) (($endStatus -join "`n").Trim()) "forbidden path status unchanged"

  [ordered]@{
    status = "pass"
    checks = [ordered]@{
      successful_sequence = $success.json.final_verdict
      phase_transition = $phase.json.final_verdict
      repeat_hash_stop = $repeat.json.final_verdict
      no_progress_stop = $noProgress.json.final_verdict
      red_tier_rejection = $red.json.final_verdict
      rollover_due = $rollover.json.final_verdict
      low_product_value = $lowProduct.json.final_verdict
      destructive_command_check = "PASS"
      state_json_parse = "PASS"
      no_live_chatgpt_call = $true
      no_live_gemini_call = $true
      no_product_mission = $true
      no_frontend_backend_docs_rebuild_touched = $true
    }
    sample_report_path = $success.json.report_path
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
  } | ConvertTo-Json -Depth 20
  exit 0
} catch {
  [ordered]@{
    status = "fail"
    error = $_.Exception.Message
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
