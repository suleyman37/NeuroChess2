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

function Read-Json {
  param([string]$Path)
  return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Assert-ReferenceValid {
  param($Reference, [string]$ExpectedCorpus)
  Assert-True ($Reference.schema_version -eq "A20E_design_reference_v1") "reference schema mismatch"
  Assert-True ($Reference.corpus_type -eq $ExpectedCorpus) "reference corpus mismatch"
  Assert-True (-not [bool]$Reference.copyrighted_assets_stored) "reference must not store copyrighted assets"
  Assert-True (@($Reference.traits).Count -gt 0) "reference traits missing"
  Assert-True (@($Reference.neurochess_lessons).Count -gt 0) "reference NeuroChess lessons missing"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$fixtures = Join-Path $PSScriptRoot "fixtures"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20e_design_intelligence_{0}" -f ([guid]::NewGuid().ToString("N")))
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

$visualCorpusPath = Join-Path $tempRoot "visual_corpus.json"
$visualCorpus = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "build_design_reference_corpus.ps1") -Arguments @(
  "-CorpusType", "visual_atmosphere",
  "-OutPath", $visualCorpusPath
)
Assert-True ($visualCorpus.reference_count -ge 5) "visual atmosphere corpus should include seed references"
foreach ($reference in @($visualCorpus.references)) { Assert-ReferenceValid -Reference $reference -ExpectedCorpus "visual_atmosphere" }

$appCorpusPath = Join-Path $tempRoot "application_corpus.json"
$appCorpus = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "build_design_reference_corpus.ps1") -Arguments @(
  "-CorpusType", "application_ux",
  "-OutPath", $appCorpusPath
)
Assert-True ($appCorpus.reference_count -ge 3) "application UX corpus should include app references"
foreach ($reference in @($appCorpus.references)) { Assert-ReferenceValid -Reference $reference -ExpectedCorpus "application_ux" }

$oranoScore = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "score_design_reference.ps1") -Arguments @(
  "-ReferencePath", (Join-Path $fixtures "design_reference_orano.json")
)
Assert-True ($oranoScore.score_percent -gt 70) "Orano reference should be useful to NeuroChess"

$briefJsonPath = Join-Path $tempRoot "frontend_design_brief.json"
$briefMdPath = Join-Path $tempRoot "frontend_design_brief.md"
$brief = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "build_frontend_design_brief.ps1") -Arguments @(
  "-MissionPath", (Join-Path $fixtures "design_brief_frontend_readonly.json"),
  "-OutJsonPath", $briefJsonPath,
  "-OutMarkdownPath", $briefMdPath
)
Assert-True ($brief.schema_version -eq "A20E_design_brief_v1") "design brief schema mismatch"
Assert-True ($brief.desktop_target -match "1366|1440|1920") "desktop-first requirements missing"
Assert-True ($brief.board_role -match "central|board") "board-centered requirement missing"
Assert-True ($brief.position_artifact_role -match "artifact") "position-as-artifact concept missing"
Assert-True (($brief.forbidden_design_drift -join " ") -match "fake Practice") "fake Practice must be forbidden"
Assert-True (($brief.forbidden_design_drift -join " ") -match "XP/rank/Transfer") "XP/rank/Transfer must be forbidden"
Assert-True (Test-Path -LiteralPath $briefJsonPath -PathType Leaf) "brief JSON output missing"
Assert-True (Test-Path -LiteralPath $briefMdPath -PathType Leaf) "brief Markdown output missing"

$briefScore = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "score_frontend_design_brief.ps1") -Arguments @(
  "-BriefPath", $briefJsonPath
)
Assert-True (@("PASS", "WARN_GENERIC_SAAS_DRIFT") -contains $briefScore.design_brief_score_result) "good design brief should not reject"
Assert-True (@($briefScore.requirements_present) -contains "desktop_first") "desktop-first score requirement missing"
Assert-True (@($briefScore.requirements_present) -contains "board_centered") "board-centered score requirement missing"
Assert-True (@($briefScore.requirements_present) -contains "position_as_artifact") "position-as-artifact score requirement missing"

$badBriefScore = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "score_frontend_design_brief.ps1") -Arguments @(
  "-BriefPath", (Join-Path $fixtures "design_brief_bad_generic_saas.json")
)
Assert-True ($badBriefScore.design_brief_score_result -eq "WARN_GENERIC_SAAS_DRIFT") "bad generic SaaS brief should be flagged"

$rubricDoc = Get-Content -LiteralPath (Join-Path $repoRoot "docs/autopilot/NEUROCHESS_DESIGN_RUBRIC.md") -Raw
foreach ($criterion in @("Desktop-first fit", "Board-centered composition", "Position-as-artifact", "Decision clarity", "CTA truthfulness", "No fake gamification", "No generic SaaS drift")) {
  Assert-True ($rubricDoc -match [regex]::Escape($criterion)) "design rubric missing criterion: $criterion"
}

$northStarDoc = Get-Content -LiteralPath (Join-Path $repoRoot "docs/autopilot/NEUROCHESS_VISUAL_NORTH_STAR.md") -Raw
Assert-True ($northStarDoc -match "desktop strategic command center") "visual north star missing desktop command center"
Assert-True ($northStarDoc -match "Position as artifact") "visual north star missing artifact principle"

$positiveLedger = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "validate_visual_taste_ledger.ps1") -Arguments @(
  "-LedgerPath", (Join-Path $fixtures "visual_taste_ledger_positive.jsonl")
)
Assert-True ($positiveLedger.visual_taste_ledger_result -eq "PASS") "positive visual taste ledger fixture should validate"

$negativeLedger = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "validate_visual_taste_ledger.ps1") -Arguments @(
  "-LedgerPath", (Join-Path $fixtures "visual_taste_ledger_negative.jsonl")
)
Assert-True ($negativeLedger.visual_taste_ledger_result -eq "PASS") "negative visual taste ledger fixture should validate"

$ledgerPath = Join-Path $tempRoot "taste_ledger.jsonl"
$appendLedger = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "append_visual_taste_ledger.ps1") -Arguments @(
  "-LedgerPath", $ledgerPath,
  "-EntryJsonPath", (Join-Path $fixtures "visual_taste_ledger_positive.jsonl")
)
Assert-True ($appendLedger.append_result -eq "PASS") "append visual taste ledger should pass"
$appendedLedger = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "validate_visual_taste_ledger.ps1") -Arguments @("-LedgerPath", $ledgerPath)
Assert-True ($appendedLedger.visual_taste_ledger_result -eq "PASS") "appended visual taste ledger should validate"

foreach ($result in @($visualCorpus, $appCorpus, $oranoScore, $brief, $briefScore, $badBriefScore, $positiveLedger, $negativeLedger, $appendLedger, $appendedLedger)) {
  Assert-True (-not [bool]$result.live_chatgpt_called) "fixture mode must not call ChatGPT"
  Assert-True (-not [bool]$result.live_gemini_called) "fixture mode must not call Gemini"
  Assert-True (-not [bool]$result.product_mission_executed) "fixture mode must not execute product work"
}

$changed = @(git -C $repoRoot status --porcelain=v1 | ForEach-Object { $_.Substring(3).Trim() -replace "\\", "/" })
$forbidden = @($changed | Where-Object {
  (($_ -like "frontend/*") -and $_ -ne "frontend/src/App.tsx" -and $_ -notlike "frontend/src/dev/signature-probes/*" -and $_ -ne "frontend/src/dev/signature-probes/" -and $_ -notlike "frontend/src/dev/omega-pixel-lab/*" -and $_ -ne "frontend/src/dev/omega-pixel-lab/" -and $_ -notlike "frontend/src/dev/autonomous-pixel-rehearsal/*" -and $_ -ne "frontend/src/dev/autonomous-pixel-rehearsal/" -and $_ -notlike "frontend/src/dev/full-night-pixel-rehearsal/*" -and $_ -ne "frontend/src/dev/full-night-pixel-rehearsal/" -and $_ -notlike "frontend/src/dev/full-night-real-run/*" -and $_ -ne "frontend/src/dev/full-night-real-run/") -or
  $_ -like "backend/*" -or
  $_ -like "docs/rebuild/*" -or
  $_ -like "plan/*" -or
  $_ -eq "package.json" -or
  $_ -eq "package-lock.json" -or
  $_ -eq "App.tsx"
})
Assert-True ($forbidden.Count -eq 0) "product files touched: $($forbidden -join ', ')"

$imageLike = @(git -C $repoRoot status --porcelain=v1 | Where-Object { $_ -match '\.(png|jpg|jpeg|gif|webp|avif|svg)$' })
Assert-True ($imageLike.Count -eq 0) "copyrighted image/assets must not be committed: $($imageLike -join ', ')"

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
Assert-True ($state.design_intelligence_layer_version -eq "A20E") "state missing A20E design intelligence version"
Assert-True ([bool]$state.visual_reference_corpus_available) "state must mark visual reference corpus available"
Assert-True ([bool]$state.application_ux_reference_corpus_available) "state must mark application UX corpus available"
Assert-True ([bool]$state.frontend_design_brief_compiler_available) "state must mark frontend design brief compiler available"
Assert-True ([bool]$state.visual_taste_ledger_available) "state must mark visual taste ledger available"
Assert-True (-not [bool]$state.design_intelligence_live_enforced) "design intelligence live enforcement must remain disabled"

$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
Assert-True ($endBranch -eq $startBranch) "test should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "test should leave HEAD unchanged"

$result = [ordered]@{
  status = "pass"
  checks = [ordered]@{
    visual_atmosphere_corpus = "PASS"
    application_ux_corpus = "PASS"
    design_brief_fixture = "PASS"
    bad_generic_saas_flagged = $badBriefScore.design_brief_score_result
    desktop_first_requirements = "PASS"
    board_centered_requirement = "PASS"
    position_artifact_concept = "PASS"
    fake_progress_forbidden = "PASS"
    design_rubric_required_criteria = "PASS"
    frontend_design_brief_compiler = "PASS"
    visual_taste_ledger_positive = $positiveLedger.visual_taste_ledger_result
    visual_taste_ledger_negative = $negativeLedger.visual_taste_ledger_result
    fixture_mode_no_chatgpt = $true
    fixture_mode_no_gemini = $true
    no_product_mission = $true
    no_product_files_touched = $true
    no_copyrighted_assets_committed = $true
    state_json_parse = "PASS"
  }
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
exit 0
