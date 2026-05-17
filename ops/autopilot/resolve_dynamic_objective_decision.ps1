param(
  [string]$InputPath
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

function Get-Field {
  param($Object, [string]$Name, $Default = $null)
  if ($null -eq $Object) { return $Default }
  $prop = $Object.PSObject.Properties[$Name]
  if ($null -eq $prop) { return $Default }
  return $prop.Value
}

if (-not $InputPath) { throw "InputPath is required" }
$input = Get-Content -LiteralPath (Resolve-PathFromRepo -Path $InputPath) -Raw | ConvertFrom-Json
$architect = Get-Field $input "architect_decision" $input
$action = [string](Get-Field $architect "chosen_action" "")
$objectiveId = [string](Get-Field $architect "objective_id" "")
$reservoir = Get-Field $input "objective_reservoir" $null
$drainPermit = Get-Field $input "drain_permit" $null
$selected = $null

if ($reservoir -and $objectiveId) {
  foreach ($candidate in @((Get-Field $reservoir "candidates" @()))) {
    if ([string](Get-Field $candidate "objective_id" "") -eq $objectiveId) {
      $selected = $candidate
      break
    }
  }
}
if (-not $selected -and (Get-Field $architect "new_objective_candidate" $null)) {
  $selected = $architect.new_objective_candidate
}

if ($action -eq "DRAIN") {
  $permitValue = [string](Get-Field $drainPermit "drain_permit" "DENY_DRAIN")
  if ($permitValue -eq "ALLOW_DRAIN") {
    $decision = "ACCEPT_DRAIN"
    $recommended = "DRAIN"
    $reason = "Drain permit allows DRAIN."
    $exitCode = 0
  } else {
    $decision = "REJECT_DRAIN_DENIED"
    $recommended = [string](Get-Field $drainPermit "required_next_action" "ASK_ARCHITECT_FOR_NEXT_OBJECTIVE")
    $reason = "Architect DRAIN rejected because Drain Permit denied it."
    $exitCode = 2
  }
} elseif (@("EXTEND_PRODUCT_OBJECTIVE", "CONSOLIDATE_EXISTING_BRANCHES", "ADD_TEST_OR_SMOKE_EVIDENCE", "RUN_VISUAL_REVIEW_OR_CANARY", "EVIDENCE_AMPLIFICATION", "PREPARE_MORNING_REPORT") -contains $action) {
  if (-not $selected) {
    $decision = "REJECT_OBJECTIVE_NOT_FOUND"
    $recommended = "ASK_ARCHITECT_FOR_NEXT_OBJECTIVE"
    $reason = "No objective candidate was supplied or found."
    $exitCode = 2
  } else {
    $candidateTempPath = Join-Path ([System.IO.Path]::GetTempPath()) ("a20d_objective_candidate_{0}.json" -f ([guid]::NewGuid().ToString("N")))
    try {
      $selected | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $candidateTempPath -Encoding UTF8
      $scoreText = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "score_objective_candidate.ps1") -CandidatePath $candidateTempPath 2>&1
      $scoreExit = $LASTEXITCODE
      $score = ($scoreText | Out-String).Trim() | ConvertFrom-Json
    } finally {
      if (Test-Path -LiteralPath $candidateTempPath -PathType Leaf) {
        Remove-Item -LiteralPath $candidateTempPath -Force -ErrorAction SilentlyContinue
      }
    }
    if ($scoreExit -eq 0 -and @("PASS", "WARN") -contains [string]$score.objective_score_result) {
      $decision = "ACCEPT_OBJECTIVE"
      $recommended = "CONTINUE"
      $reason = "Objective passed Marginal Value Gate."
      $exitCode = 0
    } else {
      $decision = "REJECT_LOW_MARGINAL_VALUE"
      $recommended = "DRAIN"
      $reason = "Objective failed Marginal Value Gate."
      $exitCode = 2
    }
  }
} elseif ($action -eq "STOP") {
  $decision = "ACCEPT_STOP"
  $recommended = "STOP"
  $reason = "Architect requested STOP; Control Plane still records explicit stop."
  $exitCode = 0
} else {
  $decision = "REJECT_UNKNOWN_ACTION"
  $recommended = "ASK_ARCHITECT_FOR_NEXT_OBJECTIVE"
  $reason = "Architect action is not in the allowed A20D schema."
  $exitCode = 2
}

$result = [ordered]@{
  dynamic_objective_decision = $decision
  architect_action = $action
  objective_id = $objectiveId
  recommended_action = $recommended
  reason = $reason
  selected_objective = $selected
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 20
exit $exitCode
