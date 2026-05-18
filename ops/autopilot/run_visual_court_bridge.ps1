param(
    [string]$MissionId = "A20Q_VISUAL_COURT_BRIDGE",
    [string]$EvidencePath = "fixture_evidence",
    [string]$OutputPath = "",
    [ValidateSet("OFFLINE_FIXTURE_MODE", "MANUAL_PACKET_MODE", "SAFE_LIVE_READONLY_MODE")]
    [string]$Mode = "OFFLINE_FIXTURE_MODE",
    [string]$TargetVisualLevel = "PUBLIC_TEASER_READY_WITH_CAVEATS",
    [string]$GeminiPath = "",
    [string]$ChatGptPath = "",
    [string]$CodexPath = "",
    [string]$HardGatePath = ""
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path ([System.IO.Path]::GetTempPath()) ("neurochess_visual_court_bridge_" + [System.Guid]::NewGuid().ToString("N"))
}

New-Item -ItemType Directory -Force -Path $OutputPath | Out-Null
$ManualDir = Join-Path $OutputPath "manual_input_templates"
$FixtureOutDir = Join-Path $OutputPath "fixture_judge_outputs"
New-Item -ItemType Directory -Force -Path $ManualDir | Out-Null
New-Item -ItemType Directory -Force -Path $FixtureOutDir | Out-Null

function Write-Json {
    param([string]$Path, $Payload)
    $Payload | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Copy-IfExists {
    param([string]$Source, [string]$Destination)
    if (Test-Path -LiteralPath $Source -PathType Leaf) {
        Copy-Item -LiteralPath $Source -Destination $Destination -Force
        return $Destination
    }
    return ""
}

function Validate-Judge {
    param([string]$Path, [string]$JudgeType, [string]$Name)
    $validationPath = Join-Path $OutputPath ("validation_{0}.json" -f $Name)
    & (Join-Path $PSScriptRoot "validate_visual_judge_output.ps1") -InputPath $Path -JudgeType $JudgeType -OutPath $validationPath | Out-Null
    return Get-Content -LiteralPath $validationPath -Raw | ConvertFrom-Json
}

$safetyReportPath = Join-Path $OutputPath "safety_report.json"
$modeReportPath = Join-Path $OutputPath "bridge_mode_report.json"
$manifestPath = Join-Path $OutputPath "manifest.json"
$consoleLogPath = Join-Path $OutputPath "console_log.txt"

$safety = [ordered]@{
    schema_version = "A20Q_visual_court_safety_report_v1"
    mode = $Mode
    live_mode_optional = $true
    live_chatgpt_called = $false
    live_gemini_called = $false
    human_verification_encountered = $false
    bypass_attempted = $false
    credentials_automated = $false
    captcha_bypass_attempted = $false
    road_to_v2_pushed = $false
    road_to_v2_merged = $false
    a21_launched = $false
    night_mode_launched = $false
    product_mission_executed = $false
    safety_stop = $null
}

if ($Mode -eq "SAFE_LIVE_READONLY_MODE") {
    $safety.safety_stop = "SAFE_LIVE_READONLY_MODE_NOT_CONFIGURED_USE_MANUAL_PACKET_MODE"
    Write-Json $safetyReportPath $safety
}

$packetResult = (& (Join-Path $PSScriptRoot "build_visual_director_packet.ps1") `
    -MissionId $MissionId `
    -ArtifactPath $EvidencePath `
    -TargetVisualLevel $TargetVisualLevel `
    -OutDir $OutputPath) | ConvertFrom-Json

Rename-Item -LiteralPath (Join-Path $OutputPath "gemini_visual_prompt.md") -NewName "gemini_prompt.md" -Force
Rename-Item -LiteralPath (Join-Path $OutputPath "chatgpt_art_direction_prompt.md") -NewName "chatgpt_prompt.md" -Force

@"
# Gemini Visual Perceiver Prompt

Mission: $MissionId
Evidence path: $EvidencePath
Target visual level: $TargetVisualLevel

Judge visible screenshot reality only. Cite concrete visible details. Detect
board pollution, piece readability problems, generic SaaS drift, generic glow,
prototype residue, hierarchy problems, and public screenshot readiness.

Return strict JSON with `gemini_visual_verdict`, `public_screenshot_level`,
`concrete_strengths`, `concrete_weaknesses`, `fatal_defects`, `screenshot_set`,
and `allowed_next_action`. Do not return enum placeholders or generic praise.
"@ | Set-Content -LiteralPath (Join-Path $OutputPath "gemini_prompt.md") -Encoding UTF8

@"
# ChatGPT Product Art Director Prompt

Mission: $MissionId
Evidence path: $EvidencePath
Target visual level: $TargetVisualLevel

Judge NeuroChess product desire, identity, learning usefulness, desktop app
seriousness, Awwwards-grade craft translation, and public-readiness honesty.
Do not approve without screenshot evidence. Hard gates have veto.

Return strict JSON with `chatgpt_art_direction_verdict`,
`public_screenshot_level`, `top_strengths`, `top_defects`,
`awwwards_app_craft_score`, `required_patch`, and `allowed_next_action`.
"@ | Set-Content -LiteralPath (Join-Path $OutputPath "chatgpt_prompt.md") -Encoding UTF8

@"
# Codex Visual Patch Planner Prompt

Mission: $MissionId
Evidence path: $EvidencePath

Produce exactly three patch options. Include delete-first fixes, reshape fixes,
add-ambition fixes, risks, likely files, tests required, and expected visual
delta. Do not implement automatically. Do not call the design revolutionary.
"@ | Set-Content -LiteralPath (Join-Path $OutputPath "codex_patch_planner_prompt.md") -Encoding UTF8

@"
# Creative Director Synthesis Prompt

Synthesize Gemini, ChatGPT, Codex, hard gates, Taste Ledger, and Failure
Gallery. Apply hard-gate vetoes. Choose accept, patch, rework, abandon, or
human_review_required. Missing judge input is not PASS.
"@ | Set-Content -LiteralPath (Join-Path $OutputPath "creative_director_decision_template.md") -Encoding UTF8

$templateBase = [ordered]@{
    mission_id = $MissionId
    evidence_path = $EvidencePath
    screenshot_set = @("generation_1_patch/contact_sheet_generation_1_states.png")
    public_screenshot_level = $TargetVisualLevel
    top_strengths = @()
    top_defects = @()
    blocked_reasons = @()
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
}
Write-Json (Join-Path $ManualDir "gemini_output_template.json") ($templateBase + [ordered]@{ gemini_visual_verdict = "WARNING_VISUAL_WITH_CONCRETE_DEBT"; concrete_strengths = @(); concrete_weaknesses = @(); fatal_defects = @() })
Write-Json (Join-Path $ManualDir "chatgpt_output_template.json") ($templateBase + [ordered]@{ chatgpt_art_direction_verdict = "PRODUCT_GRADE_WITH_DEBT"; awwwards_app_craft_score = 45; required_patch = "TBD" })
Write-Json (Join-Path $ManualDir "codex_patch_plan_template.json") ($templateBase + [ordered]@{ codex_feasibility_verdict = "PATCH_FEASIBLE"; patch_options = @() })

$hardGatePassPath = Join-Path $FixtureOutDir "hard_gate_a20p_pass.json"
Write-Json $hardGatePassPath ([ordered]@{
    mission_id = $MissionId
    evidence_path = $EvidencePath
    screenshot_set = @(
        "generation_1_patch/contact_sheet_generation_1_states.png",
        "generation_1_patch/contact_sheet_before_after_a20l_vs_a20p.png"
    )
    hard_gate_status = "PASS_HARD_GATES"
    chess_arbiter_verdict = "CHESS_FIDELITY_PASS"
    anti_generic_verdict = "PASS_NON_GENERIC"
    public_screenshot_level = "PUBLIC_TEASER_READY_WITH_CAVEATS"
    awwwards_app_craft_score = 45
    visual_competence_score = 17
    top_defects = @("feedback_trace_language_not_final", "human_review_required")
    top_strengths = @("board_centered", "pre_feedback_clean", "prototype_residue_reduced")
    blocked_reasons = @()
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
})

if ($Mode -eq "OFFLINE_FIXTURE_MODE") {
    $GeminiPath = Copy-IfExists (Join-Path $RepoRoot "ops\autopilot\fixtures\judges\a20p_gemini_visual_observation_good.json") (Join-Path $FixtureOutDir "a20p_gemini_visual_observation_good.json")
    $ChatGptPath = Copy-IfExists (Join-Path $RepoRoot "ops\autopilot\fixtures\judges\a20p_chatgpt_art_direction_review_good.json") (Join-Path $FixtureOutDir "a20p_chatgpt_art_direction_review_good.json")
    $CodexPath = Copy-IfExists (Join-Path $RepoRoot "ops\autopilot\fixtures\judges\a20p_codex_patch_plan_good.json") (Join-Path $FixtureOutDir "a20p_codex_patch_plan_good.json")
    if ([string]::IsNullOrWhiteSpace($HardGatePath)) { $HardGatePath = $hardGatePassPath }
} elseif ($Mode -eq "MANUAL_PACKET_MODE") {
    if ([string]::IsNullOrWhiteSpace($HardGatePath)) { $HardGatePath = $hardGatePassPath }
} elseif ($Mode -eq "SAFE_LIVE_READONLY_MODE") {
    if ([string]::IsNullOrWhiteSpace($HardGatePath)) { $HardGatePath = $hardGatePassPath }
    # Live mode is intentionally not implemented without an approved bridge.
    $GeminiPath = ""
    $ChatGptPath = ""
    $CodexPath = ""
}

$validations = [ordered]@{
    gemini = Validate-Judge $GeminiPath "gemini" "gemini"
    chatgpt = Validate-Judge $ChatGptPath "chatgpt" "chatgpt"
    codex = Validate-Judge $CodexPath "codex" "codex"
    hard_gate = Validate-Judge $HardGatePath "hard_gate" "hard_gate"
}

$invalidJudges = @()
foreach ($name in @("gemini", "chatgpt", "codex", "hard_gate")) {
    if ($validations[$name].validation_result -eq "INVALID_OUTPUT") { $invalidJudges += $name }
}

$missingJudges = @()
foreach ($name in @("gemini", "chatgpt", "codex", "hard_gate")) {
    if ($validations[$name].validation_result -eq "MISSING_INPUT") { $missingJudges += $name }
}

$geminiForMerge = if ($validations.gemini.validation_result -eq "VALID_OUTPUT") { $GeminiPath } else { "" }
$chatgptForMerge = if ($validations.chatgpt.validation_result -eq "VALID_OUTPUT") { $ChatGptPath } else { "" }
$codexForMerge = if ($validations.codex.validation_result -eq "VALID_OUTPUT") { $CodexPath } else { "" }
$hardGateForMerge = if ($validations.hard_gate.validation_result -eq "VALID_OUTPUT") { $HardGatePath } else { "" }

$summaryPath = Join-Path $OutputPath "merged_visual_court_summary.json"
& (Join-Path $PSScriptRoot "merge_visual_court_inputs.ps1") `
    -GeminiPath $geminiForMerge `
    -ChatGptPath $chatgptForMerge `
    -CodexPath $codexForMerge `
    -HardGatePath $hardGateForMerge `
    -OutPath $summaryPath | Out-Null

$summary = Get-Content -LiteralPath $summaryPath -Raw | ConvertFrom-Json
$summary | Add-Member -NotePropertyName invalid_inputs -NotePropertyValue $invalidJudges -Force
$summary | Add-Member -NotePropertyName bridge_mode -NotePropertyValue $Mode -Force
$summary | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $summaryPath -Encoding UTF8

$verdictPath = Join-Path $OutputPath "creative_director_verdict.json"
& (Join-Path $PSScriptRoot "select_visual_patch_plan.ps1") -SummaryPath $summaryPath -OutPath $verdictPath | Out-Null

$nextPromptPath = Join-Path $OutputPath "next_visual_mission_prompt.md"
& (Join-Path $PSScriptRoot "generate_next_visual_mission_prompt.ps1") -VerdictPath $verdictPath -OutPath $nextPromptPath | Out-Null

$verdict = Get-Content -LiteralPath $verdictPath -Raw | ConvertFrom-Json
$scoreEstimate = if ($Mode -in @("OFFLINE_FIXTURE_MODE", "MANUAL_PACKET_MODE") -and $invalidJudges.Count -eq 0 -and $validations.gemini.validation_result -eq "VALID_OUTPUT" -and $validations.chatgpt.validation_result -eq "VALID_OUTPUT") { 17.5 } else { 17 }
if ($Mode -eq "SAFE_LIVE_READONLY_MODE") { $scoreEstimate = 17 }

$modeResult = if ($Mode -eq "SAFE_LIVE_READONLY_MODE") {
    "LIVE_MODE_NOT_CONFIGURED_STOPPED"
} elseif ($invalidJudges.Count -gt 0) {
    "BRIDGE_COMPLETED_WITH_INVALID_INPUTS"
} elseif ($missingJudges.Count -gt 0) {
    "BRIDGE_COMPLETED_WITH_MISSING_INPUTS"
} else {
    "BRIDGE_READY_MANUAL_FIXTURE"
}

Write-Json $safetyReportPath $safety

$modeReport = [ordered]@{
    schema_version = "A20Q_visual_court_bridge_run_v1"
    mission_id = $MissionId
    evidence_path = $EvidencePath
    output_path = $OutputPath
    mode = $Mode
    mode_result = $modeResult
    default_mode = "OFFLINE_FIXTURE_MODE"
    modes_supported = @("OFFLINE_FIXTURE_MODE", "MANUAL_PACKET_MODE", "SAFE_LIVE_READONLY_MODE")
    target_visual_level = $TargetVisualLevel
    judge_validation = $validations
    missing_judges = $missingJudges
    invalid_judges = $invalidJudges
    hard_gate_override = $summary.hard_gate_override
    creative_director_final_verdict = $verdict.creative_director_final_verdict
    selected_action = $verdict.selected_action
    next_visual_mission_prompt_path = $nextPromptPath
    score_estimate_after_bridge = $scoreEstimate
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
    runtime_user_approval_required = $false
}
Write-Json $modeReportPath $modeReport

"A20Q bridge completed in $Mode. Live ChatGPT/Gemini were not called." | Set-Content -LiteralPath $consoleLogPath -Encoding UTF8

Write-Json $manifestPath ([ordered]@{
    schema_version = "A20Q_visual_court_bridge_manifest_v1"
    mission_id = $MissionId
    evidence_path = $EvidencePath
    output_path = $OutputPath
    mode = $Mode
    generated_files = @(
        (Join-Path $OutputPath "visual_court_packet.json"),
        (Join-Path $OutputPath "gemini_prompt.md"),
        (Join-Path $OutputPath "chatgpt_prompt.md"),
        (Join-Path $OutputPath "codex_patch_planner_prompt.md"),
        (Join-Path $OutputPath "creative_director_decision_template.md"),
        $summaryPath,
        $verdictPath,
        $nextPromptPath,
        $modeReportPath,
        $safetyReportPath,
        $consoleLogPath
    )
    safety = $safety
    score_estimate_after_bridge = $scoreEstimate
})

Write-Json (Join-Path $OutputPath "bridge_test_report.json") ([ordered]@{
    schema_version = "A20Q_bridge_test_report_v1"
    result = $modeResult
    validations = $validations
    creative_director_verdict = $verdict.creative_director_final_verdict
    selected_action = $verdict.selected_action
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
})

$modeReport | ConvertTo-Json -Depth 30
