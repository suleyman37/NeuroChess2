param(
  [Parameter(Mandatory = $true)][string]$MissionJson,
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $MissionJson)) {
  throw "Mission JSON not found: $MissionJson"
}

if (-not $OutDir) {
  $OutDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\tdd_classification" (Get-Date -Format "yyyyMMdd_HHmmss")
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$raw = Get-Content -LiteralPath $MissionJson -Raw
$mission = $raw | ConvertFrom-Json
$paths = @($mission.allowed_paths | ForEach-Object { ([string]$_).Replace("\", "/") })
$risk = ([string]$mission.risk_tier).ToLowerInvariant()
$workType = ([string]$mission.work_type).ToLowerInvariant()
$text = ($raw + "`n" + [string]$mission.goal + "`n" + [string]$mission.codex_prompt).ToLowerInvariant()

function Test-DocsPath {
  param([string]$Path)
  return ($Path -like "docs/autopilot/*" -or $Path -like "docs/rebuild/*")
}

function Test-TestPath {
  param([string]$Path)
  return (
    $Path -match '(^|/)(tests?|__tests__)/' -or
    $Path -match '(^|/)test_[^/]+$' -or
    $Path -match '_test\.' -or
    $Path -match '\.(test|spec)\.' -or
    $Path -match 'smoke.*\.(mjs|js|py|ps1)$'
  )
}

$docsPaths = @($paths | Where-Object { Test-DocsPath $_ })
$testPaths = @($paths | Where-Object { Test-TestPath $_ })
$implementationPaths = @($paths | Where-Object { -not (Test-DocsPath $_) -and -not (Test-TestPath $_) })

$violations = [System.Collections.Generic.List[string]]::new()
$reasons = [System.Collections.Generic.List[string]]::new()
$phase = "unknown"
$valid = $true

if ($paths.Count -gt 0 -and $docsPaths.Count -eq $paths.Count -and ($workType -match "docs|documentation|docs-only" -or $text -match "docs-only|documentation|protocol")) {
  $phase = "docs_only"
  $reasons.Add("all allowed paths are documentation paths") | Out-Null
} elseif ($testPaths.Count -gt 0 -and $implementationPaths.Count -gt 0) {
  $phase = "mixed_invalid"
  $valid = $false
  $violations.Add("mission includes both test/spec paths and implementation paths") | Out-Null
} elseif ($testPaths.Count -gt 0) {
  $phase = "test_contract"
  $reasons.Add("allowed paths are test/spec paths") | Out-Null
} elseif ($implementationPaths.Count -gt 0) {
  if ($workType -match "validation" -or $text -match "run checks|validate only|validation") {
    $phase = "validation"
    $reasons.Add("mission text indicates validation") | Out-Null
  } else {
    $phase = "implementation"
    $reasons.Add("allowed paths include implementation paths and no tests") | Out-Null
  }
} elseif ($workType -match "validation") {
  $phase = "validation"
  $reasons.Add("work_type indicates validation") | Out-Null
} else {
  $phase = "unknown"
  $valid = $false
  $violations.Add("could not classify TDD phase") | Out-Null
}

if (($risk -eq "amber" -or $risk -eq "red") -and $phase -eq "mixed_invalid") {
  $violations.Add("amber/red missions cannot mix test and implementation") | Out-Null
}

$result = [ordered]@{
  tdd_phase = $phase
  valid = $valid
  reasons = @($reasons)
  violations = @($violations)
  risk_tier = $risk
  test_paths = @($testPaths)
  implementation_paths = @($implementationPaths)
  source = (Resolve-Path $MissionJson).Path
}

$outPath = Join-Path $OutDir "tdd_classification.json"
$result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $outPath -Encoding UTF8
$result | Add-Member -NotePropertyName classification_path -NotePropertyValue $outPath -Force
$result | ConvertTo-Json -Depth 10
