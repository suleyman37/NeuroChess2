param(
  [string]$InputPath
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Resolve-FromRepo {
  param([string]$Path)
  if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
  return (Join-Path (Get-RepoRoot) $Path)
}

function Get-Prop {
  param($Object, [string]$Name, $Default = $null)
  if ($null -eq $Object) { return $Default }
  $prop = $Object.PSObject.Properties[$Name]
  if ($null -eq $prop) { return $Default }
  return $prop.Value
}

if (-not $InputPath) { throw "InputPath is required" }
$inputObject = Get-Content -LiteralPath (Resolve-FromRepo $InputPath) -Raw | ConvertFrom-Json
$violations = New-Object System.Collections.Generic.List[string]
$stateResults = New-Object System.Collections.Generic.List[object]

foreach ($state in @((Get-Prop $inputObject "states" @()))) {
  $name = [string](Get-Prop $state "learning_state" "unknown")
  $phase = [string](Get-Prop $state "phase" "")
  $isPreFeedback = ($phase -eq "pre_feedback" -or $name -eq "observe" -or $name -eq "try_before_feedback")
  $stateViolations = New-Object System.Collections.Generic.List[string]
  if ($isPreFeedback) {
    foreach ($flag in @("solution_line_present", "candidate_path_present", "destination_trace_present", "ambiguous_answer_like_trace_present")) {
      if ([bool](Get-Prop $state $flag $false)) {
        $stateViolations.Add($flag) | Out-Null
        $violations.Add("$name`:$flag") | Out-Null
      }
    }
  }
  $stateResults.Add([ordered]@{
    learning_state = $name
    phase = $phase
    pre_feedback = $isPreFeedback
    violations = @($stateViolations)
  }) | Out-Null
}

if ($stateResults.Count -eq 0) {
  $violations.Add("missing_state_evidence") | Out-Null
}

$resultName = "PASS_STATE_SEMANTICS"
if ($violations.Count -gt 0) { $resultName = "BLOCK_STATE_SEMANTICS" }

$result = [ordered]@{
  schema_version = "A20K_anti_spoiler_visual_state_score_v1"
  subject = [string](Get-Prop $inputObject "subject" "unknown")
  anti_spoiler_visual_state_result = $resultName
  hard_gates_pass = ($violations.Count -eq 0)
  state_results = @($stateResults.ToArray())
  violations = @($violations)
  runtime_user_approval_required = $false
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
if ($resultName -eq "BLOCK_STATE_SEMANTICS") { exit 2 }
exit 0
