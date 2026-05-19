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

function Write-JsonFixture {
  param($Object, [string]$Path)
  $Object | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding UTF8
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$fixtures = Join-Path $PSScriptRoot "fixtures"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20k_strict_visual_firewall_{0}" -f ([guid]::NewGuid().ToString("N")))
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

foreach ($schema in @(
  "chessboard_fidelity_score.schema.json",
  "anti_spoiler_visual_state_score.schema.json",
  "product_grade_visual_classification.schema.json",
  "strict_visual_firewall_decision.schema.json"
)) {
  Get-Content -LiteralPath (Join-Path $PSScriptRoot "schemas/$schema") -Raw | ConvertFrom-Json | Out-Null
}

$goodBoard = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "score_chessboard_fidelity.ps1") -Arguments @(
  "-InputPath", (Join-Path $fixtures "visual_firewall_good_board.json")
)
Assert-True ($goodBoard.chessboard_fidelity_result -eq "PASS_CHESS_FIDELITY") "good board should pass chess fidelity"

$distorted = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "score_chessboard_fidelity.ps1") -Arguments @(
  "-InputPath", (Join-Path $fixtures "visual_firewall_bad_distorted_board.json")
) -AcceptExitCodes @(2)
Assert-True ($distorted.chessboard_fidelity_result -eq "BLOCK_CHESS_FIDELITY") "distorted board should fail"
Assert-True (@($distorted.violations) -contains "top_down_or_near_top_down") "distorted board should report top-down failure"

$nonUniform = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "score_chessboard_fidelity.ps1") -Arguments @(
  "-InputPath", (Join-Path $fixtures "visual_firewall_bad_non_uniform_squares.json")
) -AcceptExitCodes @(2)
Assert-True ($nonUniform.chessboard_fidelity_result -eq "BLOCK_CHESS_FIDELITY") "non-uniform squares should fail"
Assert-True (@($nonUniform.violations) -contains "square_dimensions_uniform") "non-uniform square violation missing"

$unreadablePieces = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "score_chessboard_fidelity.ps1") -Arguments @(
  "-InputPath", (Join-Path $fixtures "visual_firewall_bad_unreadable_pieces.json")
) -AcceptExitCodes @(2)
Assert-True ($unreadablePieces.chessboard_fidelity_result -eq "BLOCK_CHESS_FIDELITY") "unreadable pieces should fail"
Assert-True (@($unreadablePieces.violations) -contains "pieces_immediately_readable") "unreadable pieces violation missing"

$artifacts = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "score_chessboard_fidelity.ps1") -Arguments @(
  "-InputPath", (Join-Path $fixtures "visual_firewall_bad_artifacts_on_board.json")
) -AcceptExitCodes @(2)
Assert-True ($artifacts.chessboard_fidelity_result -eq "BLOCK_CHESS_FIDELITY") "artifacts on board should fail"
Assert-True (@($artifacts.violations) -contains "decorative_artifacts_enter_playing_surface") "artifact-on-board violation missing"

$goodAntiPath = Join-Path $tempRoot "anti_spoiler_good.json"
Write-JsonFixture ([ordered]@{
  schema_version = "A20K_visual_firewall_fixture_v1"
  subject = "good_anti_spoiler"
  states = @(
    [ordered]@{
      learning_state = "observe"
      phase = "pre_feedback"
      solution_line_present = $false
      candidate_path_present = $false
      destination_trace_present = $false
      ambiguous_answer_like_trace_present = $false
    },
    [ordered]@{
      learning_state = "try_before_feedback"
      phase = "pre_feedback"
      solution_line_present = $false
      candidate_path_present = $false
      destination_trace_present = $false
      ambiguous_answer_like_trace_present = $false
    },
    [ordered]@{
      learning_state = "replay"
      phase = "post_feedback"
      solution_line_present = $true
      candidate_path_present = $true
      destination_trace_present = $true
      ambiguous_answer_like_trace_present = $false
    }
  )
}) $goodAntiPath

$goodAnti = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "score_anti_spoiler_visual_state.ps1") -Arguments @("-InputPath", $goodAntiPath)
Assert-True ($goodAnti.anti_spoiler_visual_state_result -eq "PASS_STATE_SEMANTICS") "clean pre-feedback states should pass"

$spoiler = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "score_anti_spoiler_visual_state.ps1") -Arguments @(
  "-InputPath", (Join-Path $fixtures "visual_firewall_bad_pre_feedback_spoiler_trace.json")
) -AcceptExitCodes @(2)
Assert-True ($spoiler.anti_spoiler_visual_state_result -eq "BLOCK_STATE_SEMANTICS") "pre-feedback spoiler trace should fail"
Assert-True ((@($spoiler.violations) -join " ") -match "try_before_feedback") "pre-feedback spoiler state missing"

$cheapUi = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "classify_product_grade_visual.ps1") -Arguments @(
  "-InputPath", (Join-Path $fixtures "visual_firewall_bad_dev_hud_cheap_ui.json")
) -AcceptExitCodes @(2)
Assert-True ($cheapUi.cheap_ui_result -eq "BLOCK_CHEAP_UI") "dev-HUD cheap UI should block"
Assert-True ($cheapUi.product_grade -eq "PRODUCT_GRADE_FAIL") "cheap UI should fail product-grade"

$prototypeOnly = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "classify_product_grade_visual.ps1") -Arguments @(
  "-InputPath", (Join-Path $fixtures "visual_firewall_prototype_pass_product_fail.json")
) -AcceptExitCodes @(2)
Assert-True ($prototypeOnly.technical_prototype_grade -eq "TECHNICAL_PROTOTYPE_PASS") "technical prototype should pass"
Assert-True ($prototypeOnly.product_grade -eq "PRODUCT_GRADE_FAIL") "prototype fixture should fail product-grade"

$productPassPath = Join-Path $tempRoot "product_pass_input.json"
Write-JsonFixture ([ordered]@{
  schema_version = "A20K_visual_firewall_fixture_v1"
  subject = "product_grade_pass"
  technical_prototype_safe = $true
  chessboard_fidelity_result = "PASS_CHESS_FIDELITY"
  anti_spoiler_visual_state_result = "PASS_STATE_SEMANTICS"
  no_fake_claims = $true
  cheap_ui_result = "PASS_PRODUCT_UI"
  generic_ui_result = "PASS_NON_GENERIC"
  premium_first_viewport = $true
  board_centered = $true
  memorable_identity = $true
  board_as_artifact = $true
  state_meaning_without_labels = $true
  premium_visual_depth = $true
  emotional_clarity = $true
  prototype_feeling_dominates = $false
}) $productPassPath
$productPass = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "classify_product_grade_visual.ps1") -Arguments @("-InputPath", $productPassPath)
Assert-True ($productPass.product_grade -eq "PRODUCT_GRADE_PASS") "product-grade pass fixture should pass"

$badChessPath = Join-Path $tempRoot "bad_chess_score.json"
$distorted | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $badChessPath -Encoding UTF8
$goodAntiScorePath = Join-Path $tempRoot "good_anti_score.json"
$goodAnti | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $goodAntiScorePath -Encoding UTF8
$productPassScorePath = Join-Path $tempRoot "product_pass_score.json"
$productPass | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $productPassScorePath -Encoding UTF8

$override = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "resolve_strict_visual_firewall_decision.ps1") -Arguments @(
  "-ChessboardScorePath", $badChessPath,
  "-AntiSpoilerScorePath", $goodAntiScorePath,
  "-ProductGradePath", $productPassScorePath,
  "-GeminiPath", (Join-Path $fixtures "gemini_pass_but_hard_gate_fail.json")
) -AcceptExitCodes @(2)
Assert-True ($override.visual_firewall_result -eq "BLOCK_CHESS_FIDELITY") "hard chess gate should override Gemini PASS"
Assert-True ([bool]$override.gemini_overridden) "Gemini PASS override flag should be true"

$placeholderGeminiPath = Join-Path $tempRoot "gemini_placeholder.json"
Write-JsonFixture ([ordered]@{
  schema = "A20K_STRICT_GEMINI_VISUAL_RESULT/1"
  verdict = "PASS_VISUAL|WARNING_VISUAL|BLOCK_VISUAL"
  strongest_variant = "Precision Cockpit|Atmospheric Artifact|Feedback Arena|NO_WINNER"
  placeholder_level = $true
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}) $placeholderGeminiPath

$goodChessPath = Join-Path $tempRoot "good_chess_score.json"
$goodBoard | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $goodChessPath -Encoding UTF8
$placeholderDecision = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "resolve_strict_visual_firewall_decision.ps1") -Arguments @(
  "-ChessboardScorePath", $goodChessPath,
  "-AntiSpoilerScorePath", $goodAntiScorePath,
  "-ProductGradePath", $productPassScorePath,
  "-GeminiPath", $placeholderGeminiPath
) -AcceptExitCodes @(2)
Assert-True ($placeholderDecision.visual_firewall_result -eq "GEMINI_CRITIQUE_INSUFFICIENT") "placeholder Gemini critique should be insufficient"
Assert-True ($placeholderDecision.final_verdict -ne "READY_TO_REVIEW") "placeholder Gemini cannot be sole READY basis"

$contextPath = Join-Path $tempRoot "strict_gemini_context.json"
$context = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "build_strict_gemini_visual_context.ps1") -Arguments @(
  "-EvidenceRoot", "fixture_evidence_root",
  "-OutPath", $contextPath,
  "-Nonce", "A20K_TEST"
)
Assert-True (Test-Path -LiteralPath $contextPath -PathType Leaf) "strict Gemini context output missing"
Assert-True (@($context.hard_gates) -contains "chessboard_geometry_uniform") "strict Gemini context missing chess geometry gate"
Assert-True (-not [bool]$context.runtime_user_approval_required) "strict Gemini context must not require runtime user approval"

foreach ($result in @($goodBoard, $distorted, $nonUniform, $unreadablePieces, $artifacts, $goodAnti, $spoiler, $cheapUi, $prototypeOnly, $productPass, $override, $placeholderDecision, $context)) {
  Assert-True (-not [bool]$result.runtime_user_approval_required) "runtime user approval must not be required"
  Assert-True (-not [bool]$result.live_chatgpt_called) "fixture mode must not call ChatGPT"
  Assert-True (-not [bool]$result.live_gemini_called) "fixture mode must not call Gemini"
  Assert-True (-not [bool]$result.product_mission_executed) "fixture mode must not execute product work"
}

$requiredDocs = @(
  "STRICT_CHESSBOARD_FIDELITY_GATE.md",
  "ANTI_SPOILER_VISUAL_STATE_GATE.md",
  "PRODUCT_GRADE_VISUAL_CLASSIFICATION.md",
  "PREMIUM_GAME_CHANGER_DESIGN_GATE.md",
  "CHEAP_UI_AND_DEV_HUD_REJECTION_POLICY.md",
  "STRICT_GEMINI_VISUAL_COURT_CONTEXT.md",
  "A20K_A20J_TOURNAMENT_STRICT_REAUDIT.md"
)
foreach ($doc in $requiredDocs) {
  Assert-True (Test-Path -LiteralPath (Join-Path $repoRoot "docs/autopilot/$doc") -PathType Leaf) "missing doc: $doc"
}

$reaudit = Get-Content -LiteralPath (Join-Path $repoRoot "docs/autopilot/A20K_A20J_TOURNAMENT_STRICT_REAUDIT.md") -Raw
Assert-True ($reaudit -match "REWORK_WINNER") "re-audit should recommend REWORK_WINNER"
Assert-True ($reaudit -match "NEEDS_REWORK") "re-audit should reclassify A20J as NEEDS_REWORK"
Assert-True ($reaudit -match "BLOCK_CHESS_FIDELITY") "re-audit should include chess fidelity block"
Assert-True ($reaudit -match "BLOCK_STATE_SEMANTICS") "re-audit should include anti-spoiler block"

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
Assert-True ($forbidden.Count -eq 0) "forbidden product files touched: $($forbidden -join ', ')"

$assetLike = @(git -C $repoRoot status --porcelain=v1 | Where-Object { $_ -match '\.(png|jpg|jpeg|gif|webp|avif|mp4|mov|webm|glb|fbx|obj|ktx|texture)$' })
Assert-True ($assetLike.Count -eq 0) "screenshots/images/assets must not be committed or staged: $($assetLike -join ', ')"

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
Assert-True ([bool]$state.strict_chessboard_fidelity_gate_available) "state missing strict chessboard fidelity gate"
Assert-True ([bool]$state.anti_spoiler_visual_state_gate_available) "state missing anti-spoiler gate"
Assert-True ([bool]$state.product_grade_visual_classification_available) "state missing product-grade classification"
Assert-True ([bool]$state.premium_game_changer_design_gate_available) "state missing premium game-changer gate"
Assert-True ([bool]$state.strict_gemini_visual_context_available) "state missing strict Gemini visual context"
Assert-True ([bool]$state.gemini_pass_can_be_overridden_by_hard_visual_gates) "state missing Gemini override rule"
Assert-True (-not [bool]$state.a20j_reaudit_required_before_consolidation) "state should mark A20J re-audit complete"
Assert-True ($state.recommended_next_automation_mission -eq "A20J3_REWORK_3D_BOARD_STAGE_TOURNAMENT_WITH_STRICT_VISUAL_FIREWALL") "state next mission should be A20J3 rework"

$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
Assert-True ($endBranch -eq $startBranch) "test should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "test should leave HEAD unchanged"

$result = [ordered]@{
  status = "pass"
  checks = [ordered]@{
    good_board_chess_fidelity = $goodBoard.chessboard_fidelity_result
    distorted_board = $distorted.chessboard_fidelity_result
    non_uniform_squares = $nonUniform.chessboard_fidelity_result
    unreadable_pieces = $unreadablePieces.chessboard_fidelity_result
    artifacts_on_board = $artifacts.chessboard_fidelity_result
    pre_feedback_spoiler = $spoiler.anti_spoiler_visual_state_result
    cheap_dev_hud = $cheapUi.cheap_ui_result
    prototype_pass_product_fail = $prototypeOnly.product_grade
    gemini_pass_overridden = $override.gemini_overridden
    placeholder_gemini_not_ready = $placeholderDecision.visual_firewall_result
    no_runtime_user_approval_required = $true
    fixture_mode_no_chatgpt = $true
    fixture_mode_no_gemini = $true
    no_product_mission = $true
    no_product_files_touched = $true
    no_docs_rebuild_touched = $true
    state_json_parse = "PASS"
  }
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
exit 0
