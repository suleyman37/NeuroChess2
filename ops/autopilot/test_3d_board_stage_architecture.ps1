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
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20f_3d_board_stage_{0}" -f ([guid]::NewGuid().ToString("N")))
New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

$validFixtures = @(
  "scene_language_observe.json",
  "scene_language_try_before_feedback.json",
  "scene_language_feedback_success.json",
  "scene_language_feedback_miss.json",
  "scene_language_replay.json"
)

$validResults = @()
foreach ($fixture in $validFixtures) {
  $result = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "validate_scene_language.ps1") -Arguments @(
    "-ScenePath", (Join-Path $fixtures $fixture)
  )
  Assert-True ($result.scene_language_result -eq "PASS") "$fixture should pass"
  Assert-True ([bool]$result.board_readability_verified) "$fixture should verify board readability"
  Assert-True ([bool]$result.reduced_motion_fallback_required) "$fixture should require reduced motion"
  Assert-True ([bool]$result.performance_budget_required) "$fixture should require performance budget"
  $validResults += $result
}

$badGlow = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "validate_scene_language.ps1") -Arguments @(
  "-ScenePath", (Join-Path $fixtures "scene_language_bad_meaningless_glow.json")
) -AcceptExitCodes @(2)
Assert-True ($badGlow.scene_language_result -eq "REJECT_SCENE_LANGUAGE") "meaningless glow fixture should fail"
Assert-True (@($badGlow.violations) -contains "meaningless_glow") "meaningless glow violation missing"

$badCamera = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "validate_scene_language.ps1") -Arguments @(
  "-ScenePath", (Join-Path $fixtures "scene_language_bad_camera_spin.json")
) -AcceptExitCodes @(2)
Assert-True ($badCamera.scene_language_result -eq "REJECT_SCENE_LANGUAGE") "camera spin fixture should fail"
Assert-True (@($badCamera.violations) -contains "forbidden_camera_mode") "camera spin violation missing"

$badBoard = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "validate_scene_language.ps1") -Arguments @(
  "-ScenePath", (Join-Path $fixtures "scene_language_bad_board_obscured.json")
) -AcceptExitCodes @(2)
Assert-True ($badBoard.scene_language_result -eq "REJECT_SCENE_LANGUAGE") "board obscured fixture should fail"
Assert-True (@($badBoard.violations) -contains "board_obscured") "board obscured violation missing"

$fakeProgressPath = Join-Path $tempRoot "scene_language_bad_fake_progress.json"
$fakeProgress = Get-Content -LiteralPath (Join-Path $fixtures "scene_language_observe.json") -Raw | ConvertFrom-Json
$fakeProgress.scene_id = "a20f_bad_fake_progress"
$fakeProgress.allowed_effects = @("decision_ring", "fake_xp_rank_transfer")
($fakeProgress | ConvertTo-Json -Depth 20) | Set-Content -LiteralPath $fakeProgressPath -Encoding UTF8
$fakeProgressResult = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "validate_scene_language.ps1") -Arguments @(
  "-ScenePath", $fakeProgressPath
) -AcceptExitCodes @(2)
Assert-True (@($fakeProgressResult.violations) -contains "fake_xp_rank_transfer") "fake XP/rank/Transfer must be forbidden"

$briefJsonPath = Join-Path $tempRoot "board_stage_brief.json"
$briefMdPath = Join-Path $tempRoot "board_stage_brief.md"
$brief = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "build_3d_board_stage_brief.ps1") -Arguments @(
  "-ScenePath", (Join-Path $fixtures "scene_language_try_before_feedback.json"),
  "-OutJsonPath", $briefJsonPath,
  "-OutMarkdownPath", $briefMdPath
)
Assert-True ($brief.schema_version -eq "A20F_3d_board_stage_brief_v1") "3D board stage brief schema mismatch"
Assert-True (($brief.renderer_candidates -join " ") -match "React Three Fiber") "renderer candidates should mention React Three Fiber"
Assert-True (Test-Path -LiteralPath $briefJsonPath -PathType Leaf) "brief JSON missing"
Assert-True (Test-Path -LiteralPath $briefMdPath -PathType Leaf) "brief Markdown missing"

$briefScore = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "score_3d_scene_brief.ps1") -Arguments @(
  "-BriefPath", $briefJsonPath
)
Assert-True ($briefScore.three_d_scene_brief_score_result -eq "PASS") "valid 3D scene brief should pass"

foreach ($result in @($validResults + @($badGlow, $badCamera, $badBoard, $fakeProgressResult, $brief, $briefScore))) {
  Assert-True (-not [bool]$result.live_chatgpt_called) "fixture mode must not call ChatGPT"
  Assert-True (-not [bool]$result.live_gemini_called) "fixture mode must not call Gemini"
  Assert-True (-not [bool]$result.product_mission_executed) "fixture mode must not execute product work"
}

$requiredDocs = @(
  "NEUROCHESS_CODE_NATIVE_3D_BOARD_STAGE.md",
  "NEUROCHESS_SCENE_LANGUAGE.md",
  "NEUROCHESS_VISUAL_PHYSICS.md",
  "NEUROCHESS_3D_VISUAL_STATE_MACHINE.md",
  "NEUROCHESS_3D_RENDERER_ARCHITECTURE.md",
  "NEUROCHESS_3D_PERFORMANCE_BUDGET.md",
  "NEUROCHESS_3D_ACCESSIBILITY_FALLBACK.md",
  "NEUROCHESS_3D_ALLOWED_FORBIDDEN_EFFECTS.md",
  "NEUROCHESS_3D_DEV_ONLY_PROTOTYPE_PLAN.md",
  "NEUROCHESS_3D_EXTERNAL_SKILLS_AUDIT_PLAN.md"
)
foreach ($doc in $requiredDocs) {
  Assert-True (Test-Path -LiteralPath (Join-Path $repoRoot "docs/autopilot/$doc") -PathType Leaf) "missing doc: $doc"
}

$mainDoc = Get-Content -LiteralPath (Join-Path $repoRoot "docs/autopilot/NEUROCHESS_CODE_NATIVE_3D_BOARD_STAGE.md") -Raw
Assert-True ($mainDoc -match "The 3D serves the chess decision") "core doctrine missing"
Assert-True ($mainDoc -match "Gemini Visual Court") "screenshot/Gemini visual audit strategy missing"

$architectureDoc = Get-Content -LiteralPath (Join-Path $repoRoot "docs/autopilot/NEUROCHESS_3D_RENDERER_ARCHITECTURE.md") -Raw
Assert-True ($architectureDoc -match "React Three Fiber") "R3F strategy missing"
Assert-True ($architectureDoc -match "Three") "Three.js strategy missing"
Assert-True ($architectureDoc -match "WebGPU") "WebGPU/TSL DEV-only strategy missing"

$effectsDoc = Get-Content -LiteralPath (Join-Path $repoRoot "docs/autopilot/NEUROCHESS_3D_ALLOWED_FORBIDDEN_EFFECTS.md") -Raw
Assert-True ($effectsDoc -match "meaningless_glow") "forbidden effects doc missing meaningless glow"
Assert-True ($effectsDoc -match "decision_ring") "allowed effects doc missing decision ring"

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
Assert-True ($forbidden.Count -eq 0) "product/package files touched: $($forbidden -join ', ')"

$assetLike = @(git -C $repoRoot status --porcelain=v1 | Where-Object { $_ -match '\.(png|jpg|jpeg|gif|webp|avif|svg|glb|gltf|fbx|obj|mtl|hdr|exr|ktx|mp4|mov|webm)$' })
Assert-True ($assetLike.Count -eq 0) "3D assets/images/videos must not be committed or staged: $($assetLike -join ', ')"

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
Assert-True ($state.code_native_3d_board_stage_architecture_version -eq "A20F") "state missing A20F version"
Assert-True ([bool]$state.neurochess_scene_language_available) "state missing scene language availability"
Assert-True ([bool]$state.visual_physics_available) "state missing visual physics availability"
Assert-True ([bool]$state.board_stage_renderer_architecture_available) "state missing renderer architecture availability"
Assert-True ([bool]$state.three_d_performance_budget_available) "state missing performance budget availability"
Assert-True ([bool]$state.three_d_accessibility_fallback_available) "state missing accessibility fallback availability"
Assert-True (-not [bool]$state.code_native_3d_live_enforced) "3D live enforcement must remain disabled"
Assert-True (@(
  "A20G_DEV_ONLY_3D_BOARD_STAGE_PROTOTYPE",
  "A20H_DEV_ONLY_3D_BOARD_STAGE_PROTOTYPE",
  "A20J3_REWORK_3D_BOARD_STAGE_TOURNAMENT_WITH_STRICT_VISUAL_FIREWALL"
) -contains $state.recommended_next_automation_mission) "next mission should be A20G, A20H, or later strict visual firewall progression"

$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
Assert-True ($endBranch -eq $startBranch) "test should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "test should leave HEAD unchanged"

$result = [ordered]@{
  status = "pass"
  checks = [ordered]@{
    observe_scene_language = "PASS"
    try_before_feedback_scene_language = "PASS"
    feedback_success_scene_language = "PASS"
    feedback_miss_scene_language = "PASS"
    replay_scene_language = "PASS"
    meaningless_glow_rejected = "PASS"
    camera_spin_rejected = "PASS"
    board_obscured_rejected = "PASS"
    fake_xp_rank_transfer_forbidden = "PASS"
    reduced_motion_fallback_required = "PASS"
    performance_budget_required = "PASS"
    board_stage_brief = "PASS"
    fixture_mode_no_chatgpt = $true
    fixture_mode_no_gemini = $true
    no_product_mission = $true
    no_product_files_touched = $true
    no_package_files_touched = $true
    no_3d_assets_images_committed = $true
    state_json_parse = "PASS"
  }
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
exit 0
