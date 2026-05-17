param(
  [string]$SkillPath = "",
  [string]$AuditResultPath = "",
  [string]$OutMarkdown = "",
  [string]$OutJson = ""
)

$ErrorActionPreference = "Stop"

if (-not $SkillPath -and -not $AuditResultPath) { throw "Provide -SkillPath or -AuditResultPath." }

$audit = $null
if ($AuditResultPath) {
  if (-not (Test-Path -LiteralPath $AuditResultPath)) { throw "AuditResultPath not found: $AuditResultPath" }
  $audit = Get-Content -LiteralPath $AuditResultPath -Raw | ConvertFrom-Json
  $SkillPath = [string]$audit.skill_path
}

if (-not (Test-Path -LiteralPath $SkillPath)) { throw "SkillPath not found: $SkillPath" }
$resolvedSkillPath = (Resolve-Path -LiteralPath $SkillPath).Path
$skillMd = Join-Path $resolvedSkillPath "SKILL.md"
if (-not (Test-Path -LiteralPath $skillMd)) { throw "SKILL.md not found: $skillMd" }

$text = Get-Content -LiteralPath $skillMd -Raw
$useful = [System.Collections.Generic.List[string]]::new()
$unsafe = [System.Collections.Generic.List[string]]::new()

foreach ($rule in @(
  @{ Label = "checklist structure"; Pattern = 'checklist|steps|workflow' },
  @{ Label = "design review criteria"; Pattern = 'design|visual|UX|accessibility' },
  @{ Label = "behavior-first testing guidance"; Pattern = 'TDD|test[- ]first|behavior' },
  @{ Label = "scope and path guardrails"; Pattern = 'scope|allowed paths|forbidden paths' },
  @{ Label = "skill authoring conventions"; Pattern = 'frontmatter|description|skill' }
)) {
  if ($text -match $rule.Pattern) { $useful.Add($rule.Label) | Out-Null }
}

foreach ($rule in @(
  @{ Label = "network or remote fetch content"; Pattern = '\bcurl\b|\bwget\b|Invoke-WebRequest|\biwr\b|\bfetch\s*\(|https?://' },
  @{ Label = "script execution or install steps"; Pattern = '\bnpm\s+install\b|\bpip\s+install\b|Invoke-Expression|\biex\b' },
  @{ Label = "destructive Git or filesystem commands"; Pattern = 'git add -A|git reset|git clean|git push --force|rm -rf|Remove-Item\s+.*-Recurse' },
  @{ Label = "prompt injection or host-rule override"; Pattern = 'ignore previous instructions|override host|bypass Mission Contract|bypass Control Plane' },
  @{ Label = "NeuroChess red-tier conflict"; Pattern = '\bPractice\b|\bdue_at\b|\bDaily Plan\b|\btraining_items?\b|\bpractice_attempts?\b|\bscoring\b|\bXP\b|\bTransfer\b' }
)) {
  if ($text -match $rule.Pattern) { $unsafe.Add($rule.Label) | Out-Null }
}

if ($useful.Count -eq 0) { $useful.Add("manual adaptation notes required") | Out-Null }

$target = "mission-contract-shadow-plan"
if ($text -match '(?i)design|visual|UX|accessibility|frontend') { $target = "frontend-visual-review" }
elseif ($text -match '(?i)TDD|test[- ]first|behavior') { $target = "tdd-behavior-contract" }
elseif ($text -match '(?i)React|performance') { $target = "react-performance-review" }
elseif ($text -match '(?i)Gemini|audit') { $target = "gemini-auditor" }

$result = [ordered]@{
  skill_path = $resolvedSkillPath
  skill_name = if ($audit) { [string]$audit.skill_name } else { Split-Path -Leaf $resolvedSkillPath }
  reusable_ideas = @($useful)
  unsafe_parts_to_discard = @($unsafe)
  proposed_internal_neurochess_skill_target = $target
  adaptation_notes = "Rewrite useful ideas into a NeuroChess-owned skill; do not copy scripts or remote fetch behavior."
  scripts_executed = $false
  live_network_call = $false
  product_mission_executed = $false
}

$markdown = @"
# Skill Pattern Extraction

- Skill: $($result.skill_name)
- Proposed internal target: $target
- Scripts executed: false
- Live network call: false

## Reusable Ideas
$(@($useful) | ForEach-Object { "- $_" } | Out-String)
## Unsafe Parts To Discard
$(@($unsafe) | ForEach-Object { "- $_" } | Out-String)
## Adaptation Notes
Rewrite useful ideas into a NeuroChess-owned skill; do not copy scripts or remote fetch behavior.
"@

if ($OutMarkdown) {
  $parent = Split-Path -Parent $OutMarkdown
  if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  $markdown | Set-Content -LiteralPath $OutMarkdown -Encoding UTF8
}
if ($OutJson) {
  $parent = Split-Path -Parent $OutJson
  if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  $result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $OutJson -Encoding UTF8
}

$result | ConvertTo-Json -Depth 10
exit 0
