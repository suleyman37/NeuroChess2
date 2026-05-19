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
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20g_autonomous_design_{0}" -f ([guid]::NewGuid().ToString("N")))
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

$tasteFixture = Get-Content -LiteralPath (Join-Path $fixtures "taste_proxy_v1.json") -Raw | ConvertFrom-Json
Assert-True ($tasteFixture.schema_version -eq "A20G_suleyman_taste_proxy_v1") "taste proxy fixture schema mismatch"
Assert-True (-not [bool]$tasteFixture.runtime_user_input_required) "taste proxy must not require runtime user input"
Assert-True (@($tasteFixture.positive_taste_signals) -contains "desktop_first_strategic_cockpit") "taste proxy missing cockpit signal"
Assert-True (@($tasteFixture.positive_taste_signals) -contains "code_native_3d_controlled_scene_language") "taste proxy missing code-native 3D signal"
Assert-True (@($tasteFixture.negative_taste_signals) -contains "uncontrolled_3d_camera_spin") "taste proxy missing uncontrolled 3D negative signal"

$builtProxyPath = Join-Path $tempRoot "taste_proxy.json"
$builtProxy = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "build_suleyman_taste_proxy.ps1") -Arguments @("-OutPath", $builtProxyPath)
Assert-True ($builtProxy.proxy_id -eq "suleyman_taste_proxy_v1") "build_suleyman_taste_proxy should produce proxy v1"
Assert-True (Test-Path -LiteralPath $builtProxyPath -PathType Leaf) "built taste proxy output missing"

$strong = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "score_design_candidate_autonomous.ps1") -Arguments @(
  "-CandidatePath", (Join-Path $fixtures "design_candidate_strong_cockpit.json"),
  "-TasteProxyPath", (Join-Path $fixtures "taste_proxy_v1.json")
)
Assert-True ($strong.verdict -eq "AUTO_PASS_DESIGN") "strong cockpit candidate should pass"
Assert-True (-not [bool]$strong.runtime_user_input_required) "strong score must not require runtime user input"

$generic = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "score_design_candidate_autonomous.ps1") -Arguments @(
  "-CandidatePath", (Join-Path $fixtures "design_candidate_generic_saas.json"),
  "-TasteProxyPath", (Join-Path $fixtures "taste_proxy_v1.json")
) -AcceptExitCodes @(2)
Assert-True ($generic.verdict -eq "AUTO_BLOCK_GENERIC_UI") "generic SaaS candidate should block"

$fake = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "score_design_candidate_autonomous.ps1") -Arguments @(
  "-CandidatePath", (Join-Path $fixtures "design_candidate_fake_gamification.json"),
  "-TasteProxyPath", (Join-Path $fixtures "taste_proxy_v1.json")
) -AcceptExitCodes @(2)
Assert-True ($fake.verdict -eq "AUTO_BLOCK_GENERIC_UI") "fake gamification candidate should block"
Assert-True (@($fake.reasons) -contains "fake_gamification_detected") "fake gamification reason missing"

$boardNotCentral = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "score_design_candidate_autonomous.ps1") -Arguments @(
  "-CandidatePath", (Join-Path $fixtures "design_candidate_board_not_central.json"),
  "-TasteProxyPath", (Join-Path $fixtures "taste_proxy_v1.json")
) -AcceptExitCodes @(0, 2)
Assert-True (@("AUTO_BLOCK_GENERIC_UI", "AUTO_WARNING_VISUAL_DEBT") -contains $boardNotCentral.verdict) "board-not-central candidate should block or warn"
Assert-True (@($boardNotCentral.reasons) -contains "board_not_central") "board-not-central reason missing"

$bad3d = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "score_design_candidate_autonomous.ps1") -Arguments @(
  "-CandidatePath", (Join-Path $fixtures "design_candidate_uncontrolled_3d_spectacle.json"),
  "-TasteProxyPath", (Join-Path $fixtures "taste_proxy_v1.json")
) -AcceptExitCodes @(2)
Assert-True ($bad3d.verdict -eq "AUTO_BLOCK_GENERIC_UI") "uncontrolled 3D spectacle should block"
Assert-True (@($bad3d.reasons) -contains "uncontrolled_3d_spectacle") "uncontrolled 3D reason missing"

$clearWinner = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "resolve_design_tournament_winner.ps1") -Arguments @(
  "-TournamentPath", (Join-Path $fixtures "design_tournament_clear_winner.json")
)
Assert-True ($clearWinner.tournament_result -eq "WINNER_SELECTED") "clear winner tournament should select winner"
Assert-True ($clearWinner.winner_id -eq "strong_cockpit") "strong cockpit should win"
Assert-True (-not [bool]$clearWinner.runtime_user_input_required) "tournament must not require runtime user input"

$noWinner = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "resolve_design_tournament_winner.ps1") -Arguments @(
  "-TournamentPath", (Join-Path $fixtures "design_tournament_no_winner.json")
) -AcceptExitCodes @(2)
Assert-True ($noWinner.tournament_result -eq "NO_WINNER") "no valid candidates should return NO_WINNER"
Assert-True (-not [bool]$noWinner.runtime_user_input_required) "NO_WINNER must not require runtime user input"

$juryPacketPath = Join-Path $tempRoot "design_jury_packet.json"
$juryPacket = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "build_design_jury_packet.ps1") -Arguments @(
  "-DesignBriefPath", (Join-Path $fixtures "design_candidate_strong_cockpit.json"),
  "-TasteProxyPath", (Join-Path $fixtures "taste_proxy_v1.json"),
  "-OutPath", $juryPacketPath
)
$packetRaw = Get-Content -LiteralPath $juryPacketPath -Raw
Assert-True ($juryPacket.schema_version -eq "A20G_design_jury_packet_v1") "jury packet schema mismatch"
Assert-True (-not [bool]$juryPacket.runtime_user_input_required) "jury packet must not require runtime user input"
Assert-True ($packetRaw -notmatch "ask Suleyman|wait for user|user approval required") "jury packet must contain no request for user approval"
Assert-True (($juryPacket.visual_court_questions -join " ") -match "3D clarifying") "jury packet should ask 3D clarity question"

$juryPass = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "validate_design_jury_result.ps1") -Arguments @(
  "-ResultPath", (Join-Path $fixtures "design_jury_pass_visual.json")
)
Assert-True ($juryPass.design_jury_result_validation -eq "PASS") "PASS visual jury fixture should validate"

$juryWarn = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "validate_design_jury_result.ps1") -Arguments @(
  "-ResultPath", (Join-Path $fixtures "design_jury_warning_visual.json")
)
Assert-True ($juryWarn.design_jury_result_validation -eq "PASS") "WARNING visual jury fixture should validate"

$juryBlock = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "validate_design_jury_result.ps1") -Arguments @(
  "-ResultPath", (Join-Path $fixtures "design_jury_block_generic.json")
)
Assert-True ($juryBlock.design_jury_result_validation -eq "PASS") "BLOCK generic jury fixture should validate"

$badJuryPath = Join-Path $tempRoot "design_jury_bad_prompt.json"
Set-Content -LiteralPath $badJuryPath -Encoding UTF8 -Value @'
{
  "schema_version": "A20G_design_jury_result_v1",
  "provider": "Gemini Visual Court",
  "verdict": "PASS_VISUAL",
  "codex_prompt": "MICRO_PROMPT: change UI",
  "hard_gates": {
    "cta_truthfulness": true,
    "no_fake_gamification": true,
    "no_fake_xp_rank_transfer": true,
    "board_central": true,
    "desktop_first": true,
    "not_generic_saas": true
  },
  "runtime_user_input_required": false
}
'@
$badJury = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "validate_design_jury_result.ps1") -Arguments @("-ResultPath", $badJuryPath) -AcceptExitCodes @(2)
Assert-True ($badJury.design_jury_result_validation -eq "REJECT_JURY_RESULT") "jury result with codex_prompt/MICRO_PROMPT should reject"
Assert-True (@($badJury.violations) -contains "prompt_injection_field_or_text") "prompt injection violation missing"

foreach ($result in @($builtProxy, $strong, $generic, $fake, $boardNotCentral, $bad3d, $clearWinner, $noWinner, $juryPacket, $juryPass, $juryWarn, $juryBlock, $badJury)) {
  Assert-True (-not [bool]$result.live_chatgpt_called) "fixture mode must not call ChatGPT"
  Assert-True (-not [bool]$result.live_gemini_called) "fixture mode must not call Gemini"
  Assert-True (-not [bool]$result.product_mission_executed) "fixture mode must not execute product work"
}

$requiredDocs = @(
  "NEUROCHESS_AUTONOMOUS_DESIGN_JUDGMENT.md",
  "SULEYMAN_TASTE_PROXY.md",
  "GOLDEN_SCREEN_DESIGN_TOURNAMENT.md",
  "AI_VISUAL_JURY_PROTOCOL.md",
  "DESIGN_WINNER_SELECTION_POLICY.md",
  "ANTI_GENERIC_BRUTALITY_GATE.md",
  "REFERENCE_COMPARISON_HARNESS.md",
  "NO_HUMAN_RUNTIME_DESIGN_LOOP_POLICY.md",
  "POST_RUN_TASTE_CALIBRATION_PROTOCOL.md"
)
foreach ($doc in $requiredDocs) {
  Assert-True (Test-Path -LiteralPath (Join-Path $repoRoot "docs/autopilot/$doc") -PathType Leaf) "missing doc: $doc"
}

$noHumanDoc = Get-Content -LiteralPath (Join-Path $repoRoot "docs/autopilot/NO_HUMAN_RUNTIME_DESIGN_LOOP_POLICY.md") -Raw
Assert-True ($noHumanDoc -match "no mission may wait for user visual judgment") "no-human runtime policy missing"

$referenceHarness = Get-Content -LiteralPath (Join-Path $repoRoot "docs/autopilot/REFERENCE_COMPARISON_HARNESS.md") -Raw
Assert-True ($referenceHarness -match "NeuroChess Scene Language") "reference harness should include scene language alignment"

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

$assetLike = @(git -C $repoRoot status --porcelain=v1 | Where-Object { $_ -match '\.(png|jpg|jpeg|gif|webp|avif|svg|mp4|mov|webm)$' })
Assert-True ($assetLike.Count -eq 0) "copyrighted assets/images must not be committed or staged: $($assetLike -join ', ')"

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
Assert-True ($state.autonomous_design_judgment_version -eq "A20G") "state missing A20G autonomous design judgment version"
Assert-True ([bool]$state.suleyman_taste_proxy_available) "state missing taste proxy availability"
Assert-True ([bool]$state.golden_screen_design_tournament_available) "state missing tournament availability"
Assert-True ([bool]$state.autonomous_design_jury_available) "state missing autonomous design jury availability"
Assert-True ([bool]$state.anti_generic_brutality_gate_available) "state missing anti-generic gate availability"
Assert-True ([bool]$state.reference_comparison_harness_available) "state missing reference harness availability"
Assert-True (-not [bool]$state.runtime_user_design_approval_required) "runtime user design approval must be false"
Assert-True ([bool]$state.post_run_taste_calibration_available) "state missing post-run calibration availability"
Assert-True (-not [bool]$state.autonomous_design_judgment_live_enforced) "autonomous design judgment live enforcement must remain disabled"
Assert-True (@(
  "A20H_DEV_ONLY_3D_BOARD_STAGE_PROTOTYPE",
  "A20J3_REWORK_3D_BOARD_STAGE_TOURNAMENT_WITH_STRICT_VISUAL_FIREWALL"
) -contains $state.recommended_next_automation_mission) "state next mission should be A20H or later strict visual firewall progression"

$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
Assert-True ($endBranch -eq $startBranch) "test should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "test should leave HEAD unchanged"

$result = [ordered]@{
  status = "pass"
  checks = [ordered]@{
    taste_proxy_fixture = "PASS"
    strong_cockpit_candidate = $strong.verdict
    generic_saas_candidate = $generic.verdict
    fake_gamification_candidate = $fake.verdict
    board_not_central_candidate = $boardNotCentral.verdict
    uncontrolled_3d_spectacle_candidate = $bad3d.verdict
    tournament_clear_winner = $clearWinner.tournament_result
    tournament_no_winner = $noWinner.tournament_result
    no_runtime_user_input = "PASS"
    jury_packet_no_user_approval_request = "PASS"
    jury_result_rejects_codex_prompt_micro_prompt = $badJury.design_jury_result_validation
    fixture_mode_no_chatgpt = $true
    fixture_mode_no_gemini = $true
    no_product_mission = $true
    no_product_files_touched = $true
    no_docs_rebuild_touched = $true
    no_copyrighted_assets_committed = $true
    state_json_parse = "PASS"
  }
  runtime_user_approval_required = $false
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
exit 0
