param(
  [string]$ProjectName = "NeuroChess Supervisor",
  [string]$StatePath = "",
  [string]$LastMissionsPath = "",
  [string]$NextExpectedRole = "confirm_supervisor_ready_before_any_micro_prompt",
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

function Add-Section {
  param([System.Collections.Generic.List[string]]$Lines, [string]$Title, [string[]]$Body)
  $Lines.Add("") | Out-Null
  $Lines.Add("## $Title") | Out-Null
  $Lines.Add("") | Out-Null
  foreach ($line in $Body) {
    $Lines.Add($line) | Out-Null
  }
}

function Add-Bullets {
  param([System.Collections.Generic.List[string]]$Lines, [string]$Title, [string[]]$Items)
  $body = [System.Collections.Generic.List[string]]::new()
  if ($Items.Count -eq 0) {
    $body.Add("- none provided") | Out-Null
  } else {
    foreach ($item in $Items) { $body.Add("- $item") | Out-Null }
  }
  Add-Section -Lines $Lines -Title $Title -Body @($body)
}

function Read-State {
  param([string]$Path)
  if ($Path -and (Test-Path -LiteralPath $Path)) {
    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
  }
  return $null
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if (-not $StatePath) {
  $StatePath = Join-Path $repoRoot "ops\autopilot\state.json"
}
$state = Read-State -Path $StatePath

if (-not $OutDir) {
  $root = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\session_rollovers"
  $OutDir = Join-Path $root (Get-Date -Format "yyyyMMdd_HHmmss")
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$branch = (& git -C $repoRoot branch --show-current).Trim()
$head = (& git -C $repoRoot rev-parse --short HEAD).Trim()
$originHead = (& git -C $repoRoot rev-parse --short origin/road-to-V2).Trim()
$commits = @(& git -C $repoRoot log --oneline -8)

$lastMissions = @()
if ($LastMissionsPath -and (Test-Path -LiteralPath $LastMissionsPath)) {
  $raw = Get-Content -LiteralPath $LastMissionsPath -Raw
  try {
    $parsed = $raw | ConvertFrom-Json
    if ($null -ne $parsed.missions) {
      foreach ($mission in @($parsed.missions | Select-Object -First 5)) {
        $lastMissions += "$($mission.id): $($mission.result) $($mission.commit)"
      }
    } else {
      $lastMissions += @($raw -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -First 5)
    }
  } catch {
    $lastMissions += @($raw -split "`r?`n" | Where-Object { $_.Trim() } | Select-Object -First 5)
  }
}

$productCheckpoint = if ($state -and $state.product_checkpoint) { [string]$state.product_checkpoint } else { "R3H complete; R3K/R3L read-only audit/contract complete; active Practice not started." }
$disabled = @(
  "Night Mode live execution",
  "live session rollover",
  "live watchdog enforcement",
  "red-tier auto-promotion",
  "backend/frontend product execution in this handoff"
)
$automationStack = @(
  "ChatGPT Web bridge text smoke",
  "screenshot upload smoke",
  "Supervisor Digest",
  "REQUEST_MORE",
  "Mission Contract pre-registration",
  "ephemeral branch protocol",
  "red-tier quarantine",
  "TDD separation",
  "early exit / shadow linting",
  "Strategic Pulse",
  "mission timebox",
  "watchdog scaffold and drills"
)
$risks = @(
  "overlong supervisor sessions can drift",
  "future Practice remains red-tier",
  "ChatGPT Web bridge remains UI-fragile",
  "automation must return product value rather than harden forever"
)
$forbiddenZones = @(
  "frontend/** without explicit mission permission",
  "backend/** without explicit mission permission",
  "docs/rebuild/** unless the mission allows a specific docs-only contract",
  "plan/**",
  "package.json",
  "package-lock.json",
  "App.tsx",
  ".serena/**",
  ".venv/**",
  "qa_artifacts/**",
  "backend/neurochess/data/openings_book.json"
)
$redRules = @(
  "Practice, due_at, Daily Plan, training_items, practice_attempts, scoring, XP/rank, and Transfer are red-tier zones.",
  "Red-tier work requires quarantine, evidence, rollback plan, and supervisor review.",
  "No red-tier branch auto-promotes to road-to-V2."
)
$formats = @(
  "NC_SUPERVISOR_READY for boot readiness",
  "NC_SUPERVISOR_RESPONSE for micro-prompts",
  "NC_STRATEGIC_PULSE for strategy checks",
  "nonce-bound NC_DONE required"
)

$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add("# Supervisor Handoff Pack") | Out-Null
$lines.Add("") | Out-Null
$lines.Add("project_name: $ProjectName") | Out-Null
$lines.Add("current_branch: $branch") | Out-Null
$lines.Add("current_head: $head") | Out-Null
$lines.Add("origin_head: $originHead") | Out-Null
$lines.Add("generated_at: $(Get-Date -Format o)") | Out-Null

Add-Bullets -Lines $lines -Title "Last 8 Commits" -Items $commits
Add-Section -Lines $lines -Title "Current Product Checkpoint" -Body @($productCheckpoint)
Add-Bullets -Lines $lines -Title "Current Automation Stack" -Items $automationStack
Add-Bullets -Lines $lines -Title "Current Disabled Features" -Items $disabled
Add-Bullets -Lines $lines -Title "Active Risks" -Items $risks
Add-Bullets -Lines $lines -Title "Current Forbidden Zones" -Items $forbiddenZones
Add-Bullets -Lines $lines -Title "Red-Tier Rules" -Items $redRules
Add-Bullets -Lines $lines -Title "Last 5 Missions Summary" -Items $lastMissions
Add-Section -Lines $lines -Title "Next Expected Role" -Body @($NextExpectedRole)
Add-Bullets -Lines $lines -Title "Required Response Formats" -Items $formats
Add-Section -Lines $lines -Title "Supervisor Reminder" -Body @("Do not provide broad prompts. Use MICRO_PROMPT only when asked.")

$packPath = Join-Path $OutDir "supervisor_handoff_pack.md"
Set-Content -LiteralPath $packPath -Value ($lines -join "`n") -Encoding UTF8

[ordered]@{
  status = "pass"
  project_name = $ProjectName
  handoff_pack_path = $packPath
  includes_full_patch = $false
  includes_screenshots = $false
  includes_secrets = $false
  live_chatgpt_called = $false
  product_mission_executed = $false
  commit = $false
  push = $false
} | ConvertTo-Json -Depth 6
