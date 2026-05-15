param(
  [string]$RunRoot = ""
)

$ErrorActionPreference = "Continue"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
if (-not $RunRoot) {
  $preferred = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\supervisor_protocol_tests"
  try {
    New-Item -ItemType Directory -Force -Path $preferred | Out-Null
    $RunRoot = $preferred
  } catch {
    $RunRoot = Join-Path $repoRoot "ops\autopilot\reports\generated\supervisor_protocol_tests"
  }
}

$runDir = Join-Path $RunRoot (Get-Date -Format "yyyyMMdd_HHmmss")
New-Item -ItemType Directory -Force -Path $runDir | Out-Null
$nonce = "TEST_NONCE_123"
$validate = Join-Path $PSScriptRoot "validate_supervisor_response.ps1"
$extract = Join-Path $PSScriptRoot "extract_supervisor_response.ps1"

function Invoke-ProtocolCase {
  param(
    [string]$Name,
    [string]$Fixture,
    [int]$ExpectedExit,
    [string]$ExpectedReason = "",
    [string]$Command = "validate"
  )
  $caseDir = Join-Path $runDir $Name
  New-Item -ItemType Directory -Force -Path $caseDir | Out-Null
  $script = if ($Command -eq "extract") { $extract } else { $validate }
  $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $script -InputPath $Fixture -Nonce $nonce -OutDir $caseDir 2>&1
  $exitCode = $LASTEXITCODE
  $outputText = ($output -join "`n")
  Set-Content -LiteralPath (Join-Path $caseDir "stdout.txt") -Value $outputText -Encoding UTF8

  $ok = ($exitCode -eq $ExpectedExit)
  if ($ExpectedReason -and $outputText -notmatch [regex]::Escape($ExpectedReason)) {
    $ok = $false
  }
  return [ordered]@{
    name = $Name
    expected_exit = $ExpectedExit
    exit_code = $exitCode
    expected_reason = $ExpectedReason
    pass = $ok
    fixture = $Fixture
  }
}

$fixtures = Join-Path $PSScriptRoot "fixtures"
$results = @()
$results += Invoke-ProtocolCase -Name "valid_response" -Fixture (Join-Path $fixtures "supervisor_valid_response.txt") -ExpectedExit 0
$results += Invoke-ProtocolCase -Name "partial_missing_done" -Fixture (Join-Path $fixtures "supervisor_partial_response_missing_done.txt") -ExpectedExit 1 -ExpectedReason "missing DONE" -Command "extract"
$results += Invoke-ProtocolCase -Name "wrong_nonce" -Fixture (Join-Path $fixtures "supervisor_wrong_nonce.txt") -ExpectedExit 1 -ExpectedReason "wrong nonce" -Command "extract"
$results += Invoke-ProtocolCase -Name "broad_prompt" -Fixture (Join-Path $fixtures "supervisor_broad_prompt.txt") -ExpectedExit 1 -ExpectedReason "broad/vague language"
$results += Invoke-ProtocolCase -Name "stop_reason" -Fixture (Join-Path $fixtures "supervisor_stop_reason.txt") -ExpectedExit 0

$pass = -not ($results | Where-Object { -not $_.pass })
$summary = [ordered]@{
  status = if ($pass) { "PASS" } else { "FAIL" }
  run_dir = $runDir
  live_chatgpt_contacted = $false
  codex_execution = $false
  commit = $false
  push = $false
  cases = $results
}

$json = $summary | ConvertTo-Json -Depth 12
Set-Content -LiteralPath (Join-Path $runDir "summary.json") -Value $json -Encoding UTF8
$json
exit $(if ($pass) { 0 } else { 1 })
