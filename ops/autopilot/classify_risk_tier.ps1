param(
  [Parameter(Mandatory = $true)][string]$MissionJson,
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $MissionJson)) {
  throw "Mission JSON not found: $MissionJson"
}

if (-not $OutDir) {
  $OutDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\red_tier_classification" (Get-Date -Format "yyyyMMdd_HHmmss")
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$raw = Get-Content -LiteralPath $MissionJson -Raw
$mission = $raw | ConvertFrom-Json
$text = $raw.ToLowerInvariant()

$patterns = [ordered]@{
  "practice active execution" = 'practice\s+active|active\s+practice|start\s+practice|practice\s+session'
  "practice_attempts write" = 'practice_attempts|practice_attempt|attempts?\s+creation|create\s+attempt'
  "training_items write" = 'training_items|training_item|training\s+item\s+(creation|create|update|delete|write)'
  "due_at mutation" = 'due_at|due\s+at'
  "Daily Plan mutation" = 'daily\s+plan|daily_plan|plan\s+mutation|plan\s+rebuild'
  "scoring write" = 'scoring\s+write|score\s+write|record\s+score|scoring'
  "result recording" = 'record\s+a?\s*result|result\s+record'
  "solution reveal" = 'solution\s+reveal|reveal\s+solution'
  "XP/rank/league" = '\bxp\b|\brank\b|league'
  "Transfer Score" = 'transfer\s+score'
  "learning-state DB migration" = 'migration.*(training|practice|review|schedule|scheduling)'
  "hidden side effect route/service" = 'hidden\s+side\s+effect|side\s+effect'
}

$redFlags = [System.Collections.Generic.List[string]]::new()
foreach ($entry in $patterns.GetEnumerator()) {
  if ($text -match $entry.Value) {
    $redFlags.Add($entry.Key) | Out-Null
  }
}

$risk = if ($redFlags.Count -gt 0) { "red" } else { "green" }
$reasons = if ($risk -eq "red") {
  @("mission text contains red-tier learning-state or scheduling risk")
} else {
  @("no red-tier terms detected")
}

$result = [ordered]@{
  risk_tier = $risk
  reasons = $reasons
  red_flags = @($redFlags)
  mission_id = [string]$mission.id
  source = (Resolve-Path $MissionJson).Path
}

$outPath = Join-Path $OutDir "classification.json"
$result | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $outPath -Encoding UTF8
$result | Add-Member -NotePropertyName classification_path -NotePropertyValue $outPath -Force
$result | ConvertTo-Json -Depth 8
