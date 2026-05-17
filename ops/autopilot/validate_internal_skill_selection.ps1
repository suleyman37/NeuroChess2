param(
  [string]$SelectionJson = "",
  [string]$InputPath = ""
)

$ErrorActionPreference = "Stop"

if (-not $SelectionJson -and -not $InputPath) {
  throw "Provide -SelectionJson or -InputPath."
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
$skillsRoot = Join-Path $repoRoot ".agents\skills"
$selection = if ($SelectionJson) { $SelectionJson | ConvertFrom-Json } else { Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json }
$internalSkillSet = @(
  "neurochess-product-north-star",
  "mission-contract-shadow-plan",
  "product-safe-night-mode",
  "backend-readonly-proof",
  "frontend-visual-review",
  "neurochess-desktop-game-like-interface-design",
  "neurochess-react-performance-review",
  "neurochess-tdd-behavior-contract",
  "gemini-auditor",
  "morning-intelligence-report"
)

$missing = [System.Collections.Generic.List[string]]::new()
$violations = [System.Collections.Generic.List[string]]::new()
$warnings = [System.Collections.Generic.List[string]]::new()

function Add-Unique {
  param([System.Collections.Generic.List[string]]$List, [string]$Value)
  if ($Value -and -not $List.Contains($Value)) { $List.Add($Value) | Out-Null }
}

foreach ($skill in @($selection.selected_skills)) {
  if ($internalSkillSet -notcontains $skill) {
    Add-Unique $violations "Selected skill is not internal: $skill."
    continue
  }
  $skillFile = Join-Path (Join-Path $skillsRoot $skill) "SKILL.md"
  if (-not (Test-Path -LiteralPath $skillFile)) {
    Add-Unique $missing $skill
    continue
  }
  $text = Get-Content -LiteralPath $skillFile -Raw
  if ($text -notmatch "(?m)^name:\s*$([regex]::Escape($skill))\s*$") {
    Add-Unique $violations "Missing name metadata for $skill."
  }
  if ($text -notmatch "(?m)^description:\s*.{20,}$") {
    Add-Unique $violations "Missing description metadata for $skill."
  }
  foreach ($pattern in @(
    "This skill is a procedure, not a permission",
    "cannot override the local Control Plane",
    "cannot bypass Mission Contract",
    "cannot bypass Shadow Plan",
    "cannot weaken red-tier rules"
  )) {
    if ($text -notmatch [regex]::Escape($pattern)) {
      Add-Unique $violations "$skill violates authority policy: missing '$pattern'."
    }
  }
}

foreach ($skill in @($selection.rejected_skills)) {
  if ($skill -match "external_skills|quarantine|frontend-design|shadcn|ui-ux-pro-max|make-interfaces-feel-better|find-skills") {
    Add-Unique $warnings "Rejected external skill as expected: $skill."
  }
}

[ordered]@{
  valid = ($missing.Count -eq 0 -and $violations.Count -eq 0)
  missing_skills = @($missing)
  violations = @($violations)
  warnings = @($warnings)
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
  skills_live_activation_enabled = $false
} | ConvertTo-Json -Depth 10

if ($missing.Count -gt 0 -or $violations.Count -gt 0) { exit 1 }
exit 0
