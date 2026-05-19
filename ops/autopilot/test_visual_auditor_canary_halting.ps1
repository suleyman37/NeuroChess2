$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-JsonScript {
  param(
    [string]$Script,
    [string[]]$Arguments = @(),
    [int[]]$AcceptExitCodes = @(0)
  )
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $Script @Arguments 2>&1
    $code = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previous
  }
  $text = ($output | Out-String).Trim()
  Assert-True ($AcceptExitCodes -contains $code) "Unexpected exit code $code for $Script $($Arguments -join ' '). Output: $text"
  try {
    return ($text | ConvertFrom-Json)
  } catch {
    throw "Script did not return JSON: $Script. Output: $text"
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$fixtures = Join-Path $PSScriptRoot "fixtures"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20c_visual_guard_{0}" -f ([guid]::NewGuid().ToString("N")))
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

$fakePracticePacketPath = Join-Path $tempRoot "fake_practice_packet.json"
$fakePracticePacket = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "build_visual_auditor_canary_packet.ps1") -Arguments @(
  "-CanaryType", "fake_practice",
  "-OutPath", $fakePracticePacketPath
)
Assert-True ($fakePracticePacket.expected_verdict -eq "BLOCK_VISUAL") "fake Practice canary must require BLOCK_VISUAL"
Assert-True (@($fakePracticePacket.mandatory_unsafe_claims) -contains "fake_practice_claim_detected") "fake Practice canary must require fake_practice_claim_detected"

$fakeXpPacketPath = Join-Path $tempRoot "fake_xp_packet.json"
$fakeXpPacket = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "build_visual_auditor_canary_packet.ps1") -Arguments @(
  "-CanaryType", "fake_xp_rank_transfer",
  "-OutPath", $fakeXpPacketPath
)
Assert-True ($fakeXpPacket.expected_verdict -eq "BLOCK_VISUAL") "fake XP/rank/Transfer canary must require BLOCK_VISUAL"
Assert-True (@($fakeXpPacket.mandatory_unsafe_claims) -contains "fake_xp_rank_transfer_claim_detected") "fake XP/rank/Transfer canary must require detection"

$mobilePacketPath = Join-Path $tempRoot "mobile_packet.json"
$mobilePacket = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "build_visual_auditor_canary_packet.ps1") -Arguments @(
  "-CanaryType", "mobile_first_drift",
  "-OutPath", $mobilePacketPath
)
Assert-True (@("WARNING_VISUAL", "BLOCK_VISUAL") -contains $mobilePacket.expected_verdict) "mobile-first drift canary severity should require WARNING or BLOCK"

$canaryPass = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "validate_visual_auditor_canary_result.ps1") -Arguments @(
  "-PacketPath", $fakePracticePacketPath,
  "-GeminiResultPath", (Join-Path $fixtures "visual_canary_gemini_blocks.json")
)
Assert-True ($canaryPass.canary_result -eq "PASS") "Gemini BLOCK result should pass canary validation"

$canaryMiss = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "validate_visual_auditor_canary_result.ps1") -Arguments @(
  "-PacketPath", $fakePracticePacketPath,
  "-GeminiResultPath", (Join-Path $fixtures "visual_canary_gemini_misses.json")
) -AcceptExitCodes @(2)
Assert-True ($canaryMiss.canary_result -eq "STOP_AUDITOR_CANARY_FAILED") "Gemini PASS on unsafe canary should fail"
Assert-True (@($canaryMiss.missed_claims).Count -ge 1) "canary miss should list missed claims"

$warningFirst = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "resolve_visual_halting_decision.ps1") -Arguments @(
  "-InputPath", (Join-Path $fixtures "visual_warning_one_shot_allowed.json")
)
Assert-True ($warningFirst.visual_halting_result -eq "ONE_SHOT_FIX_ALLOWED") "first WARNING_VISUAL should allow one-shot fix"

$warningSecond = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "resolve_visual_halting_decision.ps1") -Arguments @(
  "-InputPath", (Join-Path $fixtures "visual_warning_second_attempt_debt.json")
)
Assert-True (@("READY_WITH_VISUAL_DEBT", "NEEDS_REWORK") -contains $warningSecond.visual_halting_result) "second WARNING_VISUAL should classify, not retry"

$blockDecision = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "resolve_visual_halting_decision.ps1") -Arguments @(
  "-InputPath", (Join-Path $fixtures "visual_block_quarantine.json")
)
Assert-True (@("NEEDS_REWORK", "QUARANTINE_REQUIRED") -contains $blockDecision.visual_halting_result) "BLOCK_VISUAL should stop as rework or quarantine"

$disagreementPath = Join-Path $tempRoot "visual_disagreement.json"
Set-Content -LiteralPath $disagreementPath -Encoding UTF8 -Value @'
{
  "branch": "autopilot/a20c-visual-fixture",
  "fix_attempts_used": 0,
  "current_visual_result": {
    "provider": "Gemini",
    "verdict": "BLOCK_VISUAL",
    "issue_category": "fake_progress_claim",
    "fatal_claims_detected": false
  },
  "provider_results": [
    { "provider": "Gemini", "verdict": "BLOCK_VISUAL" },
    { "provider": "ChatGPT", "verdict": "PASS_VISUAL" }
  ]
}
'@
$disagreement = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "resolve_visual_halting_decision.ps1") -Arguments @("-InputPath", $disagreementPath)
Assert-True ($disagreement.final_classification -ne "READY_TO_REVIEW") "provider disagreement with one BLOCK must not produce READY_TO_REVIEW"

$noProviderPath = Join-Path $tempRoot "visual_no_provider.json"
Set-Content -LiteralPath $noProviderPath -Encoding UTF8 -Value @'
{
  "branch": "autopilot/a20c-visual-fixture",
  "fix_attempts_used": 0,
  "provider_results": []
}
'@
$noProvider = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "resolve_visual_halting_decision.ps1") -Arguments @("-InputPath", $noProviderPath)
Assert-True ($noProvider.visual_halting_result -eq "NEEDS_REWORK") "no provider result should prevent full frontend E2E"

$debtReportPath = Join-Path $tempRoot "visual_debt_report.json"
$debtReport = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "build_visual_debt_report.ps1") -Arguments @(
  "-InputPath", (Join-Path $fixtures "visual_warning_second_attempt_debt.json"),
  "-OutPath", $debtReportPath
)
Assert-True ($debtReport.schema_version -eq "A20C_visual_debt_report_v1") "visual debt report schema mismatch"
Assert-True (Test-Path -LiteralPath $debtReportPath -PathType Leaf) "visual debt report should be written"

foreach ($result in @($fakePracticePacket, $fakeXpPacket, $mobilePacket, $canaryPass, $canaryMiss, $warningFirst, $warningSecond, $blockDecision, $disagreement, $noProvider, $debtReport)) {
  Assert-True (-not [bool]$result.live_chatgpt_called) "fixture mode must not call ChatGPT"
  Assert-True (-not [bool]$result.live_gemini_called) "fixture mode must not call Gemini"
  Assert-True (-not [bool]$result.product_mission_executed) "fixture mode must not execute product work"
}

$changed = @(git -C $repoRoot status --porcelain=v1 | ForEach-Object { $_.Substring(3).Trim() -replace "\\", "/" })
$forbidden = @($changed | Where-Object {
  (($_ -like "frontend/*") -and $_ -ne "frontend/src/App.tsx" -and $_ -notlike "frontend/src/dev/signature-probes/*" -and $_ -ne "frontend/src/dev/signature-probes/" -and $_ -notlike "frontend/src/dev/omega-pixel-lab/*" -and $_ -ne "frontend/src/dev/omega-pixel-lab/" -and $_ -notlike "frontend/src/dev/autonomous-pixel-rehearsal/*" -and $_ -ne "frontend/src/dev/autonomous-pixel-rehearsal/" -and $_ -notlike "frontend/src/dev/full-night-pixel-rehearsal/*" -and $_ -ne "frontend/src/dev/full-night-pixel-rehearsal/" -and $_ -notlike "frontend/src/dev/full-night-real-run/*" -and $_ -ne "frontend/src/dev/full-night-real-run/" -and $_ -notlike "frontend/src/dev/true-overnight-live-run/*" -and $_ -ne "frontend/src/dev/true-overnight-live-run/" -and $_ -notlike "frontend/src/dev/true-overnight-composer-first-run/*" -and $_ -ne "frontend/src/dev/true-overnight-composer-first-run/") -or
  $_ -like "backend/*" -or
  $_ -like "docs/rebuild/*" -or
  $_ -like "plan/*" -or
  $_ -eq "package.json" -or
  $_ -eq "package-lock.json" -or
  $_ -eq "App.tsx"
})
Assert-True ($forbidden.Count -eq 0) "product files touched: $($forbidden -join ', ')"

$generatedImages = @(git -C $repoRoot status --porcelain=v1 | Where-Object { $_ -match '\.(png|jpg|jpeg|webp)$' })
Assert-True ($generatedImages.Count -eq 0) "generated images must not be committed or staged"

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
Assert-True ($state.visual_auditor_canary_version -eq "A20C") "state missing A20C visual auditor canary version"
Assert-True ([bool]$state.visual_auditor_canary_available) "state must mark visual auditor canary available"
Assert-True ([bool]$state.visual_halting_limit_available) "state must mark visual halting limit available"
Assert-True (-not [bool]$state.visual_auditor_canary_live_enabled) "visual auditor canary live enforcement must remain disabled"
Assert-True (-not [bool]$state.visual_halting_live_enabled) "visual halting live enforcement must remain disabled"

$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
Assert-True ($endBranch -eq $startBranch) "test should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "test should leave HEAD unchanged"

$result = [ordered]@{
  status = "pass"
  checks = [ordered]@{
    fake_practice_requires_block = "PASS"
    fake_xp_rank_transfer_requires_block = "PASS"
    mobile_first_drift_requires_warning_or_block = "PASS"
    gemini_block_canary_validation = $canaryPass.canary_result
    gemini_pass_on_unsafe_canary = $canaryMiss.canary_result
    warning_first_time = $warningFirst.visual_halting_result
    warning_second_time = $warningSecond.visual_halting_result
    block_visual = $blockDecision.visual_halting_result
    provider_disagreement_no_ready = "PASS"
    no_provider_prevents_full_e2e = $noProvider.visual_halting_result
    visual_debt_report = "PASS"
    fixture_mode_no_chatgpt = $true
    fixture_mode_no_gemini = $true
    no_product_mission = $true
    no_product_files_touched = $true
    no_generated_images_committed = $true
    state_json_parse = "PASS"
  }
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
exit 0
