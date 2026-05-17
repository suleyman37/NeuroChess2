param(
  [string]$OverlapJson,
  [string]$OverlapJsonPath,
  [string]$MissionMetadataJson,
  [string]$MissionMetadataPath
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Read-JsonInput {
  param([string]$Json, [string]$Path)
  if ($Path) {
    $fullPath = if ([System.IO.Path]::IsPathRooted($Path)) { $Path } else { Join-Path (Get-RepoRoot) $Path }
    return (Get-Content -LiteralPath $fullPath -Raw | ConvertFrom-Json)
  }
  if ($Json) { return ($Json | ConvertFrom-Json) }
  return $null
}

function Has-RedTierSignal {
  param($Overlap, $Metadata)
  if ($Overlap -and [bool]$Overlap.red_tier_overlap) { return $true }
  if ($Metadata -and $Metadata.risk_tier -and ([string]$Metadata.risk_tier).ToLowerInvariant() -eq "red") { return $true }
  $patterns = @("Practice", "due_at", "Daily Plan", "training_items", "practice_attempts", "scoring", "XP", "rank", "Transfer")
  foreach ($file in @($Overlap.overlapping_files)) {
    foreach ($pattern in $patterns) {
      if ([string]$file -match [regex]::Escape($pattern)) { return $true }
    }
  }
  return $false
}

$overlap = Read-JsonInput -Json $OverlapJson -Path $OverlapJsonPath
if (-not $overlap) { throw "Overlap JSON is required" }
$metadata = Read-JsonInput -Json $MissionMetadataJson -Path $MissionMetadataPath

if ([string]$overlap.overlap_result -eq "PASS") {
  $decision = "CONTINUE"
  $action = "CONTINUE"
  $reason = "No active branch file overlap was detected."
  $dependency = $null
} elseif (Has-RedTierSignal -Overlap $overlap -Metadata $metadata) {
  $decision = "QUARANTINE_REQUIRED"
  $action = "STOP"
  $reason = "Overlap intersects a red-tier or sensitive path signal."
  $dependency = $null
} else {
  $explicitDependency = $false
  $previousClassification = ""
  if ($metadata) {
    $explicitDependency = [bool]$metadata.explicit_dependency
    $previousClassification = [string]$metadata.previous_branch_classification
  }
  if (-not $explicitDependency -and $overlap.PSObject.Properties["explicit_dependency"]) {
    $explicitDependency = [bool]$overlap.explicit_dependency
  }
  if (-not $previousClassification -and $overlap.PSObject.Properties["previous_branch_classification"]) {
    $previousClassification = [string]$overlap.previous_branch_classification
  }
  $safePrevious = @("READY_TO_REVIEW", "NEEDS_REWORK") -contains $previousClassification
  if ($explicitDependency -and $safePrevious) {
    $decision = "STACK_ON_PREVIOUS_BRANCH"
    $action = "STACK_ON_PREVIOUS_BRANCH"
    $reason = "Overlap is intentional and depends on a safe previous branch."
    $dependency = @($overlap.conflicting_branches)[0]
  } else {
    $decision = "REJECT_MISSION"
    $action = "REJECT_MISSION"
    $reason = "Overlap is not justified by an explicit safe dependency."
    $dependency = $null
  }
}

$result = [ordered]@{
  decision = $decision
  recommended_action = $action
  reason = $reason
  dependency_branch = $dependency
  overlapping_files = @($overlap.overlapping_files)
  conflicting_branches = @($overlap.conflicting_branches)
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
exit 0
