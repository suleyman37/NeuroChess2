$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20q_visual_court_bridge_test_" + [System.Guid]::NewGuid().ToString("N"))
New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Read-Json {
    param([string]$Path)
    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Invoke-Json {
    param([string]$Script, [string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $Script @Arguments
    if ($LASTEXITCODE -ne 0) { throw "Script failed: $Script $($Arguments -join ' ')" }
    return ($output | Out-String).Trim() | ConvertFrom-Json
}

try {
    $bridgeOut = Join-Path $TempRoot "offline_bridge"
    $bridge = Invoke-Json (Join-Path $RepoRoot "ops\autopilot\run_visual_court_bridge.ps1") @(
        "-MissionId", "A20Q_TEST_A20P",
        "-EvidencePath", "fixture/a20p",
        "-OutputPath", $bridgeOut,
        "-Mode", "OFFLINE_FIXTURE_MODE",
        "-TargetVisualLevel", "PUBLIC_TEASER_READY_WITH_CAVEATS"
    )
    Assert-True ($bridge.mode_result -eq "BRIDGE_READY_MANUAL_FIXTURE") "offline fixture bridge did not complete cleanly"
    Assert-True ([double]$bridge.score_estimate_after_bridge -eq 17.5) "offline fixture bridge should estimate 17.5"
    Assert-True ($bridge.live_chatgpt_called -eq $false) "offline fixture bridge called ChatGPT"
    Assert-True ($bridge.live_gemini_called -eq $false) "offline fixture bridge called Gemini"
    Assert-True (Test-Path -LiteralPath (Join-Path $bridgeOut "manual_input_templates\gemini_output_template.json")) "manual Gemini template missing"
    Assert-True (Test-Path -LiteralPath (Join-Path $bridgeOut "next_visual_mission_prompt.md")) "next prompt missing"

    $prompt = Get-Content -LiteralPath (Join-Path $bridgeOut "next_visual_mission_prompt.md") -Raw
    Assert-True ($prompt -match "Allowed Paths") "next prompt missing allowed paths"
    Assert-True ($prompt -match "Forbidden Paths") "next prompt missing forbidden paths"
    Assert-True ($prompt -match "Exact Stop Conditions") "next prompt missing stop conditions"

    $validate = Join-Path $RepoRoot "ops\autopilot\validate_visual_judge_output.ps1"
    $fixtures = Join-Path $RepoRoot "ops\autopilot\fixtures\judges"

    $placeholder = Invoke-Json $validate @("-InputPath", (Join-Path $fixtures "gemini_placeholder_praise_invalid.json"), "-JudgeType", "gemini")
    Assert-True ($placeholder.validation_result -eq "INVALID_OUTPUT") "placeholder Gemini output was not invalid"
    Assert-True ($placeholder.placeholder_praise_detected -eq $true) "placeholder praise was not detected"

    $chatgptBad = Invoke-Json $validate @("-InputPath", (Join-Path $fixtures "chatgpt_text_only_overapproval_invalid.json"), "-JudgeType", "chatgpt")
    Assert-True ($chatgptBad.validation_result -eq "INVALID_OUTPUT") "ChatGPT text-only overapproval was not invalid"
    Assert-True ($chatgptBad.public_ready_without_screenshots -eq $true) "public-ready without screenshots was not detected"

    $codexBad = Invoke-Json $validate @("-InputPath", (Join-Path $fixtures "codex_self_congratulatory_patch_invalid.json"), "-JudgeType", "codex")
    Assert-True ($codexBad.validation_result -eq "INVALID_OUTPUT") "Codex self-congratulatory output was not invalid"

    $missing = Invoke-Json $validate @("-InputPath", (Join-Path $TempRoot "missing.json"), "-JudgeType", "gemini")
    Assert-True ($missing.validation_result -eq "MISSING_INPUT") "missing judge input was not recorded"

    $manualOut = Join-Path $TempRoot "manual_bridge"
    $manual = Invoke-Json (Join-Path $RepoRoot "ops\autopilot\run_visual_court_bridge.ps1") @(
        "-MissionId", "A20Q_TEST_MANUAL",
        "-EvidencePath", "fixture/a20p",
        "-OutputPath", $manualOut,
        "-Mode", "MANUAL_PACKET_MODE",
        "-TargetVisualLevel", "PUBLIC_TEASER_READY_WITH_CAVEATS",
        "-GeminiPath", (Join-Path $fixtures "a20p_gemini_visual_observation_good.json"),
        "-ChatGptPath", (Join-Path $fixtures "a20p_chatgpt_art_direction_review_good.json"),
        "-CodexPath", (Join-Path $fixtures "a20p_codex_patch_plan_good.json"),
        "-HardGatePath", (Join-Path $bridgeOut "fixture_judge_outputs\hard_gate_a20p_pass.json")
    )
    Assert-True ($manual.mode_result -eq "BRIDGE_READY_MANUAL_FIXTURE") "manual import simulation did not complete cleanly"
    Assert-True ($manual.missing_judges.Count -eq 0) "manual import simulation recorded missing judges"

    $hardFailOut = Join-Path $TempRoot "hard_fail_bridge"
    $hardFail = Invoke-Json (Join-Path $RepoRoot "ops\autopilot\run_visual_court_bridge.ps1") @(
        "-MissionId", "A20Q_TEST_HARD_GATE",
        "-EvidencePath", "fixture/a20p",
        "-OutputPath", $hardFailOut,
        "-Mode", "MANUAL_PACKET_MODE",
        "-TargetVisualLevel", "PUBLIC_TEASER_READY_WITH_CAVEATS",
        "-GeminiPath", (Join-Path $fixtures "a20p_gemini_visual_observation_good.json"),
        "-ChatGptPath", (Join-Path $fixtures "a20p_chatgpt_art_direction_review_good.json"),
        "-CodexPath", (Join-Path $fixtures "a20p_codex_patch_plan_good.json"),
        "-HardGatePath", (Join-Path $fixtures "hard_gate_fail_with_gemini_praise.json")
    )
    Assert-True ($hardFail.hard_gate_override -eq $true) "hard gate failure did not override praise"
    Assert-True ($hardFail.selected_action -ne "accept") "hard gate failure was accepted"

    $invalidPublic = Invoke-Json $validate @("-InputPath", (Join-Path $fixtures "missing_screenshot_public_ready_invalid.json"), "-JudgeType", "gemini")
    Assert-True ($invalidPublic.validation_result -eq "INVALID_OUTPUT") "public-ready without screenshots was accepted"

    $conflict = Invoke-Json $validate @("-InputPath", (Join-Path $fixtures "conflicting_judges_creative_director_patch.json"), "-JudgeType", "chatgpt")
    Assert-True ($conflict.validation_result -eq "VALID_OUTPUT") "conflicting-but-concrete judge fixture should be valid"

    $liveOut = Join-Path $TempRoot "safe_live"
    $live = Invoke-Json (Join-Path $RepoRoot "ops\autopilot\run_visual_court_bridge.ps1") @(
        "-MissionId", "A20Q_TEST_LIVE_STOP",
        "-EvidencePath", "fixture/a20p",
        "-OutputPath", $liveOut,
        "-Mode", "SAFE_LIVE_READONLY_MODE",
        "-TargetVisualLevel", "PUBLIC_TEASER_READY_WITH_CAVEATS"
    )
    $safety = Read-Json (Join-Path $liveOut "safety_report.json")
    Assert-True ($live.mode_result -eq "LIVE_MODE_NOT_CONFIGURED_STOPPED") "safe live mode did not stop cleanly"
    Assert-True ($safety.safety_stop -eq "SAFE_LIVE_READONLY_MODE_NOT_CONFIGURED_USE_MANUAL_PACKET_MODE") "safe live stop reason missing"
    Assert-True ($safety.bypass_attempted -eq $false) "safe live mode attempted bypass"

    foreach ($schema in @(
        "visual_court_bridge_run.schema.json",
        "visual_judge_output_validation.schema.json",
        "visual_court_merged_summary.schema.json",
        "visual_court_safety_report.schema.json"
    )) {
        $schemaPath = Join-Path $RepoRoot "ops\autopilot\schemas\$schema"
        Assert-True (Test-Path -LiteralPath $schemaPath -PathType Leaf) "missing bridge schema $schema"
        Get-Content -LiteralPath $schemaPath -Raw | ConvertFrom-Json | Out-Null
    }

    $policy = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\all_night_readiness_policy.yaml") -Raw
    foreach ($token in @(
        "visual_court_bridge_required_for_visual_lane_18: true",
        "visual_court_live_mode_optional: true",
        "visual_court_manual_packet_mode_allowed: true",
        "visual_court_missing_judges_not_pass: true",
        "visual_court_placeholder_praise_invalid: true",
        "visual_court_hard_gate_veto: true",
        "visual_court_human_verification_stop: true"
    )) {
        Assert-True ($policy -match [regex]::Escape($token)) "policy missing $token"
    }

    $changed = @(git -C $RepoRoot status --porcelain=v1 | ForEach-Object { $_.Substring(3).Trim() -replace "\\", "/" })
    $forbiddenTouched = @($changed | Where-Object {
        $_ -like "frontend/*" -or
        $_ -like "backend/*" -or
        $_ -like "docs/rebuild/*" -or
        $_ -like "plan/*" -or
        $_ -eq "package.json" -or
        $_ -eq "package-lock.json" -or
        $_ -like "ops/autopilot/local/*" -or
        $_ -like ".serena/*"
    })
    Assert-True ($forbiddenTouched.Count -eq 0) "forbidden files touched: $($forbiddenTouched -join ', ')"

    [ordered]@{
        status = "pass"
        tests = 16
        fixture_mode = "PASS"
        manual_packet_mode = "PASS"
        safe_live_mode = "STOPPED_NOT_CONFIGURED"
        placeholder_praise_rejected = $true
        hard_gate_veto = $true
        missing_judges_not_pass = $true
        live_chatgpt_called = $false
        live_gemini_called = $false
        product_mission_executed = $false
        browser_required = $false
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}
