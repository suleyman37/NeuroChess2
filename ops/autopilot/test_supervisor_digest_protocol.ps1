$ErrorActionPreference = "Stop"

$requiredFields = @(
  "mission_id",
  "current_head",
  "risk_tier",
  "work_type",
  "goal",
  "allowed_paths",
  "changed_files",
  "diff_stat",
  "checks_summary",
  "alarms_summary",
  "codex_confidence",
  "question_for_supervisor"
)

function Test-Digest {
  param([Parameter(Mandatory = $true)][string]$Path)

  $text = Get-Content -LiteralPath $Path -Raw
  $reasons = [System.Collections.Generic.List[string]]::new()

  if ($text -notmatch '(?s)<SUPERVISOR_DIGEST>.*</SUPERVISOR_DIGEST>') {
    $reasons.Add("missing supervisor digest block") | Out-Null
  }

  foreach ($field in $requiredFields) {
    if ($text -notmatch "(?m)^$([regex]::Escape($field)):\s*(.*)?$") {
      $reasons.Add("missing required field: $field") | Out-Null
    }
  }

  if ($text -match 'diff --git|<PATCH>|BEGIN PATCH|Index: ') {
    $reasons.Add("full patch content detected") | Out-Null
  }

  return [ordered]@{
    ok = ($reasons.Count -eq 0)
    reasons = @($reasons)
  }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$validFixture = Join-Path $PSScriptRoot "fixtures\supervisor_digest_valid.txt"
$missingFixture = Join-Path $PSScriptRoot "fixtures\supervisor_digest_missing_required_field.txt"
$outRoot = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\supervisor_digest_tests"
$outDir = Join-Path $outRoot (Get-Date -Format "yyyyMMdd_HHmmss")
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$valid = Test-Digest -Path $validFixture
$missing = Test-Digest -Path $missingFixture

$buildOutput = & "$PSScriptRoot\build_supervisor_digest.ps1" `
  -MissionId "A4A_TEST_DIGEST" `
  -CurrentHead "6e8cba9" `
  -RiskTier "green" `
  -WorkType "docs_tooling" `
  -Goal "Build one compact Supervisor Digest." `
  -AllowedPaths @("docs/autopilot/SUPERVISOR_DIGEST_PROTOCOL.md") `
  -ChangedFiles @("docs/autopilot/SUPERVISOR_DIGEST_PROTOCOL.md") `
  -DiffStat "1 file changed, 10 insertions(+)" `
  -ChecksSummary "git diff --check: PASS" `
  -AlarmsSummary "none" `
  -CodexConfidence "0.92" `
  -QuestionForSupervisor "Is this enough compact evidence?" `
  -OutDir $outDir

$build = $buildOutput | ConvertFrom-Json
$builtDigest = Test-Digest -Path $build.digest_path
$builtText = Get-Content -LiteralPath $build.digest_path -Raw

$checks = [ordered]@{
  valid_fixture_passes = [bool]$valid.ok
  missing_required_field_fails = -not [bool]$missing.ok
  builder_produced_digest = [bool](Test-Path $build.digest_path)
  built_digest_passes = [bool]$builtDigest.ok
  no_full_patch_by_default = ($builtText -notmatch 'diff --git|<PATCH>|BEGIN PATCH|Index: ')
  no_live_chatgpt_call = -not [bool]$build.live_chatgpt_called
  no_browser_call = -not [bool]$build.browser_called
}

$failed = @($checks.GetEnumerator() | Where-Object { -not $_.Value } | ForEach-Object { $_.Key })
$summary = [ordered]@{
  status = if ($failed.Count -eq 0) { "pass" } else { "fail" }
  failed = $failed
  valid_fixture = $valid
  missing_required_fixture = $missing
  build_output = $build
  built_digest = $builtDigest
  checks = $checks
  report_dir = $outDir
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $outDir "supervisor_digest_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10

if ($failed.Count -gt 0) {
  exit 1
}

exit 0
