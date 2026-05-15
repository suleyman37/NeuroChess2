$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) {
    throw $Message
  }
}

function Invoke-RequestMoreHandler {
  param(
    [Parameter(Mandatory = $true)][string]$InputPath,
    [Parameter(Mandatory = $true)][string]$Nonce,
    [Parameter(Mandatory = $true)][string]$MissionId,
    [Parameter(Mandatory = $true)][string]$EvidenceRoot,
    [Parameter(Mandatory = $true)][string]$OutDir,
    [int]$RequestMoreCount = 1
  )

  $output = & "$PSScriptRoot\handle_request_more.ps1" `
    -InputPath $InputPath `
    -Nonce $Nonce `
    -MissionId $MissionId `
    -EvidenceRoot $EvidenceRoot `
    -OutDir $OutDir `
    -RequestMoreCount $RequestMoreCount

  $exitCode = $LASTEXITCODE
  $summary = $null
  if ($output) {
    $summary = ($output -join "`n") | ConvertFrom-Json
  }

  return [ordered]@{
    exit_code = $exitCode
    summary = $summary
    raw_output = $output
  }
}

$nonce = "TEST_NONCE_REQUEST_MORE"
$fixtureRoot = Join-Path $PSScriptRoot "fixtures"
$validFixture = Join-Path $fixtureRoot "request_more_valid.txt"
$unknownFixture = Join-Path $fixtureRoot "request_more_unknown_item.txt"
$repeatStateFixture = Join-Path $fixtureRoot "request_more_repeated_limit_state.json"
$expectedFixture = Join-Path $fixtureRoot "request_more_followup_digest_expected.txt"
$outRoot = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\request_more_tests"
$runDir = Join-Path $outRoot (Get-Date -Format "yyyyMMdd_HHmmss")
$evidenceRoot = Join-Path $runDir "evidence"
$validOut = Join-Path $runDir "valid"
$unknownOut = Join-Path $runDir "unknown"
$repeatOut = Join-Path $runDir "repeat"

New-Item -ItemType Directory -Force -Path $evidenceRoot | Out-Null
New-Item -ItemType Directory -Force -Path $validOut | Out-Null
New-Item -ItemType Directory -Force -Path $unknownOut | Out-Null
New-Item -ItemType Directory -Force -Path $repeatOut | Out-Null

Set-Content -LiteralPath (Join-Path $evidenceRoot "changed_files.txt") -Value "docs/autopilot/REQUEST_MORE_PROTOCOL.md" -Encoding UTF8
Set-Content -LiteralPath (Join-Path $evidenceRoot "diff_stat.txt") -Value "1 file changed, 42 insertions(+)" -Encoding UTF8
Set-Content -LiteralPath (Join-Path $evidenceRoot "diff_excerpt.diff") -Value "+REQUEST_MORE targeted evidence only" -Encoding UTF8
Set-Content -LiteralPath (Join-Path $evidenceRoot "checks_summary.md") -Value "git diff --check: PASS" -Encoding UTF8
Set-Content -LiteralPath (Join-Path $evidenceRoot "patch.diff") -Value "diff --git a/secret b/secret" -Encoding UTF8

$valid = Invoke-RequestMoreHandler `
  -InputPath $validFixture `
  -Nonce $nonce `
  -MissionId "A4B_REQUEST_MORE_TEST" `
  -EvidenceRoot $evidenceRoot `
  -OutDir $validOut

$unknown = Invoke-RequestMoreHandler `
  -InputPath $unknownFixture `
  -Nonce $nonce `
  -MissionId "A4B_REQUEST_MORE_TEST" `
  -EvidenceRoot $evidenceRoot `
  -OutDir $unknownOut

$repeatState = Get-Content -LiteralPath $repeatStateFixture -Raw | ConvertFrom-Json
$repeat = Invoke-RequestMoreHandler `
  -InputPath $validFixture `
  -Nonce $nonce `
  -MissionId $repeatState.mission_id `
  -EvidenceRoot $evidenceRoot `
  -OutDir $repeatOut `
  -RequestMoreCount ([int]$repeatState.request_more_count)

$followupText = Get-Content -LiteralPath $valid.summary.followup_path -Raw
$expectedLines = Get-Content -LiteralPath $expectedFixture

Assert-True ($valid.exit_code -eq 0) "valid REQUEST_MORE fixture should pass"
Assert-True ($valid.summary.status -eq "pass") "valid REQUEST_MORE summary should pass"
Assert-True ($unknown.exit_code -ne 0) "unknown requested item should fail"
Assert-True ($unknown.summary.status -eq "fail") "unknown requested item summary should fail"
Assert-True ($repeat.exit_code -eq 2) "third REQUEST_MORE should return STOP_REQUIRED exit code"
Assert-True ($repeat.summary.status -eq "STOP_REQUIRED") "third REQUEST_MORE summary should be STOP_REQUIRED"
Assert-True (Test-Path -LiteralPath $valid.summary.followup_path) "follow-up digest should be created"
foreach ($line in $expectedLines) {
  Assert-True ($followupText.Contains($line)) "follow-up digest missing expected text: $line"
}
Assert-True ($followupText -notmatch 'diff --git a/secret b/secret') "full_patch must not be included unless requested"
Assert-True (-not [bool]$valid.summary.full_patch_included) "summary should report full_patch not included"
Assert-True (-not [bool]$valid.summary.live_chatgpt_called) "handler must not call live ChatGPT"
Assert-True (-not [bool]$valid.summary.browser_called) "handler must not call browser"
Assert-True (-not [bool]$valid.summary.codex_execution) "handler must not execute Codex"
Assert-True (-not [bool]$valid.summary.commit) "handler must not commit"
Assert-True (-not [bool]$valid.summary.push) "handler must not push"

$checks = [ordered]@{
  valid_request_more_passes = $true
  unknown_requested_item_fails = $true
  repeated_limit_triggers_stop_required = $true
  followup_digest_created = $true
  full_patch_not_included_unless_requested = $true
  no_live_chatgpt_call = $true
  no_browser_call = $true
  no_codex_execution = $true
}

$summary = [ordered]@{
  status = "pass"
  report_dir = $runDir
  valid = $valid.summary
  unknown = $unknown.summary
  repeated_limit = $repeat.summary
  checks = $checks
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "request_more_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10

exit 0
