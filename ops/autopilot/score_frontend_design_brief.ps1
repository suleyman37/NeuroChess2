param(
  [string]$BriefPath
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

function Has-Text {
  param($Values, [string]$Pattern)
  foreach ($value in @($Values)) {
    if ([string]$value -match $Pattern) { return $true }
  }
  return $false
}

if (-not $BriefPath) { throw "BriefPath is required" }
$brief = Get-Content -LiteralPath (Resolve-PathFromRepo -Path $BriefPath) -Raw | ConvertFrom-Json
$flags = New-Object System.Collections.Generic.List[string]
$requirements = New-Object System.Collections.Generic.List[string]

if ([string]$brief.desktop_target -match "1366|1440|1920|desktop") { $requirements.Add("desktop_first") | Out-Null } else { $flags.Add("desktop_first_missing") | Out-Null }
if ([string]$brief.board_role -match "central|stage|board|position") { $requirements.Add("board_centered") | Out-Null } else { $flags.Add("board_centered_missing") | Out-Null }
if ([string]$brief.position_artifact_role -match "artifact") { $requirements.Add("position_as_artifact") | Out-Null } else { $flags.Add("position_artifact_missing") | Out-Null }
if (Has-Text -Values $brief.forbidden_design_drift -Pattern "fake Practice|XP|rank|Transfer") { $requirements.Add("fake_progress_forbidden") | Out-Null } else { $flags.Add("fake_progress_not_forbidden") | Out-Null }

$allText = ($brief | ConvertTo-Json -Depth 20)
$saasPatterns = @("generic metric table", "SaaS landing-page style", "too many bland cards", "generic blue", "meaningless glow", "passive information")
foreach ($pattern in $saasPatterns) {
  if ($allText -match [regex]::Escape($pattern)) { $flags.Add("generic_saas_drift:$pattern") | Out-Null }
}

$requiredMissing = @($flags | Where-Object { $_ -match "missing|not_forbidden" })
if ($requiredMissing.Count -gt 0) {
  $resultName = "REJECT_DESIGN_BRIEF"
  $action = "REPAIR_BRIEF"
} elseif (($flags | Where-Object { $_ -like "generic_saas_drift:*" }).Count -ge 4) {
  $resultName = "WARN_GENERIC_SAAS_DRIFT"
  $action = "ASK_VISUAL_COURT_GENERIC_SAAS_QUESTION"
} else {
  $resultName = "PASS"
  $action = "CONTINUE"
}

$result = [ordered]@{
  design_brief_score_result = $resultName
  requirements_present = @($requirements)
  flags = @($flags)
  recommended_action = $action
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
if ($resultName -eq "REJECT_DESIGN_BRIEF") { exit 2 }
exit 0
