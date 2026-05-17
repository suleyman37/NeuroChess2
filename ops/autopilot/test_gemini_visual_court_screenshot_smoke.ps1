$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-JsonCommand {
  param([string[]]$Arguments, [int[]]$ExpectedExitCodes = @(0))
  $output = & powershell -NoProfile -ExecutionPolicy Bypass @Arguments 2>&1
  $code = $LASTEXITCODE
  $raw = ($output -join "`n")
  Assert-True ($ExpectedExitCodes -contains $code) "Unexpected exit code $code. Output: $raw"
  return [pscustomobject]@{
    exit_code = $code
    output = $raw
    json = if ($raw) { ($raw | ConvertFrom-Json) } else { $null }
  }
}

function Copy-FixtureWithNonce {
  param([string]$Name, [string]$Nonce, [string]$OutPath)
  $text = Get-Content -LiteralPath (Join-Path $fixtureRoot $Name) -Raw
  $text = $text -replace "THE_NONCE|\{\{NONCE\}\}|A16H_TEST_NONCE", $Nonce
  Set-Content -LiteralPath $OutPath -Value $text -Encoding UTF8
  return $OutPath
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\gemini_visual_smoke_tests" (Get-Date -Format "yyyyMMdd_HHmmss")
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$fixtureRoot = Join-Path $PSScriptRoot "fixtures"
$nonce = "A18F_TEST_NONCE"
$visualCode = "NC_GEM_VIS_TEST"
$bridgePath = Join-Path $PSScriptRoot "browser\gemini_bridge.mjs"
$askScript = Join-Path $PSScriptRoot "ask_gemini_web.ps1"
$validator = Join-Path $PSScriptRoot "validate_gemini_audit_response.ps1"
$contextBuilder = Join-Path $PSScriptRoot "build_gemini_visual_context_pack.ps1"
$briefBuilder = Join-Path $PSScriptRoot "build_gemini_visual_review_brief.ps1"
$imageBuilder = Join-Path $PSScriptRoot "create_gemini_visual_smoke_images.ps1"

$nodeCheck = & node --check $bridgePath 2>&1
Assert-True ($LASTEXITCODE -eq 0) "node --check failed: $($nodeCheck -join "`n")"

$imageResult = Invoke-JsonCommand -Arguments @("-File", $imageBuilder, "-OutDir", (Join-Path $runDir "images"), "-VisualCode", $visualCode)
Assert-True (Test-Path -LiteralPath $imageResult.json.safe_image_path) "safe smoke image should exist"
Assert-True (Test-Path -LiteralPath $imageResult.json.unsafe_image_path) "unsafe canary image should exist"
Assert-True ($imageResult.json.safe_image_path -like "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\gemini_visual_smoke_tests\*") "images must be external QA artifacts"

$contextResult = Invoke-JsonCommand -Arguments @("-File", $contextBuilder, "-OutPath", (Join-Path $runDir "gemini_visual_context_pack.md"), "-Nonce", $nonce)
$safeBrief = Invoke-JsonCommand -Arguments @("-File", $briefBuilder, "-Mode", "safe", "-OutPath", (Join-Path $runDir "safe_brief.json"), "-ScreenshotPath", $imageResult.json.safe_image_path, "-ExpectedVisualCode", $visualCode)
$unsafeBrief = Invoke-JsonCommand -Arguments @("-File", $briefBuilder, "-Mode", "unsafe", "-OutPath", (Join-Path $runDir "unsafe_brief.json"), "-ScreenshotPath", $imageResult.json.unsafe_image_path)
Assert-True (Test-Path -LiteralPath $contextResult.json.out_path) "context pack should exist"
Assert-True (Test-Path -LiteralPath $safeBrief.json.out_path) "safe brief should exist"
Assert-True (Test-Path -LiteralPath $unsafeBrief.json.out_path) "unsafe brief should exist"

$safeResponsePath = Copy-FixtureWithNonce -Name "gemini_visual_safe_response.json" -Nonce $nonce -OutPath (Join-Path $runDir "safe_response.json")
$blockResponsePath = Copy-FixtureWithNonce -Name "gemini_visual_block_response.json" -Nonce $nonce -OutPath (Join-Path $runDir "block_response.json")
$badPromptPath = Copy-FixtureWithNonce -Name "gemini_visual_invalid_codex_prompt.json" -Nonce $nonce -OutPath (Join-Path $runDir "bad_prompt_response.json")
$missingNoncePath = Copy-FixtureWithNonce -Name "gemini_visual_missing_nonce.json" -Nonce $nonce -OutPath (Join-Path $runDir "missing_nonce_response.json")

$safeValidation = Invoke-JsonCommand -Arguments @("-File", $validator, "-InputPath", $safeResponsePath, "-Nonce", $nonce, "-ExpectedVisualCode", $visualCode)
$blockValidation = Invoke-JsonCommand -Arguments @("-File", $validator, "-InputPath", $blockResponsePath, "-Nonce", $nonce, "-UnsafeVisualCanary")
$badPromptValidation = Invoke-JsonCommand -Arguments @("-File", $validator, "-InputPath", $badPromptPath, "-Nonce", $nonce, "-ExpectedVisualCode", $visualCode) -ExpectedExitCodes @(1)
$missingNonceValidation = Invoke-JsonCommand -Arguments @("-File", $validator, "-InputPath", $missingNoncePath, "-Nonce", $nonce, "-ExpectedVisualCode", $visualCode) -ExpectedExitCodes @(1)
Assert-True ($safeValidation.json.valid -and $safeValidation.json.verdict -eq "PASS_VISUAL") "safe visual fixture should validate"
Assert-True ($blockValidation.json.valid -and $blockValidation.json.verdict -eq "BLOCK_VISUAL") "unsafe visual canary fixture should validate as BLOCK_VISUAL"
Assert-True (($badPromptValidation.json.violations -join "`n") -match "codex_prompt") "codex_prompt response should fail"
Assert-True (($missingNonceValidation.json.violations -join "`n") -match "nonce|done") "missing nonce response should fail"

$dryRun = Invoke-JsonCommand -Arguments @("-File", $askScript, "-DryRun", "-Fixture", (Join-Path $fixtureRoot "gemini_visual_safe_response.json"), "-Nonce", $nonce, "-OutDir", (Join-Path $runDir "dry_run"))
Assert-True ($dryRun.json.status -eq "pass") "Gemini visual dry-run should pass"
Assert-True (-not [bool]$dryRun.json.browser_called) "dry-run must not call browser"
Assert-True (-not [bool]$dryRun.json.codex_execution) "dry-run must not execute Codex"
Assert-True (-not [bool]$dryRun.json.commit) "dry-run must not commit"
Assert-True (-not [bool]$dryRun.json.push) "dry-run must not push"

$bridgeSource = Get-Content -LiteralPath $bridgePath -Raw
$askSource = Get-Content -LiteralPath $askScript -Raw
Assert-True ($bridgeSource.Contains("setInputFiles")) "Gemini bridge should support screenshot upload"
Assert-True ($bridgeSource.Contains("imagesFile")) "Gemini bridge should accept image manifest"
Assert-True ($askSource.Contains("ImagePath")) "ask_gemini_web should expose ImagePath"
Assert-True ($bridgeSource -notmatch "(?i)chatgpt\.com|ChatGPTSupervisorChromeProfile|ask_chatgpt") "Gemini bridge must not call ChatGPT"
Assert-True ($bridgeSource -notmatch "(?is)codex_prompt\s*:") "Gemini bridge must not generate codex_prompt"

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
$docsRebuildDirty = (git -C $repoRoot status --short docs/rebuild)
$productDirty = (git -C $repoRoot status --short frontend backend plan package.json package-lock.json App.tsx)
$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

Assert-True (-not [bool]$state.gemini_auditor_live_enforcement_enabled) "Gemini live enforcement must remain disabled"
Assert-True ($docsRebuildDirty.Count -eq 0) "docs/rebuild must not be touched"
Assert-True ($productDirty.Count -eq 0) "frontend/backend/plan/package/App.tsx must not be touched"
Assert-True ($imageResult.json.safe_image_path -notlike "$repoRoot*") "safe generated image must remain outside repo"
Assert-True ($imageResult.json.unsafe_image_path -notlike "$repoRoot*") "unsafe generated image must remain outside repo"
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
    image_generation = "PASS"
    context_pack = "PASS"
    visual_review_briefs = "PASS"
    screenshot_upload_support = "PASS"
    safe_visual_validation = "PASS"
    unsafe_visual_canary_validation = "PASS"
    invalid_codex_prompt_rejected = "PASS"
    missing_nonce_rejected = "PASS"
    dry_run_pass = "PASS"
    no_live_chatgpt_call = $true
    no_live_gemini_call = $true
    no_product_mission = $true
    no_frontend_backend_docs_rebuild_touched = $true
    no_generated_images_committed = $true
    state_json_parse = "PASS"
  }
  safe_image_path = $imageResult.json.safe_image_path
  unsafe_image_path = $imageResult.json.unsafe_image_path
  visual_code = $visualCode
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "gemini_visual_court_screenshot_smoke_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10
exit 0
