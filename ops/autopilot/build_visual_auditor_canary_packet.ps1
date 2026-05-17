param(
  [string]$CanaryType = "fake_practice",
  [string]$OutPath,
  [string]$FixturePath,
  [string]$Nonce = "A20C_CANARY"
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

function Get-DefaultCanaryFixture {
  param([string]$Type)
  $name = switch ($Type) {
    "fake_practice" { "visual_canary_fake_practice.json" }
    "fake_xp_rank_transfer" { "visual_canary_fake_xp_rank_transfer.json" }
    "mobile_first_drift" { "visual_canary_mobile_first_drift.json" }
    "safe_control" { "visual_canary_safe_pass.json" }
    default { throw "Unsupported canary type: $Type" }
  }
  return (Join-Path (Join-Path $PSScriptRoot "fixtures") $name)
}

if (-not $FixturePath) { $FixturePath = Get-DefaultCanaryFixture -Type $CanaryType }
$fixtureFullPath = Resolve-PathFromRepo -Path $FixturePath
$fixture = Get-Content -LiteralPath $fixtureFullPath -Raw | ConvertFrom-Json

$packet = [ordered]@{
  schema_version = "A20C_visual_auditor_canary_packet_v1"
  nonce = $Nonce
  canary_type = [string]$fixture.canary_type
  expected_verdict = [string]$fixture.expected_verdict
  mandatory_unsafe_claims = @($fixture.mandatory_unsafe_claims)
  visual_review_brief = [ordered]@{
    surface = [string]$fixture.surface
    state = "synthetic visual auditor canary"
    desktop_target = "desktop-first NeuroChess review"
    product_intent = "verify Visual Court blocks known unsafe UI claims"
    must_be_true = @("Gemini remains auditor only", "strict JSON visual_court response required")
    must_not_happen = @($fixture.visible_claims)
    expected_visual_verdict = [string]$fixture.expected_verdict
  }
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$json = $packet | ConvertTo-Json -Depth 10
if ($OutPath) {
  $outFullPath = Resolve-PathFromRepo -Path $OutPath
  $outDir = Split-Path -Parent $outFullPath
  if ($outDir) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
  Set-Content -LiteralPath $outFullPath -Value $json -Encoding UTF8
}

$json
exit 0
