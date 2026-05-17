param(
  [string]$RuntimeDir = "",
  [string]$ReportRoot = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\control_plane_dry_runs",
  [string]$PhaseSequencePath = "",
  [string]$SessionId = ""
)

$ErrorActionPreference = "Stop"

function Invoke-JsonCommand {
  param(
    [string]$ScriptPath,
    [string[]]$Arguments = @(),
    [int[]]$AcceptExitCodes = @(0)
  )
  $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @Arguments 2>&1
  $code = $LASTEXITCODE
  $raw = ($output -join "`n")
  if ($AcceptExitCodes -notcontains $code) {
    throw "Command failed ($code): $ScriptPath $($Arguments -join ' ')`n$raw"
  }
  return [pscustomobject]@{
    exit_code = $code
    raw = $raw
    json = if ($raw.Trim()) { ($raw | ConvertFrom-Json) } else { $null }
  }
}

function Write-JsonTemp {
  param([string]$Directory, [string]$Name, $Object)
  New-Item -ItemType Directory -Force -Path $Directory | Out-Null
  $path = Join-Path $Directory $Name
  $Object | ConvertTo-Json -Depth 60 | Set-Content -LiteralPath $path -Encoding UTF8
  return $path
}

function Write-TextTemp {
  param([string]$Directory, [string]$Name, [string]$Text)
  New-Item -ItemType Directory -Force -Path $Directory | Out-Null
  $path = Join-Path $Directory $Name
  Set-Content -LiteralPath $path -Value $Text -Encoding UTF8
  return $path
}

function Has-Property {
  param($Object, [string]$Name)
  return ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name)
}

function Get-Field {
  param($Object, [string]$Name, $Default = $null)
  if (Has-Property $Object $Name) { return $Object.$Name }
  return $Default
}

function Process-ControlPlaneEvent {
  param(
    [string]$Runtime,
    [string]$EventType,
    [string]$Session,
    [int]$Sequence,
    [string]$MissionId,
    [string]$Reason
  )
  $eventArgs = @(
    "-Action", "WriteEventAtomic",
    "-RuntimeDir", $Runtime,
    "-EventType", $EventType,
    "-SessionId", $Session,
    "-Sequence", ([string]$Sequence)
  )
  if ($MissionId) { $eventArgs += @("-MissionId", $MissionId) }
  if ($Reason) { $eventArgs += @("-Reason", $Reason) }
  $write = Invoke-JsonCommand -ScriptPath $eventsScript -Arguments $eventArgs
  $processing = Invoke-JsonCommand -ScriptPath $eventsScript -Arguments @(
    "-Action", "MoveEventToProcessing",
    "-RuntimeDir", $Runtime,
    "-EventPath", ([string]$write.json.event_path)
  )
  $processed = Invoke-JsonCommand -ScriptPath $eventsScript -Arguments @(
    "-Action", "MarkEventProcessed",
    "-RuntimeDir", $Runtime,
    "-EventPath", ([string]$processing.json.event_path)
  )
  return [ordered]@{
    event_type = $EventType
    sequence = $Sequence
    status = $processed.json.status
    event_path = $processed.json.event_path
    mission_log_path = $processed.json.mission_log_path
  }
}

function New-PromptLedgerEntry {
  param($Mission, [string]$Session, [string]$MissionHash, [string]$Status, [string]$ContractResult, [bool]$ChecksPassed)
  return [ordered]@{
    schema_version = "A16F_prompt_ledger_entry_v1"
    prompt_id = "prompt_$($Mission.mission_id)"
    mission_id = [string]$Mission.mission_id
    session_id = $Session
    created_at = [DateTimeOffset]::UtcNow.ToString("o")
    prompt_source = "A17_control_plane_fixture"
    prompt_format = "NC-MP/2"
    prompt_hash = $MissionHash
    risk_tier = [string]$Mission.risk_tier
    work_type = [string]$Mission.work_type
    goal = [string]$Mission.goal
    allowed_paths = @($Mission.allowed_paths)
    expected_changed_files = @($Mission.expected_changed_files)
    max_files = [int]$Mission.max_files
    max_diff_lines = [int]$Mission.max_diff_lines
    prompt_firewall_result = "PASS"
    mission_contract_result = $ContractResult
    execution_status = $Status
    stop_reason = if ($Status -eq "rejected") { "deterministic gate stopped execution" } else { "" }
    checks_required = @($Mission.required_checks)
    checks_run = @($Mission.required_checks)
    checks_passed = $ChecksPassed
    prompt_execution_score = [ordered]@{ total = if ($ChecksPassed) { 10 } else { 0 }; control_plane_dry_run = $true }
    lessons = @("A17 fixture lifecycle only; no live execution.")
  }
}

function New-ProgressLedgerEntry {
  param($Mission, [string]$Session, [string]$MissionHash, [bool]$Progress, [string]$Status)
  $now = [DateTimeOffset]::UtcNow.ToString("o")
  return [ordered]@{
    schema_version = "A16B_progress_ledger_entry_v1"
    session_id = $Session
    mission_id = [string]$Mission.mission_id
    mission_hash = $MissionHash
    started_at = $now
    ended_at = $now
    status = $Status
    forward_progress = $Progress
  }
}

function Get-SelectedSkillNames {
  param($Selection)
  return @($Selection.selected_skills | ForEach-Object { [string]$_ })
}

try {
  $repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
  $fixtureRoot = Join-Path $PSScriptRoot "fixtures"
  if (-not $PhaseSequencePath) { $PhaseSequencePath = Join-Path $fixtureRoot "control_plane_dryrun_phase_sequence.json" }
  if (-not (Test-Path -LiteralPath $PhaseSequencePath)) { throw "Phase sequence fixture not found: $PhaseSequencePath" }
  if (-not $RuntimeDir) { $RuntimeDir = Join-Path ([System.IO.Path]::GetTempPath()) ("neurochess_control_plane_dryrun_" + [guid]::NewGuid().ToString("N")) }
  if (-not $SessionId) { $SessionId = "A17_DRYRUN_$([guid]::NewGuid().ToString('N').Substring(0, 12))" }
  $runDir = Join-Path $ReportRoot ("A17_control_plane_dryrun_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
  $tempDir = Join-Path $RuntimeDir "inputs"
  New-Item -ItemType Directory -Force -Path $runDir | Out-Null
  New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

  $lockScript = Join-Path $PSScriptRoot "control_plane_lock.ps1"
  $stateScript = Join-Path $PSScriptRoot "control_plane_state.ps1"
  $eventsScript = Join-Path $PSScriptRoot "control_plane_events.ps1"
  $selectSkillsScript = Join-Path $PSScriptRoot "select_internal_skills.ps1"
  $validateSkillsScript = Join-Path $PSScriptRoot "validate_internal_skill_selection.ps1"
  $parseNcMp2Script = Join-Path $PSScriptRoot "parse_nc_mp2.ps1"
  $lintNcMp2Script = Join-Path $PSScriptRoot "lint_nc_mp2.ps1"
  $validateContractScript = Join-Path $PSScriptRoot "validate_mission_contract.ps1"
  $compareShadowScript = Join-Path $PSScriptRoot "compare_shadow_plan_to_contract.ps1"
  $computeHashScript = Join-Path $PSScriptRoot "compute_mission_hash.ps1"
  $repeatScript = Join-Path $PSScriptRoot "check_mission_repeat.ps1"
  $productImpactScript = Join-Path $PSScriptRoot "evaluate_product_impact.ps1"
  $goldilocksScript = Join-Path $PSScriptRoot "check_goldilocks_mission_scope.ps1"
  $e2eScript = Join-Path $PSScriptRoot "score_e2e_deliverable.ps1"
  $forwardProgressScript = Join-Path $PSScriptRoot "check_forward_progress.ps1"
  $progressLedgerScript = Join-Path $PSScriptRoot "update_progress_ledger.ps1"
  $promptLedgerScript = Join-Path $PSScriptRoot "record_prompt_ledger_entry.ps1"
  $phaseScript = Join-Path $PSScriptRoot "evaluate_night_mode_phase.ps1"

  $sequence = Get-Content -LiteralPath $PhaseSequencePath -Raw | ConvertFrom-Json
  $eventSequence = 1
  $events = [System.Collections.Generic.List[object]]::new()
  $missions = [System.Collections.Generic.List[object]]::new()
  $hashHistory = [System.Collections.Generic.List[string]]::new()
  $phaseTransitions = [System.Collections.Generic.List[object]]::new()
  $integrated = [ordered]@{
    session_created = $false
    state_atomic = $false
    events = $false
    skill_selection = $false
    nc_mp2_lint = $false
    mission_contract = $false
    shadow_plan = $false
    product_gate = $false
    mission_hash = $false
    repeat_check = $false
    goldilocks = $false
    e2e_score = $false
    forward_progress = $false
    progress_ledger = $false
    prompt_ledger = $false
    phase_transitions = $false
  }

  $lock = Invoke-JsonCommand -ScriptPath $lockScript -Arguments @("-Action", "AcquireLock", "-RuntimeDir", $RuntimeDir, "-Owner", $SessionId)
  $stateNew = Invoke-JsonCommand -ScriptPath $stateScript -Arguments @("-Action", "NewSession", "-RuntimeDir", $RuntimeDir, "-SessionId", $SessionId, "-MaxSteps", "8", "-MaxHours", "2")
  $stateRead = Invoke-JsonCommand -ScriptPath $stateScript -Arguments @("-Action", "ReadState", "-RuntimeDir", $RuntimeDir)
  $integrated.session_created = ($stateNew.json.status -eq "created")
  $integrated.state_atomic = ($stateRead.json.status -eq "read" -and $stateRead.json.state.session_id -eq $SessionId)
  $missionLogPath = Join-Path $RuntimeDir "logs\mission_log.jsonl"
  if (-not (Test-Path -LiteralPath $missionLogPath)) { Set-Content -LiteralPath $missionLogPath -Value "" -Encoding UTF8 }

  $events.Add((Process-ControlPlaneEvent -Runtime $RuntimeDir -EventType "SESSION_STARTED" -Session $SessionId -Sequence $eventSequence -MissionId "" -Reason "A17 dry-run session started")) | Out-Null
  $eventSequence += 1
  $integrated.events = $true

  foreach ($fixtureName in @($sequence.missions)) {
    $fixturePath = Join-Path $fixtureRoot ([string]$fixtureName)
    $fixture = Get-Content -LiteralPath $fixturePath -Raw | ConvertFrom-Json
    $mission = $fixture.mission
    $missionId = [string]$mission.mission_id
    $missionDir = Join-Path $runDir $missionId
    New-Item -ItemType Directory -Force -Path $missionDir | Out-Null

    $events.Add((Process-ControlPlaneEvent -Runtime $RuntimeDir -EventType "MISSION_PROPOSED" -Session $SessionId -Sequence $eventSequence -MissionId $missionId -Reason "Synthetic mission proposed")) | Out-Null
    $eventSequence += 1

    $missionPath = Write-JsonTemp -Directory $tempDir -Name "$missionId.mission.json" -Object $mission
    $selection = Invoke-JsonCommand -ScriptPath $selectSkillsScript -Arguments @("-InputPath", $missionPath)
    $selectionPath = Write-JsonTemp -Directory $tempDir -Name "$missionId.selection.json" -Object $selection.json
    $skillValidation = Invoke-JsonCommand -ScriptPath $validateSkillsScript -Arguments @("-InputPath", $selectionPath) -AcceptExitCodes @(0, 1)
    $integrated.skill_selection = $true

    if ($fixture.PSObject.Properties.Name -contains "expected_decision") {
      $events.Add((Process-ControlPlaneEvent -Runtime $RuntimeDir -EventType "QUARANTINE_REQUIRED" -Session $SessionId -Sequence $eventSequence -MissionId $missionId -Reason "Synthetic red-tier rejection")) | Out-Null
      $eventSequence += 1
      $missions.Add([ordered]@{
        mission_id = $missionId
        status = "rejected"
        selected_skills = @(Get-SelectedSkillNames $selection.json)
        skill_selection_result = $selection.json.selection_result
        deterministic_decision = "STOP_DETERMINISTIC_GATE"
        quarantine_required = $true
        product_mission_executed = $false
      }) | Out-Null
      continue
    }

    $ncPath = Write-TextTemp -Directory $tempDir -Name "$missionId.nc-mp2.txt" -Text ([string]$fixture.nc_mp2_text)
    $parse = Invoke-JsonCommand -ScriptPath $parseNcMp2Script -Arguments @("-InputPath", $ncPath)
    $lint = Invoke-JsonCommand -ScriptPath $lintNcMp2Script -Arguments @("-InputPath", $ncPath)
    $integrated.nc_mp2_lint = $true

    $contractPath = Write-JsonTemp -Directory $tempDir -Name "$missionId.contract.json" -Object $fixture.mission_contract
    $contractValidation = Invoke-JsonCommand -ScriptPath $validateContractScript -Arguments @("-ContractPath", $contractPath, "-ReportDir", (Join-Path $missionDir "mission_contract"))
    $integrated.mission_contract = $true

    $shadowPath = Write-JsonTemp -Directory $tempDir -Name "$missionId.shadow_plan.json" -Object $fixture.shadow_plan
    $shadowComparison = Invoke-JsonCommand -ScriptPath $compareShadowScript -Arguments @("-ShadowPlanPath", $shadowPath, "-ContractPath", $contractPath, "-ReportDir", (Join-Path $missionDir "shadow_plan"))
    $integrated.shadow_plan = $true

    $productPath = Write-JsonTemp -Directory $tempDir -Name "$missionId.product_impact.json" -Object $fixture.product_impact
    $productGate = Invoke-JsonCommand -ScriptPath $productImpactScript -Arguments @("-InputPath", $productPath) -AcceptExitCodes @(0, 2)
    $integrated.product_gate = $true

    $hash = Invoke-JsonCommand -ScriptPath $computeHashScript -Arguments @("-InputPath", $missionPath)
    $integrated.mission_hash = $true
    $hashHistoryPath = Write-JsonTemp -Directory $tempDir -Name "$missionId.hash_history.json" -Object ([ordered]@{ mission_hashes_seen = @($hashHistory) })
    $repeat = Invoke-JsonCommand -ScriptPath $repeatScript -Arguments @("-InputPath", $missionPath, "-HashListPath", $hashHistoryPath, "-MaxSameMissionHashRepeats", "1") -AcceptExitCodes @(0, 2)
    $integrated.repeat_check = $true
    if ($repeat.json.decision -eq "CONTINUE") { $hashHistory.Add([string]$hash.json.mission_hash) | Out-Null }

    $goldilocksPath = Write-JsonTemp -Directory $tempDir -Name "$missionId.goldilocks.json" -Object $fixture.goldilocks
    $goldilocks = Invoke-JsonCommand -ScriptPath $goldilocksScript -Arguments @("-InputPath", $goldilocksPath)
    $integrated.goldilocks = $true

    $fixture.e2e_result.external_evidence_pack_path = $missionDir
    $e2ePath = Write-JsonTemp -Directory $tempDir -Name "$missionId.e2e.json" -Object $fixture.e2e_result
    $e2e = Invoke-JsonCommand -ScriptPath $e2eScript -Arguments @("-InputPath", $e2ePath)
    $integrated.e2e_score = $true

    $progressInput = [ordered]@{
      mission_id = $missionId
      files_changed_count = 1
      branch = if ($mission.work_type -match "backend|frontend") { "autopilot/$missionId" } else { "road-to-V2" }
      commit_sha = if ($e2e.json.score_result -eq "E2E_DELIVERABLE_PASS") { "simulated-$missionId" } else { "" }
      evidence_pack_path = $missionDir
      external_report_path = Join-Path $missionDir "mission_report.json"
      tests_run = @($mission.required_checks)
      contract_result = $shadowComparison.json.comparison_result
      stop_reason = ""
      same_mission_hash_repeated = [bool]$repeat.json.repeat_detected
    }
    $progressPath = Write-JsonTemp -Directory $tempDir -Name "$missionId.forward_progress.json" -Object $progressInput
    $forward = Invoke-JsonCommand -ScriptPath $forwardProgressScript -Arguments @("-InputPath", $progressPath, "-LedgerPath", (Join-Path $RuntimeDir "progress_ledger.jsonl")) -AcceptExitCodes @(0, 2)
    $integrated.forward_progress = $true

    $progressEntry = New-ProgressLedgerEntry -Mission $mission -Session $SessionId -MissionHash ([string]$hash.json.mission_hash) -Progress ([bool]$forward.json.forward_progress) -Status "succeeded"
    $progressEntryPath = Write-JsonTemp -Directory $tempDir -Name "$missionId.progress_entry.json" -Object $progressEntry
    $progressLedger = Invoke-JsonCommand -ScriptPath $progressLedgerScript -Arguments @("-InputPath", $progressEntryPath, "-LedgerPath", (Join-Path $RuntimeDir "progress_ledger.jsonl"))
    $integrated.progress_ledger = $true

    $promptEntry = New-PromptLedgerEntry -Mission $mission -Session $SessionId -MissionHash ([string]$hash.json.mission_hash) -Status "dry_run_success" -ContractResult ([string]$shadowComparison.json.comparison_result) -ChecksPassed $true
    $promptEntryPath = Write-JsonTemp -Directory $tempDir -Name "$missionId.prompt_entry.json" -Object $promptEntry
    $promptLedger = Invoke-JsonCommand -ScriptPath $promptLedgerScript -Arguments @("-InputPath", $promptEntryPath, "-LedgerPath", (Join-Path $RuntimeDir "prompt_ledger.jsonl"))
    $integrated.prompt_ledger = $true

    $missionReport = [ordered]@{
      mission_id = $missionId
      selected_skills = @(Get-SelectedSkillNames $selection.json)
      skill_selection_result = $selection.json.selection_result
      skill_validation_valid = [bool]$skillValidation.json.valid
      nc_mp2_parse = $parse.json.valid_parse
      nc_mp2_lint = $lint.json.lint_result
      mission_contract = $contractValidation.json.validation_result
      shadow_plan = $shadowComparison.json.comparison_result
      product_gate = $productGate.json.product_gate_result
      mission_hash = $hash.json.mission_hash
      repeat_decision = $repeat.json.decision
      goldilocks = $goldilocks.json.verdict
      e2e_score = $e2e.json.score_result
      forward_progress = $forward.json.forward_progress
      progress_ledger = $progressLedger.json.status
      prompt_ledger = $promptLedger.json.status
      product_mission_executed = $false
    }
    $missionReport | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath (Join-Path $missionDir "mission_report.json") -Encoding UTF8
    $missions.Add($missionReport) | Out-Null

    $stateForWrite = (Invoke-JsonCommand -ScriptPath $stateScript -Arguments @("-Action", "ReadState", "-RuntimeDir", $RuntimeDir)).json.state
    $stateForWrite.current_step = @($missions).Count
    $stateForWrite.current_mission_id = $missionId
    $stateForWrite.current_mission_hash = [string]$hash.json.mission_hash
    $stateForWrite.mission_hashes_seen = @($hashHistory)
    $stateForWrite.recommended_next_action = "continue_dry_run"
    $stateForWrite | Add-Member -Force -NotePropertyName "current_phase" -NotePropertyValue "EXPANSION"
    $stateForWrite.last_state_update = [DateTimeOffset]::UtcNow.ToString("o")
    $stateWritePath = Write-JsonTemp -Directory $tempDir -Name "$missionId.state_update.json" -Object $stateForWrite
    Invoke-JsonCommand -ScriptPath $stateScript -Arguments @("-Action", "WriteStateAtomic", "-RuntimeDir", $RuntimeDir, "-InputPath", $stateWritePath) | Out-Null

    $events.Add((Process-ControlPlaneEvent -Runtime $RuntimeDir -EventType "MISSION_COMPLETED" -Session $SessionId -Sequence $eventSequence -MissionId $missionId -Reason "Synthetic mission completed")) | Out-Null
    $eventSequence += 1
  }

  $e2ePassCount = @($missions | Where-Object { $_.e2e_score -eq "E2E_DELIVERABLE_PASS" }).Count
  $phaseInput1 = [ordered]@{
    phase_state = [ordered]@{ current_phase = "EXPANSION"; e2e_deliverables_count = ($e2ePassCount - 1); required_e2e_deliverables = 2; expansion_mission_count = 3; max_missions_expansion = 5 }
    latest_mission_result = [ordered]@{ e2e_deliverable_created = $true }
  }
  $phase1Path = Write-JsonTemp -Directory $tempDir -Name "phase_expansion.json" -Object $phaseInput1
  $phase1 = Invoke-JsonCommand -ScriptPath $phaseScript -Arguments @("-InputPath", $phase1Path)
  $phaseTransitions.Add($phase1.json) | Out-Null

  $phaseInput2 = [ordered]@{
    phase_state = [ordered]@{ current_phase = "CONSOLIDATION"; e2e_deliverables_count = $e2ePassCount; required_e2e_deliverables = 2; consecutive_low_value_consolidation_missions = 1 }
    latest_mission_result = [ordered]@{ zero_e2e_gain = $true }
  }
  $phase2Path = Write-JsonTemp -Directory $tempDir -Name "phase_consolidation.json" -Object $phaseInput2
  $phase2 = Invoke-JsonCommand -ScriptPath $phaseScript -Arguments @("-InputPath", $phase2Path)
  $phaseTransitions.Add($phase2.json) | Out-Null

  $phaseInput3 = [ordered]@{
    phase_state = [ordered]@{ current_phase = "DRAIN"; e2e_deliverables_count = $e2ePassCount; required_e2e_deliverables = 2; morning_report_complete = $true; quotas_met_early = $true }
    latest_mission_result = [ordered]@{}
  }
  $phase3Path = Write-JsonTemp -Directory $tempDir -Name "phase_drain.json" -Object $phaseInput3
  $phase3 = Invoke-JsonCommand -ScriptPath $phaseScript -Arguments @("-InputPath", $phase3Path)
  $phaseTransitions.Add($phase3.json) | Out-Null
  $integrated.phase_transitions = $true

  $repeatFixture = Join-Path $fixtureRoot "control_plane_dryrun_repeat_hash.json"
  $repeatHistoryPath = Write-JsonTemp -Directory $tempDir -Name "repeat_hash_history.json" -Object ([ordered]@{ mission_hashes_seen = @($hashHistory) })
  $repeatDrill = Invoke-JsonCommand -ScriptPath $repeatScript -Arguments @("-InputPath", $repeatFixture, "-HashListPath", $repeatHistoryPath, "-MaxSameMissionHashRepeats", "1") -AcceptExitCodes @(0, 2)

  $lowProgressFixture = Join-Path $fixtureRoot "control_plane_dryrun_low_progress.json"
  $lowLedger = Join-Path $RuntimeDir "low_progress_ledger.jsonl"
  @(
    '{"forward_progress":false}',
    '{"forward_progress":false}'
  ) | Set-Content -LiteralPath $lowLedger -Encoding UTF8
  $lowProgress = Invoke-JsonCommand -ScriptPath $forwardProgressScript -Arguments @("-InputPath", $lowProgressFixture, "-LedgerPath", $lowLedger) -AcceptExitCodes @(0, 2)

  $finalPhase = [string]$phase3.json.next_phase
  $finalVerdict = if ($phase3.json.verdict -eq "PASS_EARLY_EXCELLENCE") { "PASS_EARLY_EXCELLENCE_DRY_RUN" } elseif ($e2ePassCount -lt 1) { "FAIL_NO_E2E_DELIVERABLE" } else { "PASS_CONTROL_PLANE_DRY_RUN" }
  if ($repeatDrill.json.decision -ne "STOP_REPEAT_MISSION_HASH") { $finalVerdict = "FAIL_REPEAT_MISSION_HASH" }
  if ($lowProgress.json.decision -ne "STOP_NO_FORWARD_PROGRESS") { $finalVerdict = "FAIL_NO_FORWARD_PROGRESS" }
  if (@($integrated.GetEnumerator() | Where-Object { -not [bool]$_.Value }).Count -gt 0) { $finalVerdict = "FAIL_CONTROL_PLANE_INTEGRATION" }

  $events.Add((Process-ControlPlaneEvent -Runtime $RuntimeDir -EventType "SESSION_DRAINED" -Session $SessionId -Sequence $eventSequence -MissionId "" -Reason "A17 dry-run drained")) | Out-Null
  $eventSequence += 1

  $stateFinal = Invoke-JsonCommand -ScriptPath $stateScript -Arguments @("-Action", "ReadState", "-RuntimeDir", $RuntimeDir)
  $lockRelease = Invoke-JsonCommand -ScriptPath $lockScript -Arguments @("-Action", "ReleaseLock", "-RuntimeDir", $RuntimeDir, "-Owner", $SessionId) -AcceptExitCodes @(0)

  $report = [ordered]@{
    schema_version = "A17_control_plane_integration_dryrun_v1"
    session_id = $SessionId
    runtime_dir = $RuntimeDir
    report_dir = $runDir
    initial_phase = [string]$sequence.initial_phase
    final_phase = $finalPhase
    final_verdict = $finalVerdict
    lock_acquired = [bool]$lock.json.acquired
    lock_released = [bool]$lockRelease.json.released
    mission_log_path = $missionLogPath
    simulated_missions = @($missions)
    events = @($events)
    component_integration = $integrated
    safety_drills = [ordered]@{
      repeat_hash = $repeatDrill.json
      low_progress = $lowProgress.json
      gemini_decision_fixture_result = $null
    }
    phase_transitions = @($phaseTransitions)
    final_state_status = $stateFinal.json.status
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  }
  $jsonReportPath = Join-Path $runDir "control_plane_integration_dryrun_report.json"
  $mdReportPath = Join-Path $runDir "control_plane_integration_dryrun_report.md"
  $report["report_path"] = $jsonReportPath
  $report["markdown_report_path"] = $mdReportPath
  $report | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $jsonReportPath -Encoding UTF8
  @(
    "# Control Plane Integration Dry Run Report",
    "",
    "Session: $SessionId",
    "Initial phase: $($sequence.initial_phase)",
    "Final phase: $finalPhase",
    "Final verdict: $finalVerdict",
    "Live ChatGPT called: no",
    "Live Gemini called: no",
    "Product mission executed: no",
    "",
    "JSON report: $jsonReportPath"
  ) | Set-Content -LiteralPath $mdReportPath -Encoding UTF8

  $report | ConvertTo-Json -Depth 80
  if ($finalVerdict -like "PASS*") { exit 0 }
  exit 2
} catch {
  [ordered]@{
    schema_version = "A17_control_plane_integration_dryrun_v1"
    session_id = $SessionId
    runtime_dir = $RuntimeDir
    final_phase = "QUARANTINE"
    final_verdict = "FAIL_CONTROL_PLANE_INTEGRATION"
    error = $_.Exception.Message
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 20
  exit 1
}
