param(
  [string]$ContextPath,
  [string]$InputPath,
  [string]$OutPath
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

function Get-Field {
  param($Object, [string]$Name, $Default = $null)
  if ($null -eq $Object) { return $Default }
  $prop = $Object.PSObject.Properties[$Name]
  if ($null -eq $prop) { return $Default }
  return $prop.Value
}

function Get-Number {
  param($Object, [string]$Name, [double]$Default = 0)
  $value = Get-Field -Object $Object -Name $Name -Default $null
  if ($null -eq $value -or $value -eq "") { return $Default }
  return [double]$value
}

function Get-Bool {
  param($Object, [string]$Name, [bool]$Default = $false)
  $value = Get-Field -Object $Object -Name $Name -Default $null
  if ($null -eq $value) { return $Default }
  if ($value -is [string] -and [string]::IsNullOrWhiteSpace($value)) { return $Default }
  return [System.Convert]::ToBoolean($value)
}

function Normalize-Candidate {
  param($Candidate)
  $category = [string](Get-Field $Candidate "category" "DISTRACTION")
  $score = Get-Number $Candidate "marginal_value_score" 0
  $confidence = Get-Number $Candidate "confidence" 0.5
  $risk = [Math]::Max((Get-Number $Candidate "branch_overlap_risk" 0), (Get-Number $Candidate "red_tier_risk" 0))
  $rank = [Math]::Round(($score * [Math]::Max($confidence, 0.1)) - ($risk * 0.35), 2)
  return [ordered]@{
    objective_id = [string](Get-Field $Candidate "objective_id" ("objective_" + [guid]::NewGuid().ToString("N").Substring(0, 8)))
    category = $category
    target_friction_id = $(Get-Field $Candidate "target_friction_id" $null)
    north_star_vector = @((Get-Field $Candidate "north_star_vector" @()))
    expected_e2e_potential = [bool](Get-Bool $Candidate "expected_e2e_potential" $false)
    expected_branch_count = [int](Get-Number $Candidate "expected_branch_count" 0)
    expected_files = @((Get-Field $Candidate "expected_files" @()))
    expected_time_minutes_min = [int](Get-Number $Candidate "expected_time_minutes_min" 0)
    expected_time_minutes_max = [int](Get-Number $Candidate "expected_time_minutes_max" 0)
    branch_overlap_risk = [int](Get-Number $Candidate "branch_overlap_risk" 0)
    red_tier_risk = [int](Get-Number $Candidate "red_tier_risk" 0)
    visual_audit_required = [bool](Get-Bool $Candidate "visual_audit_required" $false)
    visual_provider_available = [bool](Get-Bool $Candidate "visual_provider_available" $true)
    evidence_expected = @((Get-Field $Candidate "evidence_expected" @()))
    marginal_value_score = [int]$score
    confidence = [double]$confidence
    reason_to_do_now = [string](Get-Field $Candidate "reason_to_do_now" "")
    reason_not_to_do = [string](Get-Field $Candidate "reason_not_to_do" "")
    recommended_phase = [string](Get-Field $Candidate "recommended_phase" "ADAPTIVE_EXTENSION")
    rank_score = $rank
  }
}

$sourcePath = if ($ContextPath) { $ContextPath } else { $InputPath }
if (-not $sourcePath) { throw "ContextPath or InputPath is required" }
$context = Get-Content -LiteralPath (Resolve-PathFromRepo -Path $sourcePath) -Raw | ConvertFrom-Json
$rawCandidates = @((Get-Field $context "objective_candidates" @()))
if ($rawCandidates.Count -eq 0 -and (Get-Field $context "candidates" $null)) {
  $rawCandidates = @($context.candidates)
}

$candidates = @()
foreach ($candidate in $rawCandidates) {
  $candidates += (Normalize-Candidate -Candidate $candidate)
}

$ranked = @($candidates | Sort-Object -Property @{ Expression = "rank_score"; Descending = $true }, @{ Expression = "marginal_value_score"; Descending = $true })
$highValue = @($ranked | Where-Object { [int]$_.marginal_value_score -ge 70 -and [int]$_.red_tier_risk -le 40 -and [int]$_.branch_overlap_risk -le 40 })

$reservoir = [ordered]@{
  schema_version = "A20D_objective_reservoir_v1"
  generated_at = (Get-Date).ToUniversalTime().ToString("o")
  run_id = [string](Get-Field $context "run_id" "fixture")
  phase = [string](Get-Field $context "phase" "ADAPTIVE_EXTENSION")
  source_summary = @((Get-Field $context "sources" @("fixture_context")))
  objective_count = $ranked.Count
  high_value_count = $highValue.Count
  candidates = @($ranked)
  recommended_next_objective_id = $(if ($ranked.Count -gt 0) { [string]$ranked[0].objective_id } else { $null })
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$json = $reservoir | ConvertTo-Json -Depth 20
if ($OutPath) {
  $outFullPath = Resolve-PathFromRepo -Path $OutPath
  $outDir = Split-Path -Parent $outFullPath
  if ($outDir) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
  Set-Content -LiteralPath $outFullPath -Value $json -Encoding UTF8
}

$json
exit 0
