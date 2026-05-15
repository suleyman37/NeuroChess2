param(
  [Parameter(Mandatory = $true)][string]$MissionId,
  [Parameter(Mandatory = $true)][string]$CurrentHead,
  [Parameter(Mandatory = $true)][string]$RiskTier,
  [Parameter(Mandatory = $true)][string]$WorkType,
  [Parameter(Mandatory = $true)][string]$Goal,
  [Parameter(Mandatory = $true)][string[]]$AllowedPaths,
  [string[]]$ChangedFiles = @(),
  [string]$DiffStat = "",
  [string]$ChecksSummary = "",
  [string]$AlarmsSummary = "none",
  [Parameter(Mandatory = $true)][string]$CodexConfidence,
  [Parameter(Mandatory = $true)][string]$QuestionForSupervisor,
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

function Add-List {
  param([System.Collections.Generic.List[string]]$Lines, [string]$Name, [string[]]$Items)
  $Lines.Add("${Name}:") | Out-Null
  if ($Items.Count -eq 0) {
    $Lines.Add("- none") | Out-Null
    return
  }
  foreach ($item in $Items) {
    $Lines.Add("- $item") | Out-Null
  }
}

function Add-Block {
  param([System.Collections.Generic.List[string]]$Lines, [string]$Name, [string]$Value)
  $Lines.Add("${Name}: |") | Out-Null
  $text = if ([string]::IsNullOrWhiteSpace($Value)) { "none" } else { $Value.TrimEnd() }
  foreach ($line in ($text -split "`r?`n")) {
    $Lines.Add("  $line") | Out-Null
  }
}

if (-not $OutDir) {
  $root = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\supervisor_digests"
  $OutDir = Join-Path $root (Get-Date -Format "yyyyMMdd_HHmmss")
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add("<SUPERVISOR_DIGEST>") | Out-Null
$lines.Add("mission_id: $MissionId") | Out-Null
$lines.Add("current_head: $CurrentHead") | Out-Null
$lines.Add("risk_tier: $RiskTier") | Out-Null
$lines.Add("work_type: $WorkType") | Out-Null
$lines.Add("goal: $Goal") | Out-Null
Add-List -Lines $lines -Name "allowed_paths" -Items $AllowedPaths
Add-List -Lines $lines -Name "changed_files" -Items $ChangedFiles
Add-Block -Lines $lines -Name "diff_stat" -Value $DiffStat
Add-Block -Lines $lines -Name "checks_summary" -Value $ChecksSummary
Add-Block -Lines $lines -Name "alarms_summary" -Value $AlarmsSummary
$lines.Add("codex_confidence: $CodexConfidence") | Out-Null
Add-Block -Lines $lines -Name "question_for_supervisor" -Value $QuestionForSupervisor
$lines.Add("</SUPERVISOR_DIGEST>") | Out-Null

$digestPath = Join-Path $OutDir "supervisor_digest.md"
Set-Content -LiteralPath $digestPath -Value ($lines -join "`n") -Encoding UTF8

[ordered]@{
  status = "pass"
  digest_path = $digestPath
  live_chatgpt_called = $false
  browser_called = $false
  codex_execution = $false
  commit = $false
  push = $false
  includes_full_patch = $false
} | ConvertTo-Json -Depth 6
