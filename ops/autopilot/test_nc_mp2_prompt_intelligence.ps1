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
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\nc_mp2_tests" (Get-Date -Format "yyyyMMdd_HHmmss")
$fixtureRoot = Join-Path $PSScriptRoot "fixtures"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$parseScript = Join-Path $PSScriptRoot "parse_nc_mp2.ps1"
$normalizeScript = Join-Path $PSScriptRoot "normalize_nc_mp2.ps1"
$lintScript = Join-Path $PSScriptRoot "lint_nc_mp2.ps1"
$convertScript = Join-Path $PSScriptRoot "convert_micro_prompt_to_nc_mp2.ps1"

$validDocsParse = Invoke-JsonCommand -Arguments @("-File", $parseScript, "-InputPath", (Join-Path $fixtureRoot "nc_mp2_valid_docs_only.txt"))
$validDocsLint = Invoke-JsonCommand -Arguments @("-File", $lintScript, "-InputPath", (Join-Path $fixtureRoot "nc_mp2_valid_docs_only.txt"))
$validBackendParse = Invoke-JsonCommand -Arguments @("-File", $parseScript, "-InputPath", (Join-Path $fixtureRoot "nc_mp2_valid_backend_readonly_branch.txt"))
$validBackendLint = Invoke-JsonCommand -Arguments @("-File", $lintScript, "-InputPath", (Join-Path $fixtureRoot "nc_mp2_valid_backend_readonly_branch.txt"))

$missingAllow = Invoke-JsonCommand -Arguments @("-File", $lintScript, "-InputPath", (Join-Path $fixtureRoot "nc_mp2_invalid_missing_allow.txt"))
$broad = Invoke-JsonCommand -Arguments @("-File", $lintScript, "-InputPath", (Join-Path $fixtureRoot "nc_mp2_invalid_broad_language.txt"))
$redTier = Invoke-JsonCommand -Arguments @("-File", $lintScript, "-InputPath", (Join-Path $fixtureRoot "nc_mp2_invalid_red_tier_outside_quarantine.txt"))
$mix = Invoke-JsonCommand -Arguments @("-File", $lintScript, "-InputPath", (Join-Path $fixtureRoot "nc_mp2_invalid_frontend_backend_mix.txt"))

$converted = Invoke-JsonCommand -Arguments @("-File", $convertScript, "-InputPath", (Join-Path $fixtureRoot "micro_prompt_verbose_valid.txt"))
$convertedLint = Invoke-JsonCommand -Arguments @("-File", $lintScript, "-RawText", ([string]$converted.json.nc_mp2_text))
$invalidConvert = Invoke-JsonCommand -Arguments @("-File", $convertScript, "-InputPath", (Join-Path $fixtureRoot "micro_prompt_verbose_invalid_too_broad.txt"))

$normalA = Invoke-JsonCommand -Arguments @("-File", $normalizeScript, "-InputPath", (Join-Path $fixtureRoot "nc_mp2_valid_docs_only.txt"))
$variant = @"
NC-MP/2
id= A16C_DOCS_ONLY_VALID
tier= GREEN
type=docs-only
goal=nc_mp2_docs_protocol_fixture
allow=docs\autopilot\NC_MP2_COMPACT_MISSION_PROTOCOL.md
deny=.venv/**,qa_artifacts/**,.serena/**,App.tsx,package-lock.json,package.json,plan/**,frontend/**,backend/**
max_files=1
max_diff=300
checks= git diff --check
stop=contract_mismatch,missing_check,diff_over,max_files,forbidden_path
commit=explicit_file_only
intent=Create only   the compact mission protocol document. No code execution. No product work.
DONE
"@
$normalB = Invoke-JsonCommand -Arguments @("-File", $normalizeScript, "-RawText", $variant)

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
$docsRebuildDirty = (git -C $repoRoot status --short docs/rebuild)
$productDirty = (git -C $repoRoot status --short frontend backend plan package.json package-lock.json App.tsx)
$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

Assert-True ($validDocsParse.exit_code -eq 0 -and [bool]$validDocsParse.json.valid_parse) "valid docs-only NC-MP/2 should parse"
Assert-True ($validDocsLint.exit_code -eq 0 -and $validDocsLint.json.lint_result -eq "PASS") "valid docs-only NC-MP/2 should lint PASS"
Assert-True ($validBackendParse.exit_code -eq 0 -and [bool]$validBackendParse.json.valid_parse) "valid backend-readonly NC-MP/2 should parse"
Assert-True ($validBackendLint.exit_code -eq 0 -and $validBackendLint.json.lint_result -eq "PASS") "valid backend-readonly branch NC-MP/2 should lint PASS"
Assert-True ($missingAllow.exit_code -ne 0 -and (($missingAllow.json.violations -join "`n") -match "allow")) "missing allow should fail"
Assert-True ($broad.exit_code -ne 0 -and (($broad.json.violations -join "`n") -match "broad")) "broad language should fail"
Assert-True ($redTier.exit_code -ne 0 -and (($redTier.json.violations -join "`n") -match "red-tier")) "red-tier terms outside quarantine should fail"
Assert-True ($mix.exit_code -ne 0 -and (($mix.json.violations -join "`n") -match "mixed frontend/backend")) "frontend/backend mix should fail"
Assert-True ($converted.exit_code -eq 0 -and [bool]$converted.json.converted) "verbose MICRO_PROMPT should convert"
Assert-True ($convertedLint.exit_code -eq 0 -and $convertedLint.json.lint_result -eq "PASS") "converted verbose MICRO_PROMPT should lint PASS"
Assert-True ($invalidConvert.exit_code -ne 0 -and -not [bool]$invalidConvert.json.converted) "invalid verbose MICRO_PROMPT conversion should fail"
Assert-True ($normalA.exit_code -eq 0 -and $normalB.exit_code -eq 0) "normalization should run"
Assert-True (($normalA.json.fields | ConvertTo-Json -Compress -Depth 20) -eq ($normalB.json.fields | ConvertTo-Json -Compress -Depth 20)) "normalized NC-MP/2 should be stable under whitespace changes"
Assert-True (-not [bool]$state.nc_mp2_enabled) "NC-MP/2 live enforcement must remain disabled"
Assert-True (-not [bool]$state.prompt_linter_enabled) "prompt linter live enforcement must remain disabled"
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
    valid_docs_only_parses_and_lints = "PASS"
    valid_backend_readonly_parses_and_lints = "PASS"
    missing_allow_fails = "PASS"
    broad_language_fails = "PASS"
    red_tier_terms_fail = "PASS"
    frontend_backend_mix_fails = "PASS"
    verbose_micro_prompt_converts = "PASS"
    invalid_verbose_micro_prompt_fails = "PASS"
    normalization_stable_under_whitespace = "PASS"
    no_live_chatgpt_call = $true
    no_product_mission = $true
    no_frontend_backend_docs_rebuild_touched = $true
  }
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "nc_mp2_prompt_intelligence_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10
exit 0
