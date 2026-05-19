param(
    [string]$MissionId = "A20AU",
    [string]$UtilityPath = "",
    [string]$ObjectiveId = "",
    [string]$OutPath = "",
    [string]$ContractOutPath = "",
    [int]$MaxWords = 900
)

$ErrorActionPreference = "Stop"

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Write-TextFile {
    param([string]$Path, [string]$Text)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Text | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Count-Words {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return 0 }
    return @($Text -split '\s+' | Where-Object { $_ }).Count
}

function New-FallbackWinner {
    param([string]$Id)
    $isA20AV = $Id -match "^A20AV_"
    $isA20AW = $Id -match "^A20AW_"
    $isA20AZ = $Id -match "^A20AZ_"
    [pscustomobject]@{
        id = $Id
        expected_value = if ($isA20AZ) { "Run a DEV-only true overnight live-supervised pixel lane, attempt or park external supervisors, and prove at least twelve useful visible pixel deltas." } elseif ($isA20AW) { "Run a DEV-only full-night pixel rehearsal and prove at least five useful visible pixel deltas." } elseif ($isA20AV) { "Run a DEV-only autonomous pixel rehearsal and prove at least two visible pixel deltas." } else { "Create visible DEV-only OMEGA Pixel Lab proof and route the next pixel mission." }
        family = "SIGNATURE_COMPONENTS"
        risk_tier = "low"
        allowed_paths = if ($isA20AZ) { @("frontend/src/dev/true-overnight-live-run/**", "frontend/src/App.tsx", "scripts/**", "docs/autopilot/**", "ops/autopilot/**") } elseif ($isA20AW) { @("frontend/src/dev/full-night-pixel-rehearsal/**", "frontend/src/App.tsx", "scripts/**", "docs/autopilot/**", "ops/autopilot/**") } elseif ($isA20AV) { @("frontend/src/dev/autonomous-pixel-rehearsal/**", "frontend/src/App.tsx", "scripts/**", "docs/autopilot/**", "ops/autopilot/**") } else { @("frontend/src/dev/omega-pixel-lab/**", "frontend/src/App.tsx", "scripts/**", "docs/autopilot/**", "ops/autopilot/**") }
        forbidden_paths = @("backend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
        expected_artifacts = if ($isA20AZ) { @("pixel_delta_manifest.json", "screenshots/**", "mission_doctor_results.json", "chatgpt_supervisor_attempts.json", "gemini_visual_attempts.json", "morning_report.md") } elseif ($isA20AW) { @("pixel_delta_manifest.json", "screenshots/**", "mission_doctor_results.json", "morning_report.md") } elseif ($isA20AV) { @("pixel_delta_manifest.json", "screenshots/**", "mission_doctor_results.json") } else { @("omega_pixel_lab_smoke_report.json", "screenshot/**", "selected_contract.md") }
        success_criteria = if ($isA20AZ) { @("twelve_pixel_deltas_visible", "supervisor_attempts_or_parked_lanes_recorded", "screenshots_external", "mission_doctor_pass", "night_ready", "no_product_integration") } elseif ($isA20AW) { @("five_pixel_deltas_visible", "screenshots_external", "mission_doctor_pass", "night_ready", "no_product_integration") } elseif ($isA20AV) { @("two_pixel_deltas_visible", "screenshots_external", "mission_doctor_pass", "no_product_integration") } else { @("visible_dev_route", "pixel_pilot_screenshot_external", "browser_smoke_pass", "no_product_integration") }
    }
}

$winner = $null
if (-not [string]::IsNullOrWhiteSpace($UtilityPath) -and (Test-Path -LiteralPath $UtilityPath -PathType Leaf)) {
    $utility = Get-Content -LiteralPath $UtilityPath -Raw | ConvertFrom-Json
    $winner = $utility.winner
}
if (-not $winner) {
    if ([string]::IsNullOrWhiteSpace($ObjectiveId)) { $ObjectiveId = "A20AU_VARIANT_REFINEMENT_FOR_PROVISIONAL_WINNERS" }
    $winner = New-FallbackWinner -Id $ObjectiveId
}

$expectedProof = if ($MissionId -eq "A20AZ") {
    @(
        "DEV-only /app?trueOvernightLiveRun=1 route visible.",
        "At least twelve pixel delta previews rendered, not text-only.",
        "External screenshots captured outside the repo for each true-overnight iteration.",
        "ChatGPT/Gemini attempts are recorded or lanes are parked with alert evidence.",
        "Browser smoke verifies OMEGA decision log, supervisor logs, parked lanes, Mission Doctor summaries, score progression, and morning report."
    )
} elseif ($MissionId -eq "A20AW") {
    @(
        "DEV-only /app?fullNightPixelRehearsal=1 route visible.",
        "At least five pixel delta previews rendered, not text-only.",
        "External screenshots captured outside the repo for each full-night iteration.",
        "Browser smoke verifies OMEGA decision log, Mission Doctor summaries, score progression, and pixel deltas.",
        "Mission Doctor records at least three useful pixel deltas and NightReadinessV2 stays NIGHT_READY."
    )
} elseif ($MissionId -eq "A20AV") {
    @(
        "DEV-only /app?autonomousPixelRehearsal=1 route visible.",
        "At least two pixel delta previews rendered, not text-only.",
        "External screenshots captured outside the repo for each rehearsal iteration.",
        "Browser smoke verifies OMEGA decision summary, score update, and pixel deltas.",
        "Mission Doctor records a conservative result for each iteration."
    )
} else {
    @(
        "DEV-only /app?omegaPixelLab=1 route or selected pixel route visible.",
        "At least one visual pilot artifact rendered, not text-only.",
        "External screenshot evidence captured outside the repo.",
        "Browser smoke verifies bottleneck, selected objective, and pilot artifact.",
        "Mission Doctor or OMEGA grading records conservative score delta."
    )
}
if (@($expectedProof).Count -eq 0) { throw "PROOF_REQUIRED" }

$tests = if ($MissionId -eq "A20AZ") {
    @(
        "git diff --check",
        "cd frontend; npm run build",
        "cd frontend; npx tsc --noEmit",
        "node scripts/browser_true_overnight_live_run_smoke.mjs",
        "powershell -ExecutionPolicy Bypass -File ops/autopilot/test_omega_autopilot.ps1",
        "python tools/plan_guard.py"
    )
} elseif ($MissionId -eq "A20AW") {
    @(
        "git diff --check",
        "cd frontend; npm run build",
        "cd frontend; npx tsc --noEmit",
        "node scripts/browser_full_night_pixel_rehearsal_smoke.mjs",
        "powershell -ExecutionPolicy Bypass -File ops/autopilot/test_omega_autopilot.ps1",
        "python tools/plan_guard.py"
    )
} elseif ($MissionId -eq "A20AV") {
    @(
        "git diff --check",
        "cd frontend; npm run build",
        "cd frontend; npx tsc --noEmit",
        "node scripts/browser_autonomous_pixel_rehearsal_smoke.mjs",
        "powershell -ExecutionPolicy Bypass -File ops/autopilot/test_omega_autopilot.ps1",
        "python tools/plan_guard.py"
    )
} else {
    @(
        "git diff --check",
        "cd frontend; npm run build",
        "cd frontend; npx tsc --noEmit",
        "node scripts/browser_omega_pixel_lab_smoke.mjs",
        "powershell -ExecutionPolicy Bypass -File ops/autopilot/test_omega_autopilot.ps1",
        "python tools/plan_guard.py"
    )
}

$evidenceArtifacts = if ($MissionId -eq "A20AZ") {
    @(
        "omega_decision_log.json",
        "mission_doctor_results.json",
        "pixel_delta_manifest.json",
        "chatgpt_supervisor_attempts.json",
        "gemini_visual_attempts.json",
        "parked_lanes.json",
        "screenshots/*.png",
        "morning_report.md",
        "night_readiness_after_run.json",
        "score_update.json"
    )
} elseif ($MissionId -eq "A20AW") {
    @(
        "omega_decision_log.json",
        "mission_doctor_results.json",
        "pixel_delta_manifest.json",
        "screenshots/*.png",
        "morning_report.md",
        "night_readiness_after_rehearsal.json",
        "score_update.json"
    )
} elseif ($MissionId -eq "A20AV") {
    @(
        "omega_decision_log.json",
        "mission_doctor_results.json",
        "pixel_delta_manifest.json",
        "screenshots/*.png",
        "morning_style_report.md",
        "score_update.json"
    )
} else {
    @(
        "bottleneck_detection_result.json",
        "utility_ranking_result.json",
        "omega_pixel_lab_smoke_report.json",
        "screenshot/omega_pixel_lab.png",
        "score_update.json"
    )
}

$finalVerdicts = if ($MissionId -eq "A20AZ") {
    @(
        "TRUE_OVERNIGHT_LIVE_SUPERVISED_PASS",
        "TRUE_OVERNIGHT_OFFLINE_PASS_LIVE_SUPERVISOR_WEAK",
        "TRUE_OVERNIGHT_RUN_TOO_SHORT",
        "TRUE_OVERNIGHT_PARTIAL",
        "TRUE_OVERNIGHT_FAILED_META_DRIFT",
        "TRUE_OVERNIGHT_FAILED_SAFETY",
        "TRUE_OVERNIGHT_FAILED"
    )
} elseif ($MissionId -eq "A20AW") {
    @(
        "FULL_NIGHT_PIXEL_REHEARSAL_PASS_19_5_CANDIDATE",
        "FULL_NIGHT_PIXEL_REHEARSAL_PASS_NOT_19_5",
        "FULL_NIGHT_REHEARSAL_PARTIAL_PIXEL_DELTAS_WEAK",
        "FULL_NIGHT_REHEARSAL_FAILED_META_DRIFT",
        "FULL_NIGHT_REHEARSAL_FAILED"
    )
} elseif ($MissionId -eq "A20AV") {
    @(
        "LIMITED_AUTONOMOUS_PIXEL_REHEARSAL_PASS_FULL_NIGHT_CANDIDATE",
        "LIMITED_AUTONOMOUS_PIXEL_REHEARSAL_PASS",
        "LIMITED_REHEARSAL_PARTIAL_PIXEL_DELTAS_WEAK",
        "LIMITED_REHEARSAL_FAILED_NO_PIXEL_DELTAS",
        "LIMITED_REHEARSAL_FAILED"
    )
} else {
    @(
        "OMEGA_KERNEL_READY_LIMITED_NIGHT_REHEARSAL_NEXT",
        "OMEGA_KERNEL_PARTIAL_PIXEL_LAB_WEAK",
        "OMEGA_KERNEL_PARTIAL_NIGHT_NOT_READY",
        "OMEGA_KERNEL_FAILED_NO_PIXEL_PROOF",
        "OMEGA_KERNEL_FAILED"
    )
}

$scoreDeltaRules = if ($MissionId -eq "A20AZ") {
    [ordered]@{
        overall_max_after_a20az = 19.5
        no_score_increase_without_runtime_or_live_supervisor_proof = $true
        live_supervised_pass_requires_runtime_or_valid_stop_reason = $true
        visual_production_requires_screenshot = $true
        no_human_validation_without_human_data = $true
        no_public_release_claim = $true
    }
} elseif ($MissionId -eq "A20AW") {
    [ordered]@{
        overall_max_after_a20aw = 19.5
        nineteen_five_candidate_requires_five_useful_pixel_deltas = $true
        visual_production_requires_screenshot = $true
        full_night_rehearsal_not_public_release = $true
        no_human_validation_without_human_data = $true
    }
} elseif ($MissionId -eq "A20AV") {
    [ordered]@{
        overall_max_after_a20av = 19.35
        no_19_5_without_full_night_rehearsal = $true
        visual_production_requires_screenshot = $true
        no_human_validation_without_human_data = $true
    }
} else {
    [ordered]@{
        overall_max_after_a20au = 19.15
        no_19_5_without_limited_pixel_rehearsal = $true
        visual_production_requires_screenshot = $true
        no_human_validation_without_human_data = $true
    }
}

$contract = [ordered]@{
    schema_version = "proof_carrying_contract_v1"
    mission_id = $MissionId
    objective_id = [string]$winner.id
    objective = [string]$winner.expected_value
    expected_proof = $expectedProof
    allowed_paths = @($winner.allowed_paths)
    forbidden_paths = @($winner.forbidden_paths)
    max_files = 8
    max_diff_lines = 1200
    test_commands = $tests
    stop_conditions = @(
        "Stop if frontend product flow changes.",
        "Stop if screenshot evidence cannot be written outside the repo.",
        "Stop if contract exceeds 900 words after compression.",
        "Stop if backend, package, DB, local/runtime, screenshots, or secrets would be staged."
    )
    evidence_artifacts = $evidenceArtifacts
    score_delta_rules = $scoreDeltaRules
    safety_rules = @(
        "No road push or merge.",
        "No A21 or Night Mode launch.",
        "No backend, package, DB, paid platform, PII, private URL, or secret changes.",
        "No user intervention, CAPTCHA, 2FA, consent, or human verification automation.",
        "Frontend changes must remain DEV-only."
    )
    final_verdicts = $finalVerdicts
}

$markdown = @"
# OMEGA Proof-Carrying Contract

Mission: $($contract.mission_id)
Objective: $($contract.objective_id)

## Objective
$($contract.objective)

## Expected Proof
$($contract.expected_proof | ForEach-Object { "- $_" } | Out-String)
## Allowed Paths
$($contract.allowed_paths | ForEach-Object { "- $_" } | Out-String)
## Forbidden Paths
$($contract.forbidden_paths | ForEach-Object { "- $_" } | Out-String)
## Validation
$($contract.test_commands | ForEach-Object { "- $_" } | Out-String)
## Stop Conditions
$($contract.stop_conditions | ForEach-Object { "- $_" } | Out-String)
## Safety
$($contract.safety_rules | ForEach-Object { "- $_" } | Out-String)
"@

$wordCount = Count-Words -Text $markdown
if ($wordCount -gt $MaxWords) {
    $markdown = @"
# OMEGA Proof-Carrying Contract

Mission: $($contract.mission_id)
Objective: $($contract.objective_id)
Proof: DEV-only route, visible pixel artifact, external screenshot, smoke report, conservative score delta.
Allowed: $(@($contract.allowed_paths) -join ", ")
Forbidden: $(@($contract.forbidden_paths) -join ", ")
Validation: git diff --check; frontend build; tsc; browser smoke; OMEGA tests; plan guard.
Stop: product flow change, repo screenshots, secrets, backend/package/DB touch, user/live-web dependency, or contract over budget.
"@
    $wordCount = Count-Words -Text $markdown
}
if ($wordCount -gt $MaxWords) { throw "CONTRACT_TOO_LARGE" }

$contract.contract_word_count = $wordCount
$contract.status = "PROOF_CARRYING_CONTRACT_READY"
$contract.giant_prompt_prevented = $true

Write-JsonFile -Path $OutPath -Payload $contract
Write-TextFile -Path $ContractOutPath -Text $markdown
$contract | ConvertTo-Json -Depth 50
exit 0
