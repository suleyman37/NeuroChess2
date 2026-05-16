$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-JsonCommand {
  param([string[]]$Arguments)
  $output = & powershell -NoProfile -ExecutionPolicy Bypass @Arguments 2>&1
  $code = $LASTEXITCODE
  $raw = ($output -join "`n")
  return [pscustomobject]@{
    exit_code = $code
    output = $raw
    json = if ($raw) { ($raw | ConvertFrom-Json) } else { $null }
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\gemini_auditor_tests" (Get-Date -Format "yyyyMMdd_HHmmss")
$fixtureRoot = Join-Path $PSScriptRoot "fixtures"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$validator = Join-Path $PSScriptRoot "validate_gemini_audit_response.ps1"
$decisionScript = Join-Path $PSScriptRoot "apply_gemini_audit_decision.ps1"
$packetBuilder = Join-Path $PSScriptRoot "build_gemini_audit_packet.ps1"
$nonce = "A16G_TEST_NONCE"

function Validate-Fixture {
  param([string]$Name)
  return Invoke-JsonCommand -Arguments @("-File", $validator, "-InputPath", (Join-Path $fixtureRoot $Name), "-Nonce", $nonce)
}

$approve = Validate-Fixture "gemini_prompt_audit_approve.txt"
$narrow = Validate-Fixture "gemini_prompt_audit_narrow.txt"
$reject = Validate-Fixture "gemini_prompt_audit_reject.txt"
$quarantine = Validate-Fixture "gemini_prompt_audit_quarantine.txt"
$visualPass = Validate-Fixture "gemini_visual_pass.txt"
$visualWarning = Validate-Fixture "gemini_visual_warning.txt"
$visualBlock = Validate-Fixture "gemini_visual_block.txt"
$longReport = Validate-Fixture "gemini_long_horizon_report.txt"
$missingDone = Validate-Fixture "gemini_invalid_missing_done.txt"
$badPrompt = Validate-Fixture "gemini_invalid_gives_codex_prompt.txt"

$tooManyFindingsPath = Join-Path $runDir "gemini_invalid_too_many_findings.txt"
@"
<NC_GEMINI_AUDIT nonce="$nonce">
<MODE>prompt_auditor</MODE>
<VERDICT>NARROW</VERDICT>
<SCORES>
scope_risk: 3
product_value: 2
safety_risk: 2
automation_drift_risk: 2
confidence: 0.7
</SCORES>
<FINDINGS>
- one
- two
- three
- four
- five
- six
</FINDINGS>
<REQUIRED_ACTION>
narrow_prompt
</REQUIRED_ACTION>
<MUST_NOT_DO>
Do not execute.
</MUST_NOT_DO>
<NC_DONE nonce="$nonce">DONE</NC_DONE>
</NC_GEMINI_AUDIT>
"@ | Set-Content -LiteralPath $tooManyFindingsPath -Encoding UTF8
$tooManyFindings = Invoke-JsonCommand -Arguments @("-File", $validator, "-InputPath", $tooManyFindingsPath, "-Nonce", $nonce)

$narrowValidatedPath = Join-Path $runDir "gemini_narrow_validated.json"
$rejectValidatedPath = Join-Path $runDir "gemini_reject_validated.json"
$quarantineValidatedPath = Join-Path $runDir "gemini_quarantine_validated.json"
$blockValidatedPath = Join-Path $runDir "gemini_visual_block_validated.json"
$narrow.output | Set-Content -LiteralPath $narrowValidatedPath -Encoding UTF8
$reject.output | Set-Content -LiteralPath $rejectValidatedPath -Encoding UTF8
$quarantine.output | Set-Content -LiteralPath $quarantineValidatedPath -Encoding UTF8
$visualBlock.output | Set-Content -LiteralPath $blockValidatedPath -Encoding UTF8

$narrowDecision = Invoke-JsonCommand -Arguments @("-File", $decisionScript, "-InputPath", $narrowValidatedPath)
$rejectDecision = Invoke-JsonCommand -Arguments @("-File", $decisionScript, "-InputPath", $rejectValidatedPath)
$quarantineDecision = Invoke-JsonCommand -Arguments @("-File", $decisionScript, "-InputPath", $quarantineValidatedPath)
$blockDecision = Invoke-JsonCommand -Arguments @("-File", $decisionScript, "-InputPath", $blockValidatedPath)

$promptPacketPath = Join-Path $runDir "gemini_prompt_packet.json"
$promptPacket = Invoke-JsonCommand -Arguments @("-File", $packetBuilder, "-Mode", "prompt_auditor", "-InputPath", (Join-Path $fixtureRoot "gemini_audit_packet_prompt_example.json"), "-OutPath", $promptPacketPath, "-Nonce", $nonce)
$visualPacketPath = Join-Path $runDir "gemini_visual_packet.json"
$visualPacket = Invoke-JsonCommand -Arguments @("-File", $packetBuilder, "-Mode", "visual_court", "-InputPath", (Join-Path $fixtureRoot "gemini_audit_packet_visual_example.json"), "-OutPath", $visualPacketPath, "-Nonce", $nonce)
$promptPacketRaw = Get-Content -LiteralPath $promptPacketPath -Raw
$visualPacketRaw = Get-Content -LiteralPath $visualPacketPath -Raw

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
$docsRebuildDirty = (git -C $repoRoot status --short docs/rebuild)
$productDirty = (git -C $repoRoot status --short frontend backend plan package.json package-lock.json App.tsx)
$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

Assert-True ($approve.exit_code -eq 0 -and $approve.json.verdict -eq "APPROVE") "valid prompt audit APPROVE should parse"
Assert-True ($narrow.exit_code -eq 0 -and $narrow.json.verdict -eq "NARROW") "valid prompt audit NARROW should parse"
Assert-True ($reject.exit_code -eq 0 -and $reject.json.verdict -eq "REJECT") "valid prompt audit REJECT should parse"
Assert-True ($quarantine.exit_code -eq 0 -and $quarantine.json.verdict -eq "QUARANTINE") "valid prompt audit QUARANTINE should parse"
Assert-True ($visualPass.exit_code -eq 0 -and $visualPass.json.verdict -eq "PASS_VISUAL") "valid visual PASS should parse"
Assert-True ($visualWarning.exit_code -eq 0 -and $visualWarning.json.verdict -eq "WARNING_VISUAL") "valid visual WARNING should parse"
Assert-True ($visualBlock.exit_code -eq 0 -and $visualBlock.json.verdict -eq "BLOCK_VISUAL") "valid visual BLOCK should parse"
Assert-True ($longReport.exit_code -eq 0 -and $longReport.json.verdict -eq "REPORT_ONLY") "long-horizon REPORT_ONLY should parse"
Assert-True ($missingDone.exit_code -ne 0 -and (($missingDone.json.violations -join "`n") -match "NC_DONE")) "missing DONE should fail"
Assert-True ($badPrompt.exit_code -ne 0 -and (($badPrompt.json.violations -join "`n") -match "MICRO_PROMPT")) "MICRO_PROMPT content should fail"
Assert-True ($badPrompt.exit_code -ne 0 -and (($badPrompt.json.violations -join "`n") -match "codex_prompt")) "codex_prompt content should fail"
Assert-True ($tooManyFindings.exit_code -ne 0 -and (($tooManyFindings.json.violations -join "`n") -match "findings")) "findings over 5 should fail"
Assert-True ($narrowDecision.json.control_plane_action -eq "REQUEST_PLANNER_NARROWING") "NARROW should map to planner narrowing"
Assert-True ($rejectDecision.json.control_plane_action -eq "STOP_FOR_STRATEGIC_PULSE") "REJECT should map to Strategic Pulse stop"
Assert-True ($quarantineDecision.json.control_plane_action -eq "QUARANTINE_REQUIRED") "QUARANTINE should map to quarantine"
Assert-True ($blockDecision.json.control_plane_action -eq "BLOCK_VISUAL_REWORK") "BLOCK_VISUAL should map to visual rework"
Assert-True ($promptPacket.exit_code -eq 0 -and $promptPacketRaw -notmatch "https://chatgpt\.com") "audit packet builder should exclude local project URL"
Assert-True ($visualPacket.exit_code -eq 0 -and $visualPacketRaw -notmatch "raw_dom|dom_dump") "audit packet builder should exclude raw DOM"
Assert-True (-not [bool]$state.gemini_auditor_enabled) "Gemini Auditor live enforcement must remain disabled"
Assert-True (-not [bool]$state.gemini_live_bridge_enabled) "Gemini live bridge must remain disabled"
Assert-True ([bool]$state.gemini_visual_court_available) "Gemini Visual Court should be available"
Assert-True ([bool]$state.gemini_prompt_auditor_available) "Gemini Prompt Auditor should be available"
Assert-True ([bool]$state.gemini_long_horizon_critic_available) "Gemini Long-Horizon Critic should be available"
Assert-True (-not [bool]$state.gemini_can_generate_codex_prompts) "Gemini must not generate Codex prompts"
Assert-True ($docsRebuildDirty.Count -eq 0) "docs/rebuild must not be touched by tests"
Assert-True ($productDirty.Count -eq 0) "frontend/backend/plan/package/App.tsx must not be touched by tests"
Assert-True ($endBranch -eq $startBranch) "test should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "test should leave HEAD unchanged"

$summary = [ordered]@{
  status = "pass"
  report_dir = $runDir
  start_branch = $startBranch
  end_branch = $endBranch
  start_head = $startHead
  end_head = $endHead
  checks = [ordered]@{
    prompt_approve_parses = "PASS"
    prompt_narrow_parses = "PASS"
    prompt_reject_parses = "PASS"
    prompt_quarantine_parses = "PASS"
    visual_pass_parses = "PASS"
    visual_warning_parses = "PASS"
    visual_block_parses = "PASS"
    long_horizon_report_only_parses = "PASS"
    missing_done_fails = "PASS"
    micro_prompt_fails = "PASS"
    codex_prompt_fails = "PASS"
    findings_limit_fails = "PASS"
    decision_mapping = "PASS"
    audit_packet_excludes_project_url = "PASS"
    no_live_gemini_call = $true
    no_live_chatgpt_call = $true
    no_product_mission = $true
    no_frontend_backend_docs_rebuild_touched = $true
  }
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "gemini_auditor_protocol_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10
exit 0
