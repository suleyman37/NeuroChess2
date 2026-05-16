param(
  [Parameter(Mandatory = $true)][string]$MissionJson,
  [Parameter(Mandatory = $true)][string]$BranchName,
  [Parameter(Mandatory = $true)][string]$EvidenceDir,
  [Parameter(Mandatory = $true)][string]$RiskClassificationPath,
  [string]$RollbackPlanPath = "",
  [switch]$RollbackPlanProvided,
  [string[]]$RequiredChecks = @(),
  [string]$CurrentBranchOverride = "",
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

if (-not $OutDir) {
  $OutDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\red_tier_preflight" (Get-Date -Format "yyyyMMdd_HHmmss")
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$reasons = [System.Collections.Generic.List[string]]::new()

if (-not (Test-Path -LiteralPath $MissionJson)) { $reasons.Add("mission json missing") | Out-Null }
if (-not (Test-Path -LiteralPath $EvidenceDir)) { $reasons.Add("evidence directory missing") | Out-Null }
if (-not (Test-Path -LiteralPath $RiskClassificationPath)) { $reasons.Add("risk classification missing") | Out-Null }

$mission = $null
if (Test-Path -LiteralPath $MissionJson) {
  $mission = Get-Content -LiteralPath $MissionJson -Raw | ConvertFrom-Json
}

$classification = $null
if (Test-Path -LiteralPath $RiskClassificationPath) {
  $classification = Get-Content -LiteralPath $RiskClassificationPath -Raw | ConvertFrom-Json
  if ($classification.risk_tier -ne "red") { $reasons.Add("risk classification is not red") | Out-Null }
}

$currentBranch = if ($CurrentBranchOverride) { $CurrentBranchOverride } else { (git branch --show-current).Trim() }
if ($currentBranch -eq "road-to-V2") { $reasons.Add("current branch must not be road-to-V2") | Out-Null }
if ($BranchName -notlike "quarantine/red-*") { $reasons.Add("branch name must start with quarantine/red-") | Out-Null }

$rollbackExists = $RollbackPlanProvided -or ($RollbackPlanPath -and (Test-Path -LiteralPath $RollbackPlanPath))
if (-not $rollbackExists) { $reasons.Add("rollback plan missing") | Out-Null }

if ($RequiredChecks.Count -eq 0) { $reasons.Add("required checks missing") | Out-Null }

if ($mission) {
  if ($null -eq $mission.auto_promote -or [bool]$mission.auto_promote) { $reasons.Add("auto_promote must be false") | Out-Null }
  if ($null -eq $mission.auto_push_to_road_to_V2 -or [bool]$mission.auto_push_to_road_to_V2) { $reasons.Add("auto_push_to_road_to_V2 must be false") | Out-Null }
  if (-not $mission.allowed_paths -or @($mission.allowed_paths).Count -eq 0) { $reasons.Add("allowed paths missing") | Out-Null }
  if (-not $mission.forbidden_paths -or @($mission.forbidden_paths).Count -eq 0) { $reasons.Add("forbidden paths missing") | Out-Null }
}

$result = [ordered]@{
  status = if ($reasons.Count -eq 0) { "pass" } else { "fail" }
  reasons = @($reasons)
  mission_json = $MissionJson
  branch_name = $BranchName
  current_branch = $currentBranch
  evidence_dir = $EvidenceDir
  risk_classification = $RiskClassificationPath
  product_execution = $false
}

$result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $OutDir "red_tier_preflight.json") -Encoding UTF8
$result | ConvertTo-Json -Depth 10
if ($reasons.Count -gt 0) { exit 1 }
exit 0
