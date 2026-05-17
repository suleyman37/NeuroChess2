param(
  [string]$InputPath = "",
  [string]$PhaseStatePath = "",
  [string]$PhaseStateJson = "",
  [string]$MissionResultPath = "",
  [string]$MissionResultJson = ""
)

$ErrorActionPreference = "Stop"

function Read-JsonInput {
  param([string]$Path, [string]$RawJson)
  if ($RawJson) { return ($RawJson | ConvertFrom-Json) }
  if ($Path) {
    if (-not (Test-Path -LiteralPath $Path)) { throw "JSON input not found: $Path" }
    return (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json)
  }
  return $null
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

function Add-Reason {
  param([System.Collections.Generic.List[string]]$Reasons, [string]$Message)
  if ($Message -and -not $Reasons.Contains($Message)) { $Reasons.Add($Message) | Out-Null }
}

try {
  $combined = Read-JsonInput -Path $InputPath -RawJson ""
  $state = Read-JsonInput -Path $PhaseStatePath -RawJson $PhaseStateJson
  $mission = Read-JsonInput -Path $MissionResultPath -RawJson $MissionResultJson

  if ($combined) {
    if (Has-Property $combined "phase_state") { $state = $combined.phase_state } else { $state = $combined }
    if (Has-Property $combined "latest_mission_result") { $mission = $combined.latest_mission_result }
  }
  if (-not $state) { throw "Phase state is required." }
  if (-not $mission) { $mission = [pscustomobject]@{} }

  $phase = ([string](Get-Field $state "current_phase" "EXPANSION")).ToUpperInvariant()
  $nextPhase = $phase
  $verdict = "PARTIAL_E2E_DELIVERABLES_CREATED"
  $stop = $false
  $reasonList = [System.Collections.Generic.List[string]]::new()

  $e2eCount = [int](Get-Field $state "e2e_deliverables_count" 0)
  if ([bool](Get-Field $mission "e2e_deliverable_created" $false)) { $e2eCount += 1 }
  $requiredE2e = [int](Get-Field $state "required_e2e_deliverables" 1)
  $expansionCount = [int](Get-Field $state "expansion_mission_count" 0)
  $maxExpansion = [int](Get-Field $state "max_missions_expansion" 5)
  $consecutiveLow = [int](Get-Field $state "consecutive_low_value_consolidation_missions" 0)
  if ([bool](Get-Field $mission "zero_e2e_gain" $false)) { $consecutiveLow += 1 }

  if ([bool](Get-Field $mission "red_tier_breach" $false) -or [bool](Get-Field $mission "quarantine_required" $false)) {
    $nextPhase = "QUARANTINE"
    $verdict = "FAIL_RED_TIER_BREACH"
    $stop = $true
    Add-Reason $reasonList "Red-tier or quarantine trigger detected."
  } elseif ([bool](Get-Field $mission "control_plane_desync" $false)) {
    $nextPhase = "QUARANTINE"
    $verdict = "FAIL_CONTROL_PLANE_DESYNC"
    $stop = $true
    Add-Reason $reasonList "Control Plane desync detected."
  } elseif ([bool](Get-Field $mission "visual_block" $false)) {
    $nextPhase = "QUARANTINE"
    $verdict = "FAIL_VISUAL_BLOCK"
    $stop = $true
    Add-Reason $reasonList "Visual block detected."
  } elseif ($phase -eq "EXPANSION") {
    $pulse = ([string](Get-Field $state "strategic_pulse_decision" "")).ToUpperInvariant()
    if ($e2eCount -ge $requiredE2e) {
      $nextPhase = "CONSOLIDATION"
      $verdict = "PARTIAL_E2E_DELIVERABLES_CREATED"
      Add-Reason $reasonList "Required E2E deliverable quota reached."
    } elseif ($expansionCount -ge $maxExpansion) {
      $nextPhase = "CONSOLIDATION"
      $verdict = "PARTIAL_CAPACITY_REACHED"
      Add-Reason $reasonList "Maximum expansion missions reached."
    } elseif ($pulse -eq "NARROW" -or $pulse -eq "CONSOLIDATE") {
      $nextPhase = "CONSOLIDATION"
      $verdict = "PARTIAL_STERILE_EXPANSION"
      Add-Reason $reasonList "Strategic Pulse requested consolidation."
    } elseif ([bool](Get-Field $state "goldilocks_sterile_expansion" $false)) {
      $nextPhase = "CONSOLIDATION"
      $verdict = "PARTIAL_STERILE_EXPANSION"
      Add-Reason $reasonList "Goldilocks detected sterile expansion."
    } else {
      Add-Reason $reasonList "Expansion may continue under Control Plane gates."
    }
  } elseif ($phase -eq "CONSOLIDATION") {
    if ([bool](Get-Field $state "branches_classified" $false)) {
      $nextPhase = "DRAIN"
      $verdict = "PARTIAL_E2E_DELIVERABLES_CREATED"
      Add-Reason $reasonList "Branches classified for morning review."
    } elseif ($consecutiveLow -ge 2) {
      $nextPhase = "DRAIN"
      $verdict = "PARTIAL_CONSOLIDATION_INCOMPLETE"
      Add-Reason $reasonList "Two consecutive consolidation missions had zero E2E gain."
    } elseif ([bool](Get-Field $state "time_fuse_approaching" $false)) {
      $nextPhase = "DRAIN"
      $verdict = "PARTIAL_CONSOLIDATION_INCOMPLETE"
      Add-Reason $reasonList "Time/cost fuse approaching."
    } else {
      Add-Reason $reasonList "Consolidation may continue."
    }
  } elseif ($phase -eq "DRAIN") {
    $reportComplete = [bool](Get-Field $state "morning_report_complete" $false)
    $early = [bool](Get-Field $state "quotas_met_early" $false)
    $timeFuse = [bool](Get-Field $state "time_fuse_approaching" $false)
    if ($e2eCount -ge $requiredE2e -and $reportComplete -and $early) {
      $verdict = "PASS_EARLY_EXCELLENCE"
      $stop = $true
      Add-Reason $reasonList "Quotas met early and morning report complete."
    } elseif ($e2eCount -ge $requiredE2e -and $reportComplete -and $timeFuse) {
      $verdict = "PASS_FULL_NIGHT"
      $stop = $true
      Add-Reason $reasonList "Quotas met near time fuse and report complete."
    } elseif ($reportComplete) {
      $verdict = "PARTIAL_E2E_DELIVERABLES_CREATED"
      $stop = $true
      Add-Reason $reasonList "Drain report complete with partial deliverables."
    } else {
      $verdict = "PARTIAL_CONSOLIDATION_INCOMPLETE"
      Add-Reason $reasonList "Drain must finish the morning report."
    }
  } elseif ($phase -eq "QUARANTINE") {
    $verdict = "FAIL_RED_TIER_BREACH"
    $stop = $true
    Add-Reason $reasonList "Quarantine phase isolates unsafe state."
  } else {
    $nextPhase = "QUARANTINE"
    $verdict = "FAIL_CONTROL_PLANE_DESYNC"
    $stop = $true
    Add-Reason $reasonList "Unknown phase."
  }

  [ordered]@{
    current_phase = $phase
    next_phase = $nextPhase
    transition_reason = (@($reasonList) -join " ")
    verdict = $verdict
    stop = $stop
    reasons = @($reasonList)
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
  } | ConvertTo-Json -Depth 10
  exit 0
} catch {
  [ordered]@{
    current_phase = ""
    next_phase = "QUARANTINE"
    transition_reason = $_.Exception.Message
    verdict = "FAIL_CONTROL_PLANE_DESYNC"
    stop = $true
    reasons = @($_.Exception.Message)
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
