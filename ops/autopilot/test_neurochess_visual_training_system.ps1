$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("neurochess_visual_training_test_" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Read-Json {
    param([string]$Path)
    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Run-MergeSelect {
    param(
        [string]$FixtureName,
        [switch]$MissingGemini,
        [switch]$HardGateOnly
    )

    $fixturePath = Join-Path $RepoRoot "ops\autopilot\fixtures\$FixtureName"
    $summaryPath = Join-Path $TempRoot ($FixtureName + ".summary.json")
    $verdictPath = Join-Path $TempRoot ($FixtureName + ".verdict.json")

    $args = @{
        HardGatePath = $fixturePath
        OutPath = $summaryPath
    }
    if (-not $MissingGemini) { $args.GeminiPath = $fixturePath }
    if (-not $HardGateOnly) {
        $args.ChatGptPath = $fixturePath
        $args.CodexPath = $fixturePath
    }

    & (Join-Path $RepoRoot "ops\autopilot\merge_visual_court_inputs.ps1") @args | Out-Null
    & (Join-Path $RepoRoot "ops\autopilot\select_visual_patch_plan.ps1") -SummaryPath $summaryPath -OutPath $verdictPath | Out-Null
    return Read-Json $verdictPath
}

try {
    $requiredDocs = @(
        "docs\design\NEUROCHESS_VISUAL_COMPETENCE_SCORECARD.md",
        "docs\design\NEUROCHESS_CREATIVE_DIRECTOR_SYSTEM.md",
        "docs\design\AWWWARDS_GRADE_CHESS_APP_BENCHMARK.md",
        "docs\design\VISUAL_DEBATE_PROTOCOL.md",
        "docs\design\SCREENSHOT_TO_PATCH_LOOP.md",
        "docs\design\NEUROCHESS_VISUAL_TRAINING_GYM.md",
        "docs\design\SULEYMAN_VISUAL_TASTE_LEDGER.md",
        "docs\design\NEUROCHESS_VISUAL_FAILURE_GALLERY.md",
        "docs\design\VISUAL_PRIMITIVE_REGISTRY.md",
        "docs\design\RADICALITY_BUDGET.md",
        "docs\design\NO_GENERIC_GLOW_LAW.md",
        "docs\design\NEUROCHESS_MOTION_DOCTRINE.md",
        "docs\design\NEUROCHESS_DESIGN_TOKEN_CONSTITUTION.md",
        "docs\design\NEUROCHESS_PIECE_IDENTITY_BRIEF.md",
        "docs\autopilot\VISUAL_SELF_IMPROVEMENT_RUNBOOK.md",
        "docs\autopilot\A20O_NEUROCHESS_VISUAL_TRAINING_SYSTEM_REPORT.md"
    )
    foreach ($doc in $requiredDocs) {
        Assert-True (Test-Path (Join-Path $RepoRoot $doc)) "missing required doc $doc"
    }

    $requiredSchemas = @(
        "visual_director_packet.schema.json",
        "gemini_visual_observation.schema.json",
        "chatgpt_art_direction_review.schema.json",
        "codex_visual_patch_plan.schema.json",
        "creative_director_verdict.schema.json",
        "visual_mission_prompt.schema.json",
        "visual_competence_score.schema.json",
        "visual_training_drill_result.schema.json"
    )
    foreach ($schema in $requiredSchemas) {
        $schemaPath = Join-Path $RepoRoot "ops\autopilot\schemas\$schema"
        Assert-True (Test-Path $schemaPath) "missing schema $schema"
        $schemaJson = Read-Json $schemaPath
        Assert-True ($schemaJson.required -contains "mission_id") "schema $schema missing mission_id"
        Assert-True ($schemaJson.required -contains "creative_director_final_verdict") "schema $schema missing Creative Director verdict"
    }

    $packetOut = Join-Path $TempRoot "packet"
    $packetResult = (& (Join-Path $RepoRoot "ops\autopilot\build_visual_director_packet.ps1") -MissionId "A20O_TEST" -ArtifactPath "fixture/artifacts" -TargetVisualLevel "INTERNAL_NORTH_STAR_CANDIDATE" -OutDir $packetOut) | ConvertFrom-Json
    Assert-True (Test-Path $packetResult.packet_path) "packet builder did not write visual_court_packet.json"
    Assert-True (Test-Path (Join-Path $packetOut "gemini_visual_prompt.md")) "packet builder missing Gemini prompt"
    Assert-True (Test-Path (Join-Path $packetOut "chatgpt_art_direction_prompt.md")) "packet builder missing ChatGPT prompt"
    Assert-True ($packetResult.live_chatgpt_called -eq $false) "packet builder called ChatGPT"
    Assert-True ($packetResult.live_gemini_called -eq $false) "packet builder called Gemini"

    $hardGatePraise = Run-MergeSelect "visual_case_hard_gate_fail_but_gemini_praise.json"
    Assert-True ($hardGatePraise.hard_gate_override -eq $true) "hard gate fail did not override Gemini praise"
    Assert-True ($hardGatePraise.selected_action -ne "accept") "hard gate fail was accepted"

    $missingGemini = Run-MergeSelect "visual_case_missing_gemini_input.json" -MissingGemini
    Assert-True ($missingGemini.missing_inputs -contains "gemini") "missing Gemini input was not recorded"
    Assert-True ($missingGemini.creative_director_final_verdict -ne "PUBLIC_TEASER_READY") "missing Gemini became public ready"

    $missingScreenshots = Run-MergeSelect "visual_case_a20n_too_conservative.json"
    Assert-True ($missingScreenshots.screenshot_set.Count -eq 0) "A20N conservative fixture unexpectedly has screenshots"
    Assert-True ($missingScreenshots.creative_director_final_verdict -eq "INSUFFICIENT_VISUAL_EVIDENCE") "missing screenshots did not block public readiness"

    $spectacleBadChess = Run-MergeSelect "visual_case_awwwards_spectacle_bad_chess.json"
    Assert-True ($spectacleBadChess.selected_action -ne "accept") "Awwwards spectacle with bad chess was accepted"
    Assert-True ($spectacleBadChess.hard_gate_override -eq $true) "Awwwards spectacle did not trigger hard gate override"

    $safeTooLight = Run-MergeSelect "visual_case_a20j3_safe_too_light.json"
    Assert-True ($safeTooLight.creative_director_final_verdict -ne "HERO_SCREENSHOT_READY") "safe but too light was called hero-ready"
    Assert-True ($safeTooLight.selected_action -eq "patch") "safe but too light did not choose patch"

    $genericGlow = Run-MergeSelect "visual_case_generic_glow_overuse.json"
    Assert-True ($genericGlow.selected_action -eq "rework") "generic glow overuse was not penalized"

    $badBoard = Run-MergeSelect "visual_case_a20h_bad_board.json"
    Assert-True ($badBoard.hard_gate_override -eq $true) "board pollution was not blocked"

    $preFeedbackHint = Run-MergeSelect "visual_case_awwwards_spectacle_bad_chess.json"
    Assert-True ($preFeedbackHint.blocked_reasons -contains "pre_feedback_hint") "pre-feedback hint was not blocked"

    Assert-True ($safeTooLight.selected_action -eq "patch") "Creative Director cannot choose patch"
    Assert-True ($spectacleBadChess.selected_action -ne "accept") "Creative Director cannot reject or abandon a bad direction"

    $publicReady = Run-MergeSelect "visual_case_public_teaser_ready.json"
    Assert-True ($publicReady.selected_action -eq "accept") "public teaser ready fixture was not accepted"

    $scoreCappedFixture = Join-Path $TempRoot "score_capped.json"
    $publicReady | Add-Member -NotePropertyName visual_competence_score -NotePropertyValue 19 -Force
    $publicReady | Add-Member -NotePropertyName has_screenshot_to_patch_evidence -NotePropertyValue $false -Force
    $publicReady | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $scoreCappedFixture -Encoding UTF8
    # Use direct select on a temporary summary for the cap assertion.
    & (Join-Path $RepoRoot "ops\autopilot\select_visual_patch_plan.ps1") -SummaryPath $scoreCappedFixture -OutPath (Join-Path $TempRoot "score_capped.verdict.json") | Out-Null
    $cappedVerdict = Read-Json (Join-Path $TempRoot "score_capped.verdict.json")
    Assert-True ([int]$cappedVerdict.visual_competence_score -le 17) "visual competence reached 18 without screenshot-to-patch evidence"

    $promptPath = Join-Path $TempRoot "next_visual_mission_prompt.md"
    & (Join-Path $RepoRoot "ops\autopilot\generate_next_visual_mission_prompt.ps1") -VerdictPath (Join-Path $TempRoot "visual_case_a20j3_safe_too_light.json.verdict.json") -OutPath $promptPath | Out-Null
    $prompt = Get-Content -LiteralPath $promptPath -Raw
    Assert-True ($prompt -match "Allowed Paths") "generated prompt missing allowed paths"
    Assert-True ($prompt -match "Forbidden Paths") "generated prompt missing forbidden paths"
    Assert-True ($prompt -match "Exact Stop Conditions") "generated prompt missing stop conditions"
    Assert-True ($prompt -match "no road push") "generated prompt missing no road push"
    Assert-True ($prompt -match "no merge") "generated prompt missing no merge"

    Assert-True ($packetResult.live_chatgpt_called -eq $false) "dry-run mode called ChatGPT"
    Assert-True ($packetResult.live_gemini_called -eq $false) "dry-run mode called Gemini"
    Assert-True ($packetResult.product_mission_executed -eq $false) "dry-run mode executed product mission"

    $a20nFixture = Read-Json (Join-Path $RepoRoot "ops\autopilot\fixtures\visual_case_a20n_too_conservative.json")
    Assert-True ($a20nFixture.top_defects -contains "governance_only") "A20N-like governance output not marked as non-visual"

    $teaserFixture = Read-Json (Join-Path $RepoRoot "ops\autopilot\fixtures\visual_case_a20j3_safe_too_light.json")
    Assert-True ($teaserFixture.internal_prototype_labels -eq $true) "internal prototype labels fixture not represented"
    Assert-True ($teaserFixture.public_screenshot_level -ne "PUBLIC_TEASER_READY") "internal prototype labels allowed public teaser ready"

    $strongStage = Run-MergeSelect "visual_case_strong_stage_safe_board.json"
    Assert-True ($strongStage.hard_gate_override -eq $false) "strong stage safe board failed hard gates"
    Assert-True ($strongStage.selected_action -ne "rework") "strong stage safe board was treated as rework"

    $policyText = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\all_night_readiness_policy.yaml") -Raw
    Assert-True ($policyText -match "visual_lane_minimum_competence_score: 18") "policy missing visual lane minimum score 18"
    Assert-True ($policyText -match "visual_lane_default_live_llm_calls: false") "policy did not keep live LLM calls disabled by default"

    $changed = git -C $RepoRoot status --short
    $forbiddenChanges = $changed | Where-Object {
        ($_ -match " frontend/" -and $_ -notmatch " frontend/src/App\.tsx" -and $_ -notmatch " frontend/src/dev/signature-probes/" -and $_ -notmatch " frontend/src/dev/omega-pixel-lab/" -and $_ -notmatch " frontend/src/dev/autonomous-pixel-rehearsal/" -and $_ -notmatch " frontend/src/dev/full-night-pixel-rehearsal/" -and $_ -notmatch " frontend/src/dev/full-night-real-run/" -and $_ -notmatch " frontend/src/dev/true-overnight-live-run/") -or
        $_ -match " backend/" -or
        $_ -match " docs/rebuild/" -or
        $_ -match " package\.json" -or
        $_ -match " package-lock\.json" -or
        $_ -match " ops/autopilot/local/" -or
        $_ -match " qa_artifacts/" -or
        $_ -match " \.serena/"
    }
    Assert-True (($forbiddenChanges | Measure-Object).Count -eq 0) "forbidden path changed: $($forbiddenChanges -join '; ')"

    [ordered]@{
        result = "PASS"
        tests = 20
        live_chatgpt_called = $false
        live_gemini_called = $false
        product_mission_executed = $false
        browser_required = $false
    } | ConvertTo-Json -Depth 4
} finally {
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}
