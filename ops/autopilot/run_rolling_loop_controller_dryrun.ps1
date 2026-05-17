param(
  [string]$Scenario = "success_sequence",
  [string]$FixturePath = "",
  [string]$RuntimeDir = "",
  [string]$ReportRoot = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\rolling_loop_dry_runs",
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
  $Object | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $path -Encoding UTF8
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

function Get-Value {
  param($Object, [string]$Name, $Default = $null)
  if (Has-Property $Object $Name) { return $Object.$Name }
  return $Default
}

function Get-SelectedSkillNames {
  param($Selection)
  return @($Selection.selected_skills | ForEach-Object { [string]$_ })
}

function New-PromptLedgerEntry {
  param($Mission, [string]$Session, [string]$MissionHash, [string]$Status, [string]$ContractResult, [bool]$ChecksPassed)
  return [ordered]@{
    schema_version = "A16F_prompt_ledger_entry_v1"
    prompt_id = "prompt_$($Mission.mission_id)"
    mission_id = [string]$Mission.mission_id
    session_id = $Session
    created_at = [DateTimeOffset]::UtcNow.ToString("o")
    prompt_source = "A18_rolling_loop_fixture"
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
    stop_reason = if ($Status -ne "dry_run_success") { "deterministic dry-run stop" } else { "" }
    checks_required = @($Mission.required_checks)
    checks_run = @($Mission.required_checks)
    checks_passed = $ChecksPassed
    prompt_execution_score = [ordered]@{ total = if ($ChecksPassed) { 10 } else { 0 }; rolling_loop_dry_run = $true }
    lessons = @("A18 rolling-loop fixture only; no live execution.")
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

function Resolve-ScenarioPath {
  param([string]$Name, [string]$ExplicitPath, [string]$FixtureRoot)
  if ($ExplicitPath) { return (Resolve-Path -LiteralPath $ExplicitPath).Path }
  $map = @{
    success_sequence = "rolling_loop_success_sequence.json"
    repeat_hash_stop = "rolling_loop_repeat_hash_stop.json"
    no_progress_stop = "rolling_loop_no_progress_stop.json"
    red_tier_reject = "rolling_loop_red_tier_reject.json"
    phase_transition = "rolling_loop_phase_transition.json"
    rollover_due = "rolling_loop_rollover_due.json"
    low_product_value = "rolling_loop_low_product_value.json"
  }
  if (-not $map.ContainsKey($Name)) { throw "Unknown Scenario: $Name" }
  return (Join-Path $FixtureRoot $map[$Name])
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
  }
}

function Set-StateFields {
  param($State, [hashtable]$Fields)
  foreach ($entry in $Fields.GetEnumerator()) {
    $State | Add-Member -Force -NotePropertyName ([string]$entry.Key) -NotePropertyValue $entry.Value
  }
  return $State
}

$lockAcquired = $false

try {
  $fixtureRoot = Join-Path $PSScriptRoot "fixtures"
  $scenarioPath = Resolve-ScenarioPath -Name $Scenario -ExplicitPath $FixturePath -FixtureRoot $fixtureRoot
  if (-not (Test-Path -LiteralPath $scenarioPath)) { throw "Scenario fixture not found: $scenarioPath" }
  $scenarioObject = Get-Content -LiteralPath $scenarioPath -Raw | ConvertFrom-Json
  if (-not $RuntimeDir) { $RuntimeDir = Join-Path ([System.IO.Path]::GetTempPath()) ("neurochess_rolling_loop_dryrun_" + [guid]::NewGuid().ToString("N")) }
  if (-not $SessionId) { $SessionId = "A18_DRYRUN_$([guid]::NewGuid().ToString('N').Substring(0, 12))" }
  $tempDir = Join-Path $RuntimeDir "inputs"
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
  $reportScript = Join-Path $PSScriptRoot "build_rolling_loop_report.ps1"

  $events = [System.Collections.Generic.List[object]]::new()
  $missionsAccepted = [System.Collections.Generic.List[object]]::new()
  $missionsRejected = [System.Collections.Generic.List[object]]::new()
  $phaseTransitions = [System.Collections.Generic.List[object]]::new()
  $hashHistory = [System.Collections.Generic.List[string]]::new()
  $loopDecisions = [System.Collections.Generic.List[object]]::new()
  $eventSequence = 1
  $stop = $false
  $stopReason = ""
  $finalVerdict = ""
  $finalPhase = [string]$scenarioObject.initial_phase
  $missionsProposed = 0
  $missionsProcessed = 0
  $e2ePassCount = 0
  $liveRolloverEnabled = $false
  $progressLedgerPath = Join-Path $RuntimeDir "progress_ledger.jsonl"
  $promptLedgerPath = Join-Path $RuntimeDir "prompt_ledger.jsonl"

  $lock = Invoke-JsonCommand -ScriptPath $lockScript -Arguments @("-Action", "AcquireLock", "-RuntimeDir", $RuntimeDir, "-Owner", $SessionId)
  $lockAcquired = [bool]$lock.json.acquired
  $stateNew = Invoke-JsonCommand -ScriptPath $stateScript -Arguments @("-Action", "NewSession", "-RuntimeDir", $RuntimeDir, "-SessionId", $SessionId, "-MaxSteps", ([string](Get-Value $scenarioObject "max_steps" 8)), "-MaxHours", "2")
  $events.Add((Process-ControlPlaneEvent -Runtime $RuntimeDir -EventType "SESSION_STARTED" -Session $SessionId -Sequence $eventSequence -MissionId "" -Reason "A18 rolling-loop dry-run session started")) | Out-Null
  $eventSequence += 1

  foreach ($queueItem in @($scenarioObject.mission_queue)) {
    if ($stop) { break }
    $missionsProposed += 1
    $fixturePath = Join-Path $fixtureRoot ([string]$queueItem.fixture)
    if (-not (Test-Path -LiteralPath $fixturePath)) { throw "Mission fixture not found: $fixturePath" }
    $fixture = Get-Content -LiteralPath $fixturePath -Raw | ConvertFrom-Json
    if (Has-Property $queueItem "product_impact_override") {
      $fixture | Add-Member -Force -NotePropertyName "product_impact" -NotePropertyValue $queueItem.product_impact_override
    }
    $mission = $fixture.mission
    $missionId = [string]$mission.mission_id
    $missionDir = Join-Path $RuntimeDir ("evidence\" + $missionId + "_" + [string]$queueItem.step_id)
    New-Item -ItemType Directory -Force -Path $missionDir | Out-Null

    $events.Add((Process-ControlPlaneEvent -Runtime $RuntimeDir -EventType "MISSION_PROPOSED" -Session $SessionId -Sequence $eventSequence -MissionId $missionId -Reason ([string]$queueItem.step_id))) | Out-Null
    $eventSequence += 1

    $missionPath = Write-JsonTemp -Directory $tempDir -Name "$($queueItem.step_id).mission.json" -Object $mission
    $selection = Invoke-JsonCommand -ScriptPath $selectSkillsScript -Arguments @("-InputPath", $missionPath) -AcceptExitCodes @(0, 2)
    $selectionPath = Write-JsonTemp -Directory $tempDir -Name "$($queueItem.step_id).selection.json" -Object $selection.json
    $skillValidation = Invoke-JsonCommand -ScriptPath $validateSkillsScript -Arguments @("-InputPath", $selectionPath) -AcceptExitCodes @(0, 1)

    if ((Has-Property $fixture "expected_decision") -or $selection.json.selection_result -eq "FAIL") {
      $events.Add((Process-ControlPlaneEvent -Runtime $RuntimeDir -EventType "QUARANTINE_REQUIRED" -Session $SessionId -Sequence $eventSequence -MissionId $missionId -Reason "deterministic red-tier rejection")) | Out-Null
      $eventSequence += 1
      $missionsRejected.Add([ordered]@{
        step_id = [string]$queueItem.step_id
        mission_id = $missionId
        selected_skills = @(Get-SelectedSkillNames $selection.json)
        skill_selection_result = $selection.json.selection_result
        stop_reason = "red-tier or deterministic scope rejection"
        decision = "QUARANTINE"
        product_mission_executed = $false
      }) | Out-Null
      $stop = $true
      $stopReason = "red-tier or deterministic scope rejection"
      $finalVerdict = "QUARANTINE_REQUIRED"
      $finalPhase = "QUARANTINE"
      break
    }

    $ncPath = Write-TextTemp -Directory $tempDir -Name "$($queueItem.step_id).nc-mp2.txt" -Text ([string]$fixture.nc_mp2_text)
    $parse = Invoke-JsonCommand -ScriptPath $parseNcMp2Script -Arguments @("-InputPath", $ncPath)
    $lint = Invoke-JsonCommand -ScriptPath $lintNcMp2Script -Arguments @("-InputPath", $ncPath) -AcceptExitCodes @(0, 1)
    if ($lint.json.lint_result -ne "PASS") {
      $stop = $true
      $stopReason = "NC-MP/2 lint failed"
      $finalVerdict = "STOP_DETERMINISTIC_GATE"
      break
    }

    $contractPath = Write-JsonTemp -Directory $tempDir -Name "$($queueItem.step_id).contract.json" -Object $fixture.mission_contract
    $contractValidation = Invoke-JsonCommand -ScriptPath $validateContractScript -Arguments @("-ContractPath", $contractPath, "-ReportDir", (Join-Path $missionDir "mission_contract")) -AcceptExitCodes @(0, 1)
    if ($contractValidation.json.validation_result -ne "PASS") {
      $stop = $true
      $stopReason = "Mission Contract validation failed"
      $finalVerdict = "STOP_DETERMINISTIC_GATE"
      break
    }

    $shadowPath = Write-JsonTemp -Directory $tempDir -Name "$($queueItem.step_id).shadow_plan.json" -Object $fixture.shadow_plan
    $shadowComparison = Invoke-JsonCommand -ScriptPath $compareShadowScript -Arguments @("-ShadowPlanPath", $shadowPath, "-ContractPath", $contractPath, "-ReportDir", (Join-Path $missionDir "shadow_plan")) -AcceptExitCodes @(0, 1)
    if ($shadowComparison.json.comparison_result -ne "MATCH") {
      $stop = $true
      $stopReason = "Shadow Plan mismatch"
      $finalVerdict = "STOP_DETERMINISTIC_GATE"
      break
    }

    $productPath = Write-JsonTemp -Directory $tempDir -Name "$($queueItem.step_id).product_impact.json" -Object $fixture.product_impact
    $productGate = Invoke-JsonCommand -ScriptPath $productImpactScript -Arguments @("-InputPath", $productPath) -AcceptExitCodes @(0, 2)
    if ($productGate.json.product_gate_result -in @("FAIL", "STRATEGIC_PULSE_REQUIRED") -or (([bool](Get-Value $scenarioObject "stop_on_product_warn" $false)) -and $productGate.json.product_gate_result -eq "WARN")) {
      $missionsRejected.Add([ordered]@{
        step_id = [string]$queueItem.step_id
        mission_id = $missionId
        selected_skills = @(Get-SelectedSkillNames $selection.json)
        product_gate = $productGate.json.product_gate_result
        stop_reason = "Product Gate required Strategic Pulse or rejected low value"
        decision = "STOP"
        product_mission_executed = $false
      }) | Out-Null
      $stop = $true
      $stopReason = "Product Gate required Strategic Pulse or rejected low value"
      $finalVerdict = "STOP_LOW_PRODUCT_VALUE"
      break
    }

    $hash = Invoke-JsonCommand -ScriptPath $computeHashScript -Arguments @("-InputPath", $missionPath)
    $hashHistoryPath = Write-JsonTemp -Directory $tempDir -Name "$($queueItem.step_id).hash_history.json" -Object ([ordered]@{ mission_hashes_seen = @($hashHistory) })
    $repeat = Invoke-JsonCommand -ScriptPath $repeatScript -Arguments @("-InputPath", $missionPath, "-HashListPath", $hashHistoryPath, "-MaxSameMissionHashRepeats", "1") -AcceptExitCodes @(0, 2)
    if ($repeat.json.decision -ne "CONTINUE") {
      $missionsRejected.Add([ordered]@{
        step_id = [string]$queueItem.step_id
        mission_id = $missionId
        mission_hash = $hash.json.mission_hash
        repeat_decision = $repeat.json.decision
        stop_reason = "Repeated mission hash"
        decision = "STOP"
        product_mission_executed = $false
      }) | Out-Null
      $stop = $true
      $stopReason = "Repeated mission hash"
      $finalVerdict = "FAIL_REPEAT_MISSION_HASH"
      break
    }
    $hashHistory.Add([string]$hash.json.mission_hash) | Out-Null

    $goldilocksPath = Write-JsonTemp -Directory $tempDir -Name "$($queueItem.step_id).goldilocks.json" -Object $fixture.goldilocks
    $goldilocks = Invoke-JsonCommand -ScriptPath $goldilocksScript -Arguments @("-InputPath", $goldilocksPath) -AcceptExitCodes @(0, 2)
    if ($goldilocks.json.verdict -ne "GOLDILOCKS_PASS") {
      $stop = $true
      $stopReason = "Goldilocks rejected mission scope"
      $finalVerdict = "STOP_DETERMINISTIC_GATE"
      break
    }

    $fixture.e2e_result.external_evidence_pack_path = $missionDir
    $e2ePath = Write-JsonTemp -Directory $tempDir -Name "$($queueItem.step_id).e2e.json" -Object $fixture.e2e_result
    $e2e = Invoke-JsonCommand -ScriptPath $e2eScript -Arguments @("-InputPath", $e2ePath)
    if ($e2e.json.score_result -eq "E2E_DELIVERABLE_PASS") { $e2ePassCount += 1 }

    $forceNoProgress = [bool](Get-Value $queueItem "force_no_progress" $false)
    $progressInput = [ordered]@{
      mission_id = $missionId
      files_changed_count = if ($forceNoProgress) { 0 } else { 1 }
      branch = if ($forceNoProgress) { "" } elseif ($mission.work_type -match "backend|frontend") { "autopilot/$missionId" } else { "road-to-V2" }
      commit_sha = if ((-not $forceNoProgress) -and $e2e.json.score_result -eq "E2E_DELIVERABLE_PASS") { "simulated-$missionId" } else { "" }
      evidence_pack_path = if ($forceNoProgress) { "" } else { $missionDir }
      external_report_path = if ($forceNoProgress) { "" } else { Join-Path $missionDir "mission_report.json" }
      tests_run = if ($forceNoProgress) { "" } else { @($mission.required_checks) }
      contract_result = $shadowComparison.json.comparison_result
      stop_reason = ""
      same_mission_hash_repeated = $false
    }
    $progressPath = Write-JsonTemp -Directory $tempDir -Name "$($queueItem.step_id).forward_progress.json" -Object $progressInput
    $forward = Invoke-JsonCommand -ScriptPath $forwardProgressScript -Arguments @("-InputPath", $progressPath, "-LedgerPath", $progressLedgerPath) -AcceptExitCodes @(0, 2)
    $priorConsecutiveNoProgress = 0
    for ($i = $missionsAccepted.Count - 1; $i -ge 0; $i--) {
      if ([bool]$missionsAccepted[$i].forward_progress) { break }
      $priorConsecutiveNoProgress += 1
    }
    $effectiveForwardDecision = [string]$forward.json.decision
    if ((-not [bool]$forward.json.forward_progress) -and (($priorConsecutiveNoProgress + 1) -ge 2)) {
      $effectiveForwardDecision = "STOP_NO_FORWARD_PROGRESS"
    }

    $progressEntry = New-ProgressLedgerEntry -Mission $mission -Session $SessionId -MissionHash ([string]$hash.json.mission_hash) -Progress ([bool]$forward.json.forward_progress) -Status "dry_run"
    $progressEntryPath = Write-JsonTemp -Directory $tempDir -Name "$($queueItem.step_id).progress_entry.json" -Object $progressEntry
    $progressLedger = Invoke-JsonCommand -ScriptPath $progressLedgerScript -Arguments @("-InputPath", $progressEntryPath, "-LedgerPath", $progressLedgerPath)

    $promptEntry = New-PromptLedgerEntry -Mission $mission -Session $SessionId -MissionHash ([string]$hash.json.mission_hash) -Status "dry_run_success" -ContractResult ([string]$shadowComparison.json.comparison_result) -ChecksPassed $true
    $promptEntryPath = Write-JsonTemp -Directory $tempDir -Name "$($queueItem.step_id).prompt_entry.json" -Object $promptEntry
    $promptLedger = Invoke-JsonCommand -ScriptPath $promptLedgerScript -Arguments @("-InputPath", $promptEntryPath, "-LedgerPath", $promptLedgerPath)

    $missionReport = [ordered]@{
      step_id = [string]$queueItem.step_id
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
      forward_progress_decision = $effectiveForwardDecision
      progress_ledger = $progressLedger.json.status
      prompt_ledger = $promptLedger.json.status
      simulated_execution = "fixture_only"
      product_mission_executed = $false
    }
    $missionReport | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath (Join-Path $missionDir "mission_report.json") -Encoding UTF8
    $missionsAccepted.Add($missionReport) | Out-Null
    $missionsProcessed += 1

    $stateForWrite = (Invoke-JsonCommand -ScriptPath $stateScript -Arguments @("-Action", "ReadState", "-RuntimeDir", $RuntimeDir)).json.state
    $stateForWrite = Set-StateFields -State $stateForWrite -Fields @{
      current_step = $missionsProcessed
      current_mission_id = $missionId
      current_mission_hash = [string]$hash.json.mission_hash
      mission_hashes_seen = @($hashHistory)
      current_phase = $finalPhase
      recommended_next_action = "continue_dry_run"
      last_state_update = [DateTimeOffset]::UtcNow.ToString("o")
    }
    $stateWritePath = Write-JsonTemp -Directory $tempDir -Name "$($queueItem.step_id).state_update.json" -Object $stateForWrite
    Invoke-JsonCommand -ScriptPath $stateScript -Arguments @("-Action", "WriteStateAtomic", "-RuntimeDir", $RuntimeDir, "-InputPath", $stateWritePath) | Out-Null

    $events.Add((Process-ControlPlaneEvent -Runtime $RuntimeDir -EventType "MISSION_COMPLETED" -Session $SessionId -Sequence $eventSequence -MissionId $missionId -Reason "Synthetic rolling-loop mission completed")) | Out-Null
    $eventSequence += 1

    $loopDecisions.Add([ordered]@{ step_id = [string]$queueItem.step_id; decision = if ($effectiveForwardDecision -eq "CONTINUE") { "CONTINUE" } else { $effectiveForwardDecision }; phase = $finalPhase }) | Out-Null

    if ($effectiveForwardDecision -eq "STOP_NO_FORWARD_PROGRESS") {
      $stop = $true
      $stopReason = "Forward Progress detector stopped repeated no-progress missions"
      $finalVerdict = "FAIL_NO_FORWARD_PROGRESS"
      break
    }

    $rolloverDueAfter = [int](Get-Value $scenarioObject "rollover_due_after_steps" 0)
    if ($rolloverDueAfter -gt 0 -and $missionsProcessed -ge $rolloverDueAfter -and -not $liveRolloverEnabled) {
      $events.Add((Process-ControlPlaneEvent -Runtime $RuntimeDir -EventType "SESSION_STOP_REQUESTED" -Session $SessionId -Sequence $eventSequence -MissionId $missionId -Reason "dry-run rollover required")) | Out-Null
      $eventSequence += 1
      $stop = $true
      $stopReason = "Rollover due and live rollover disabled"
      $finalVerdict = "ROLLOVER_REQUIRED"
      break
    }
  }

  if (-not $stop) {
    foreach ($phaseCheck in @(Get-Value $scenarioObject "phase_checks" @())) {
      $phaseInput = [ordered]@{
        phase_state = $phaseCheck.phase_state
        latest_mission_result = $phaseCheck.latest_mission_result
      }
      $phasePath = Write-JsonTemp -Directory $tempDir -Name "$($phaseCheck.step_id).phase.json" -Object $phaseInput
      $phase = Invoke-JsonCommand -ScriptPath $phaseScript -Arguments @("-InputPath", $phasePath)
      $phaseTransitions.Add($phase.json) | Out-Null
      $finalPhase = [string]$phase.json.next_phase
      $loopDecisions.Add([ordered]@{ step_id = [string]$phaseCheck.step_id; decision = if ($phase.json.stop) { "STOP" } else { "CONTINUE" }; phase = $finalPhase; verdict = $phase.json.verdict }) | Out-Null
    }
    if ($e2ePassCount -lt [int](Get-Value $scenarioObject "required_e2e_deliverables" 0)) {
      $finalVerdict = "FAIL_NO_E2E_DELIVERABLE"
      $stopReason = "E2E deliverable quota not reached"
    } elseif (([string](Get-Value $scenarioObject "expected_final_verdict" "")) -like "PASS*") {
      $finalVerdict = [string]$scenarioObject.expected_final_verdict
      $stopReason = "Queue drained with deterministic gates passing"
    } else {
      $finalVerdict = "PASS_ROLLING_LOOP_DRY_RUN"
      $stopReason = "Queue drained with deterministic gates passing"
    }
  }

  $stateFinal = Invoke-JsonCommand -ScriptPath $stateScript -Arguments @("-Action", "ReadState", "-RuntimeDir", $RuntimeDir)
  $events.Add((Process-ControlPlaneEvent -Runtime $RuntimeDir -EventType "SESSION_DRAINED" -Session $SessionId -Sequence $eventSequence -MissionId "" -Reason "A18 rolling-loop dry-run finished")) | Out-Null
  $eventSequence += 1
  $lockRelease = Invoke-JsonCommand -ScriptPath $lockScript -Arguments @("-Action", "ReleaseLock", "-RuntimeDir", $RuntimeDir, "-Owner", $SessionId) -AcceptExitCodes @(0)
  $lockAcquired = $false

  $result = [ordered]@{
    schema_version = "A18_rolling_loop_dryrun_result_v1"
    session_id = $SessionId
    scenario_name = [string]$scenarioObject.scenario_name
    runtime_dir = $RuntimeDir
    initial_phase = [string]$scenarioObject.initial_phase
    final_phase = $finalPhase
    final_verdict = $finalVerdict
    stop_reason = $stopReason
    missions_proposed = $missionsProposed
    missions_processed = $missionsProcessed
    missions_accepted = @($missionsAccepted)
    missions_rejected = @($missionsRejected)
    selected_skills_verified = (@($missionsAccepted | Where-Object { -not $_.skill_validation_valid }).Count -eq 0)
    e2e_deliverables = $e2ePassCount
    loop_decisions = @($loopDecisions)
    phase_transitions = @($phaseTransitions)
    events = @($events)
    final_state_status = $stateFinal.json.status
    lock_acquired = [bool]$lock.json.acquired
    lock_released = [bool]$lockRelease.json.released
    what_would_happen_next = if ($finalVerdict -like "PASS*") { "prepare A18B live smoke with dry-run gates still default-off" } elseif ($finalVerdict -eq "ROLLOVER_REQUIRED") { "perform supervised rollover setup before continuing" } elseif ($finalVerdict -eq "QUARANTINE_REQUIRED") { "quarantine mission and request Strategic Pulse" } else { "stop and repair the fixture or controller condition" }
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  }
  $resultPath = Write-JsonTemp -Directory $tempDir -Name "rolling_loop_result.pre_report.json" -Object $result
  $reported = Invoke-JsonCommand -ScriptPath $reportScript -Arguments @("-InputPath", $resultPath, "-ReportRoot", $ReportRoot)
  $reported.json | ConvertTo-Json -Depth 100
  if ($finalVerdict -like "PASS*") { exit 0 }
  exit 2
} catch {
  if ($lockAcquired) {
    try { Invoke-JsonCommand -ScriptPath $lockScript -Arguments @("-Action", "ReleaseLock", "-RuntimeDir", $RuntimeDir, "-Owner", $SessionId) | Out-Null } catch {}
  }
  [ordered]@{
    schema_version = "A18_rolling_loop_dryrun_result_v1"
    scenario_name = $Scenario
    session_id = $SessionId
    runtime_dir = $RuntimeDir
    final_phase = "QUARANTINE"
    final_verdict = "FAIL_ROLLING_LOOP_CONTROLLER"
    stop_reason = $_.Exception.Message
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 20
  exit 1
}
