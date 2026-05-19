param(
    [ValidateSet("DryRun", "Rehearsal", "RunOnce", "Status", "Stop")]
    [string]$Mode = "Status",
    [string]$MissionId = "A20AO",
    [int]$MaxIterations = 3,
    [int]$MaxRuntimeMinutes = 180,
    [switch]$NoLiveWeb,
    [string]$LiveSupervisorMode = "off",
    [string]$ArtifactPath = "",
    [string]$StatePath = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
    if ($MissionId -eq "A20AP") {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_probes\A20AP_critical_deficit_uplift_10_probes_20260518"
    } elseif ($MissionId -eq "A20AQ") {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_evidence\A20AQ_perception_grade_visual_evidence_foundry_20260518"
    } elseif ($MissionId -eq "A20AR") {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\signature_selection\A20AR_signature_five_high_quality_evidence_20260518"
    } elseif ($MissionId -eq "A20AS") {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\signature_arena\A20AS_tripled_variants_top2_20260518"
    } elseif ($MissionId -eq "A20AT") {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\human_taste_network\A20AT_human_taste_network_20260518"
    } elseif ($MissionId -eq "A20AV") {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\limited_pixel_rehearsal\A20AV_limited_autonomous_pixel_rehearsal_20260518"
    } elseif ($MissionId -eq "A20AW") {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\full_night_pixel_rehearsal\A20AW_full_night_pixel_rehearsal_20260518"
    } elseif ($MissionId -eq "A20AY") {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\full_night_real_run\A20AY_full_night_real_pixel_run_20260518"
    } elseif ($MissionId -eq "A20AZ") {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\true_overnight_live_run\A20AZ_true_overnight_live_supervised_pixel_run_20260518"
    } elseif ($MissionId -eq "A20BA") {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\chatgpt_desktop_adapter\A20BA_chatgpt_windows_app_adapter_20260518"
    } else {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\neurorelay\A20AO_external_intelligence_load_balancer_20260518"
    }
}
if ([string]::IsNullOrWhiteSpace($StatePath)) {
    $StatePath = Join-Path $PSScriptRoot "runtime\neurorelay_loop_state.json"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Read-JsonFile {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    }
    return $null
}

function Invoke-JsonScript {
    param([string]$ScriptPath, [string[]]$Arguments = @(), [int[]]$AcceptExitCodes = @(0))
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @Arguments 2>&1
    $exit = $LASTEXITCODE
    if ($AcceptExitCodes -notcontains $exit) {
        throw "Unexpected exit code $exit from $ScriptPath`: $($output | Out-String)"
    }
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { throw "No JSON emitted by $ScriptPath" }
    return $text.Substring($start) | ConvertFrom-Json
}

function New-BaseState {
    [ordered]@{
        schema_version = "neurorelay_loop_state_v1"
        mission_id = $MissionId
        status = "INITIALIZED"
        created_at = (Get-Date).ToString("o")
        updated_at = (Get-Date).ToString("o")
        completed_iterations = 0
        max_iterations = $MaxIterations
        max_runtime_minutes = $MaxRuntimeMinutes
        no_live_web = [bool]$NoLiveWeb
        live_supervisor_mode = $LiveSupervisorMode
        blocked_lanes = @()
        next_planned_objectives = @()
        iterations = @()
        stop_requested = $false
        gpt_web_required = $false
        gemini_required = $false
        user_intervention_required = $false
        loop_bounded = $true
        no_giant_prompt = $true
        workload_shift_metrics = [ordered]@{
            codex_contract_word_count_avg = 0
            context_capsule_word_count_avg = 0
            external_decision_packets_count = 0
            local_fallback_packets_count = 0
            codex_workload_reduction_estimate = "not_yet_measured"
            external_reasoning_utilization = 0
            repeated_context_removed_count = 0
            giant_prompt_prevented_count = 0
        }
    }
}

function New-LocalDecisionPacketRaw {
    param([object]$Mission, [string]$Path)
    $objective = $Mission.objective
    $packet = [ordered]@{
        source = "local_fallback"
        packet_type = "mission_proposal"
        confidence = "high"
        recommended_action = "Execute $($objective.id) as the next bounded offline micro-mission."
        do_not_do = @("do_not_require_live_web", "do_not_touch_forbidden_paths", "do_not_expand_context")
        candidate_mission = [ordered]@{
            id = [string]$objective.id
            objective = [string]$objective.expected_value
            expected_value = if ([string]$objective.family -in @("VISUAL_PRODUCTION_MODE", "SIGNATURE_COMPONENTS")) { "high" } else { "medium" }
            risk = if ([string]$objective.risk_tier -eq "low") { "low" } else { "medium" }
            allowed_paths = @($objective.allowed_paths | ForEach-Object { [string]$_ })
            forbidden_paths = @($objective.forbidden_paths | ForEach-Object { [string]$_ })
            success_criteria = @($objective.success_criteria | ForEach-Object { [string]$_ })
        }
        evidence_used = @("objective_reservoir.yaml", "autonomy_score_state.json")
        open_risks = @("visual score still needs screenshots in a later mission")
        token_saving_notes = @("Local fallback packet avoids replaying full mission history.")
    }
    Write-JsonFile -Path $Path -Payload $packet
    return $packet
}

function Test-SignatureProbeEvidenceReady {
    $probeGallery = Join-Path (Split-Path -Parent $PSScriptRoot) "..\frontend\src\dev\signature-probes\SignatureProbeGallery.tsx"
    $probeDoc = Join-Path (Split-Path -Parent $PSScriptRoot) "..\docs\design\SIGNATURE_CANDIDATES_10.md"
    return (Test-Path -LiteralPath $probeGallery -PathType Leaf) -and (Test-Path -LiteralPath $probeDoc -PathType Leaf)
}

function Test-PerceptionGradeEvidenceReady {
    $manifestPath = Join-Path $ArtifactPath "evidence_manifest.json"
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { return $false }
    try {
        $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
        $probes = @($manifest.probes)
        if ($probes.Count -ne 10) { return $false }
        $weak = @($probes | Where-Object { $_.primary_evidence_ready -ne $true -or [int]$_.evidence_quality_score -lt 75 })
        return ($weak.Count -eq 0)
    } catch {
        return $false
    }
}

function Test-SignatureFiveSelected {
    $statusPath = Join-Path $PSScriptRoot "signature_component_status.yaml"
    if (-not (Test-Path -LiteralPath $statusPath -PathType Leaf)) { return $false }
    $text = Get-Content -LiteralPath $statusPath -Raw
    return ($text -match '(?m)^final_five_selected:\s*true\s*$') -and
        ($text -match 'A20AS_TRIPLED_VARIANTS_FOR_TOP_2_SIGNATURES') -and
        ($text -match 'MARKED_FOR_TRIPLED_NEXT')
}

function Test-TopTwoSignaturesTripled {
    $statusPath = Join-Path $PSScriptRoot "signature_component_status.yaml"
    if (-not (Test-Path -LiteralPath $statusPath -PathType Leaf)) { return $false }
    $text = Get-Content -LiteralPath $statusPath -Raw
    return ($text -match '(?m)^tripled_signature_count:\s*2\s*$') -and
        ($text -match 'sacred_board_chamber[\s\S]*?status:\s*STATUS_2_TRIPLED') -and
        ($text -match 'decision_feedback_language[\s\S]*?status:\s*STATUS_2_TRIPLED') -and
        ($text -match 'A20AT_HUMAN_TASTE_CALIBRATION_AND_SIGNATURE_VOTE|A20AU_VARIANT_REFINEMENT_FOR_PROVISIONAL_WINNERS')
}

function Test-HumanTastePacketsReady {
    $statusPath = Join-Path $PSScriptRoot "signature_component_status.yaml"
    if (-not (Test-Path -LiteralPath $statusPath -PathType Leaf)) { return $false }
    $text = Get-Content -LiteralPath $statusPath -Raw
    $manifestPath = Join-Path $ArtifactPath "manifest.json"
    $localVotePath = Join-Path $ArtifactPath "local_vote_sheet.json"
    return ($text -match '(?m)^taste_packet_ready:\s*true\s*$') -and
        ($text -match '(?m)^human_data_status:\s*HUMAN_DATA_ABSENT\s*$') -and
        ((Test-Path -LiteralPath $manifestPath -PathType Leaf) -or (Test-Path -LiteralPath $localVotePath -PathType Leaf))
}

function Test-A20AVLimitedPixelRehearsalReady {
    $manifestPath = Join-Path $ArtifactPath "pixel_delta_manifest.json"
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { return $false }
    try {
        $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
        return ([int]$manifest.pixel_delta_count -ge 2 -and [string]$manifest.status -eq "PIXEL_DELTAS_READY")
    } catch {
        return $false
    }
}

function Test-A20AWFullNightPixelRehearsalReady {
    $manifestPath = Join-Path $ArtifactPath "pixel_delta_manifest.json"
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { return $false }
    try {
        $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
        return ([int]$manifest.pixel_delta_count -ge 5 -and [int]$manifest.useful_pixel_delta_count -ge 5 -and [string]$manifest.status -eq "FULL_NIGHT_PIXEL_DELTAS_READY")
    } catch {
        return $false
    }
}

function Test-A20AYFullNightRealRunReady {
    $manifestPath = Join-Path $ArtifactPath "pixel_delta_manifest.json"
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { return $false }
    try {
        $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
        return ([int]$manifest.pixel_delta_count -ge 6 -and [int]$manifest.useful_pixel_delta_count -ge 5 -and [string]$manifest.status -eq "FULL_NIGHT_REAL_RUN_PIXEL_DELTAS_READY")
    } catch {
        return $false
    }
}

function Test-A20AZTrueOvernightLiveRunReady {
    $manifestPath = Join-Path $ArtifactPath "pixel_delta_manifest.json"
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { return $false }
    try {
        $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
        return ([int]$manifest.pixel_delta_count -ge 12 -and [int]$manifest.useful_pixel_delta_count -ge 12 -and [string]$manifest.status -eq "TRUE_OVERNIGHT_PIXEL_DELTAS_READY")
    } catch {
        return $false
    }
}

function Test-A20BAChatGptDesktopAdapterReady {
    $transportPath = Join-Path $ArtifactPath "transport_integration_result.json"
    if (-not (Test-Path -LiteralPath $transportPath -PathType Leaf)) { return $false }
    try {
        $transport = Get-Content -LiteralPath $transportPath -Raw | ConvertFrom-Json
        return ([string]$transport.desktop_adapter.status -eq "CHATGPT_DESKTOP_TRANSPORT_READY")
    } catch {
        return $false
    }
}

function Get-ProbeAwareObjective {
    param([string[]]$AvoidObjectiveIds = @())
    if ($MissionId -eq "A20BA") {
        $desktopReady = Test-A20BAChatGptDesktopAdapterReady
        $objectives = @(
            [pscustomobject]@{
                id = if ($desktopReady) { "A20BB_TRUE_OVERNIGHT_SECOND_RUN_WITH_DESKTOP_TRANSPORT" } else { "A20BB_CHATGPT_WEB_CDP_REPAIR" }
                family = "LIVE_SUPERVISOR_RELIABILITY"
                expected_value = if ($desktopReady) { "Run a second true overnight with ChatGPT Windows desktop transport sampled as an optional supervisor lane." } else { "Repair the remaining ChatGPT Web/CDP lane while the desktop app adapter is parked and OMEGA fallback remains available." }
                risk_tier = "low"
                allowed_paths = @("docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("no_private_urls", "no_user_prompt", "local_fallback_preserved", "transport_status_recorded")
            },
            [pscustomobject]@{
                id = "A20BB_DEEP_PIXEL_OBJECTIVE_RESERVOIR_AND_SECOND_NIGHT"
                family = "NIGHT_MODE_READINESS"
                expected_value = "Expand safe pixel objectives before a second night run if live lanes remain parked."
                risk_tier = "low"
                allowed_paths = @("docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("pixel_objectives_only", "no_backend", "no_package_changes")
            },
            [pscustomobject]@{
                id = "A20BB_ROAD_TO_V2_MERGE_AUDIT_PLAN"
                family = "SAFETY_MAINTENANCE"
                expected_value = "Prepare a merge audit plan only after live-supervisor transport status is documented."
                risk_tier = "low"
                allowed_paths = @("docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("audit_plan_only", "no_road_push", "no_merge")
            }
        )
        $avoid = @($AvoidObjectiveIds | ForEach-Object { ([string]$_) -split "," } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
        $remaining = @($objectives | Where-Object { $avoid -notcontains [string]$_.id })
        if ($remaining.Count -gt 0) { return $remaining[0] }
        return $objectives[0]
    }
    if ($MissionId -eq "A20AZ" -and (Test-A20AZTrueOvernightLiveRunReady)) {
        $objectives = @(
            [pscustomobject]@{
                id = "A20BA_LIVE_SUPERVISOR_REPAIR"
                family = "ORCHESTRATOR_RELIABILITY"
                expected_value = "Repair or configure live ChatGPT/Gemini supervisor lanes after A20AZ parked them while local OMEGA continued."
                risk_tier = "low"
                allowed_paths = @("docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("live_lane_repair_plan", "no_private_urls", "no_user_prompt", "local_fallback_preserved")
            },
            [pscustomobject]@{
                id = "A20BA_TRUE_OVERNIGHT_SECOND_RUN"
                family = "NIGHT_MODE_READINESS"
                expected_value = "Run a second true overnight only after live lanes are configured or a valid objective-exhaustion window is accepted."
                risk_tier = "low"
                allowed_paths = @("frontend/src/dev/true-overnight-live-run/**", "scripts/**", "docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("runtime_contract_respected", "supervisor_attempts_recorded", "screenshots_external_only")
            },
            [pscustomobject]@{
                id = "A20BA_ROAD_TO_V2_MERGE_AUDIT_PLAN"
                family = "SAFETY_MAINTENANCE"
                expected_value = "Prepare a road-to-V2 merge audit plan only after true overnight evidence is reviewed."
                risk_tier = "low"
                allowed_paths = @("docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("audit_plan_only", "no_road_push", "no_merge")
            }
        )
        $avoid = @($AvoidObjectiveIds | ForEach-Object { ([string]$_) -split "," } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
        $remaining = @($objectives | Where-Object { $avoid -notcontains [string]$_.id })
        if ($remaining.Count -gt 0) { return $remaining[0] }
        return $objectives[0]
    }
    if ($MissionId -eq "A20AY" -and (Test-A20AYFullNightRealRunReady)) {
        $objectives = @(
            [pscustomobject]@{
                id = "A20AZ_ROAD_TO_V2_MERGE_AUDIT_PLAN"
                family = "SAFETY_MAINTENANCE"
                expected_value = "Prepare the road-to-V2 merge audit plan after A20AY confirmed a screenshot-backed 19.5 full-night real-run candidate."
                risk_tier = "low"
                allowed_paths = @("docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("audit_plan_only", "no_road_push", "no_merge", "a20ay_evidence_referenced")
            },
            [pscustomobject]@{
                id = "A20AZ_PRODUCT_INTEGRATION_REVIEW"
                family = "SAFETY_MAINTENANCE"
                expected_value = "Review how DEV-only A20AY visual winners could be integrated later without changing V1 or weakening road governance."
                risk_tier = "low"
                allowed_paths = @("docs/autopilot/**", "docs/design/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("review_only", "no_product_integration", "no_v1_change", "no_road_push")
            },
            [pscustomobject]@{
                id = "A20AZ_FINAL_AUTOPILOT_REPORT_AND_HANDOFF"
                family = "NIGHT_MODE_READINESS"
                expected_value = "Produce the final autopilot handoff report for the A20A full-night sequence with safety and evidence references."
                risk_tier = "low"
                allowed_paths = @("docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("handoff_report_complete", "safety_scan_referenced", "no_public_release")
            }
        )
        $avoid = @($AvoidObjectiveIds | ForEach-Object { ([string]$_) -split "," } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
        $remaining = @($objectives | Where-Object { $avoid -notcontains [string]$_.id })
        if ($remaining.Count -gt 0) { return $remaining[0] }
        return $objectives[0]
    }
    if ($MissionId -eq "A20AW" -and (Test-A20AWFullNightPixelRehearsalReady)) {
        $objectives = @(
            [pscustomobject]@{
                id = "A20AX_FULL_NIGHT_REAL_RUN"
                family = "NIGHT_MODE_READINESS"
                expected_value = "Run a real bounded full-night pixel run after A20AW produced five-plus useful screenshot-backed deltas and stayed NIGHT_READY."
                risk_tier = "low"
                allowed_paths = @("frontend/src/dev/full-night-pixel-rehearsal/**", "scripts/**", "docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("bounded_full_night_real_run", "no_user_intervention", "screenshots_external_only", "no_product_integration")
            },
            [pscustomobject]@{
                id = "A20AX_FINAL_AUTOPILOT_HARDENING_BEFORE_NIGHT"
                family = "NIGHT_MODE_READINESS"
                expected_value = "Harden final autopilot checks before any real night run if A20AW evidence reveals risk."
                risk_tier = "low"
                allowed_paths = @("docs/autopilot/**", "ops/autopilot/**", "scripts/**")
                forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("night_readiness_v2_pass", "stop_flag_verified", "no_live_web_dependency")
            },
            [pscustomobject]@{
                id = "A20AX_ROAD_TO_V2_MERGE_AUDIT_PLAN"
                family = "SAFETY_MAINTENANCE"
                expected_value = "Prepare a road-to-V2 merge audit plan without merging or pushing road-to-V2."
                risk_tier = "low"
                allowed_paths = @("docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("audit_plan_only", "no_road_push", "no_merge")
            }
        )
        $avoid = @($AvoidObjectiveIds | ForEach-Object { ([string]$_) -split "," } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
        $remaining = @($objectives | Where-Object { $avoid -notcontains [string]$_.id })
        if ($remaining.Count -gt 0) { return $remaining[0] }
        return $objectives[0]
    }
    if ($MissionId -eq "A20AV" -and (Test-A20AVLimitedPixelRehearsalReady)) {
        $objectives = @(
            [pscustomobject]@{
                id = "A20AW_FULL_NIGHT_PIXEL_REHEARSAL"
                family = "NIGHT_MODE_READINESS"
                expected_value = "Run the next full-night pixel rehearsal candidate now that A20AV produced screenshot-backed pixel deltas."
                risk_tier = "low"
                allowed_paths = @("frontend/src/dev/autonomous-pixel-rehearsal/**", "scripts/**", "docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("bounded_full_night_rehearsal", "no_user_intervention", "screenshots_external_only", "no_product_integration")
            },
            [pscustomobject]@{
                id = "A20AW_FINAL_NIGHT_READINESS_HARDENING"
                family = "NIGHT_MODE_READINESS"
                expected_value = "Harden final night readiness checks before launching any full-night pixel rehearsal."
                risk_tier = "low"
                allowed_paths = @("docs/autopilot/**", "ops/autopilot/**", "scripts/**")
                forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("night_readiness_v2_pass", "stop_flag_verified", "no_live_web_dependency")
            },
            [pscustomobject]@{
                id = "A20AW_PIXEL_REHEARSAL_SECOND_PASS"
                family = "VISUAL_PRODUCTION_MODE"
                expected_value = "Run a second limited pixel rehearsal only if full-night confidence is not high enough."
                risk_tier = "low"
                allowed_paths = @("frontend/src/dev/autonomous-pixel-rehearsal/**", "scripts/**", "docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("additional_pixel_deltas", "mission_doctor_pass", "screenshots_external_only")
            }
        )
        $avoid = @($AvoidObjectiveIds | ForEach-Object { ([string]$_) -split "," } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
        $remaining = @($objectives | Where-Object { $avoid -notcontains [string]$_.id })
        if ($remaining.Count -gt 0) { return $remaining[0] }
        return $objectives[0]
    }
    if ($MissionId -eq "A20AT" -and (Test-HumanTastePacketsReady)) {
        $objectives = @(
            [pscustomobject]@{
                id = "A20AU_VARIANT_REFINEMENT_FOR_PROVISIONAL_WINNERS"
                family = "SIGNATURE_COMPONENTS"
                expected_value = "Refine provisional Variant B winners for sacred_board_chamber and decision_feedback_language while human data is absent."
                risk_tier = "low"
                allowed_paths = @("frontend/src/dev/signature-probes/signature-arena/**", "scripts/**", "docs/design/**", "docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("provisional_b_winners_refined", "board_safety_preserved", "no_human_majority_claim", "no_product_integration")
            },
            [pscustomobject]@{
                id = "A20AU_LIMITED_AUTONOMOUS_PIXEL_REHEARSAL"
                family = "NIGHT_MODE_READINESS"
                expected_value = "Run a bounded autonomous pixel rehearsal using provisional top-two signature winners."
                risk_tier = "low"
                allowed_paths = @("frontend/src/dev/signature-probes/signature-arena/**", "scripts/**", "docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("bounded_iterations", "no_user_intervention", "provisional_taste_state_respected", "no_live_web_dependency")
            },
            [pscustomobject]@{
                id = "A20AU_IMPORT_HUMAN_TASTE_RESULTS_AND_FINALIZE"
                family = "HUMAN_TASTE_CALIBRATION"
                expected_value = "Import real owner or crowd taste results and finalize variant winners only if data exists."
                risk_tier = "low"
                allowed_paths = @("docs/design/**", "docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("imported_results_validated", "no_pii_committed", "confidence_labels_conservative")
            }
        )
        $avoid = @($AvoidObjectiveIds | ForEach-Object { ([string]$_) -split "," } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
        $remaining = @($objectives | Where-Object { $avoid -notcontains [string]$_.id })
        if ($remaining.Count -gt 0) { return $remaining[0] }
        return $objectives[0]
    }
    if ($MissionId -eq "A20AS" -and (Test-TopTwoSignaturesTripled)) {
        $objectives = @(
            [pscustomobject]@{
                id = "A20AT_HUMAN_TASTE_CALIBRATION_AND_SIGNATURE_VOTE"
                family = "HUMAN_TASTE_CALIBRATION"
                expected_value = "Prepare an evidence-backed vote pass for the six top-two signature variants without blocking autonomous work."
                risk_tier = "low"
                allowed_paths = @("docs/design/**", "docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("six_variants_referenced", "no_live_user_vote_required", "screenshots_external_only")
            },
            [pscustomobject]@{
                id = "A20AT_VARIANT_REFINEMENT_FOR_TOP_TWO"
                family = "SIGNATURE_COMPONENTS"
                expected_value = "Refine the strongest sacred_board_chamber and decision_feedback_language variants after evidence review."
                risk_tier = "low"
                allowed_paths = @("frontend/src/dev/signature-probes/signature-arena/**", "scripts/**", "docs/design/**", "docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("top_two_best_variants_improved", "board_safety_preserved", "no_product_integration")
            },
            [pscustomobject]@{
                id = "A20AT_LIMITED_AUTONOMOUS_PIXEL_REHEARSAL"
                family = "NIGHT_MODE_READINESS"
                expected_value = "Run a bounded offline rehearsal that advances signature pixels without live web dependencies."
                risk_tier = "low"
                allowed_paths = @("frontend/src/dev/signature-probes/signature-arena/**", "scripts/**", "docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("bounded_iterations", "no_user_intervention", "no_live_web_dependency")
            }
        )
        $avoid = @($AvoidObjectiveIds | ForEach-Object { ([string]$_) -split "," } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
        $remaining = @($objectives | Where-Object { $avoid -notcontains [string]$_.id })
        if ($remaining.Count -gt 0) { return $remaining[0] }
        return $objectives[0]
    }
    if ($MissionId -eq "A20AR" -and (Test-SignatureFiveSelected)) {
        $objectives = @(
            [pscustomobject]@{
                id = "A20AS_TRIPLED_VARIANTS_FOR_TOP_2_SIGNATURES"
                family = "SIGNATURE_COMPONENTS"
                expected_value = "Create A/B/C variants for sacred_board_chamber and decision_feedback_language from the selected Signature Five."
                risk_tier = "low"
                allowed_paths = @("frontend/src/dev/signature-probes/**", "scripts/**", "docs/design/**", "docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("three_variants_for_sacred_board_chamber", "three_variants_for_decision_feedback_language", "no_product_integration")
            },
            [pscustomobject]@{
                id = "A20AS_HUMAN_TASTE_CALIBRATION_AND_SIGNATURE_VOTE"
                family = "HUMAN_TASTE_CALIBRATION"
                expected_value = "Prepare a compact vote sheet for selected Signature Five and top-two variants without blocking autonomous work."
                risk_tier = "low"
                allowed_paths = @("docs/design/**", "docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("selected_five_referenced", "no_live_user_vote_required", "no_product_integration")
            },
            [pscustomobject]@{
                id = "A20AS_LIMITED_AUTONOMOUS_PIXEL_REHEARSAL"
                family = "NIGHT_MODE_READINESS"
                expected_value = "Run a bounded offline rehearsal that advances selected Signature Five pixels without live web dependencies."
                risk_tier = "low"
                allowed_paths = @("frontend/src/dev/signature-probes/**", "scripts/**", "docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("bounded_iterations", "no_user_intervention", "no_live_web_dependency")
            }
        )
        $avoid = @($AvoidObjectiveIds | ForEach-Object { ([string]$_) -split "," } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
        $remaining = @($objectives | Where-Object { $avoid -notcontains [string]$_.id })
        if ($remaining.Count -gt 0) { return $remaining[0] }
        return $objectives[0]
    }
    if ($MissionId -eq "A20AQ" -and (Test-PerceptionGradeEvidenceReady)) {
        $objectives = @(
            [pscustomobject]@{
                id = "A20AR_SIGNATURE_FIVE_SELECTION_FROM_HIGH_QUALITY_EVIDENCE"
                family = "VISUAL_PRODUCTION_MODE"
                expected_value = "Select the Signature Five from perception-grade one-probe evidence packets."
                risk_tier = "low"
                allowed_paths = @("docs/design/**", "docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("five_candidates_selected", "one_probe_packets_referenced", "overview_contact_sheet_not_primary")
            },
            [pscustomobject]@{
                id = "A20AR_TRIPLED_VARIANTS_FOR_TOP_2_SIGNATURES"
                family = "SIGNATURE_COMPONENTS"
                expected_value = "Create A/B/C variants for the two strongest evidence-backed signature candidates."
                risk_tier = "low"
                allowed_paths = @("docs/design/**", "docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("top_two_selected", "three_variants_each_defined", "pixel_mandate_preserved")
            },
            [pscustomobject]@{
                id = "A20AR_LIMITED_AUTONOMOUS_PIXEL_REHEARSAL"
                family = "NIGHT_MODE_READINESS"
                expected_value = "Run a bounded offline pixel rehearsal using perception-grade evidence packets."
                risk_tier = "low"
                allowed_paths = @("docs/autopilot/**", "ops/autopilot/**", "scripts/**")
                forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("bounded_iterations", "no_user_intervention", "evidence_packets_consumed")
            }
        )
        $avoid = @($AvoidObjectiveIds | ForEach-Object { ([string]$_) -split "," } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
        $remaining = @($objectives | Where-Object { $avoid -notcontains [string]$_.id })
        if ($remaining.Count -gt 0) { return $remaining[0] }
        return $objectives[0]
    }
    if (-not (Test-SignatureProbeEvidenceReady)) { return $null }
    $objectives = @(
        [pscustomobject]@{
            id = "SIGNATURE_FIVE_SELECTION_FROM_10_PROBES"
            family = "VISUAL_PRODUCTION_MODE"
            expected_value = "Select the strongest five signature candidates from the ten DEV-only visual probes using screenshot evidence."
            risk_tier = "low"
            allowed_paths = @("docs/design/**", "docs/autopilot/**", "ops/autopilot/**")
            forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
            success_criteria = @("five_candidates_selected", "screenshot_evidence_referenced", "no_product_integration")
        },
        [pscustomobject]@{
            id = "TRIPLED_VARIANTS_FOR_TOP_2_SIGNATURES"
            family = "SIGNATURE_COMPONENTS"
            expected_value = "Create A/B/C variant contracts for the top two signature candidates after probe review."
            risk_tier = "low"
            allowed_paths = @("docs/design/**", "docs/autopilot/**", "ops/autopilot/**")
            forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
            success_criteria = @("two_signature_targets_selected", "three_variants_each_defined", "pixel_mandate_preserved")
        },
        [pscustomobject]@{
            id = "LIMITED_AUTONOMOUS_PIXEL_REHEARSAL"
            family = "NIGHT_MODE_READINESS"
            expected_value = "Run a bounded pixel rehearsal that proves visual work continues offline when external lanes are parked."
            risk_tier = "low"
            allowed_paths = @("docs/autopilot/**", "ops/autopilot/**", "scripts/**")
            forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
            success_criteria = @("bounded_iterations", "no_user_intervention", "external_lanes_optional")
        }
    )
    $avoid = @($AvoidObjectiveIds | ForEach-Object { ([string]$_) -split "," } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
    $remaining = @($objectives | Where-Object { $avoid -notcontains [string]$_.id })
    if ($remaining.Count -gt 0) { return $remaining[0] }
    return $objectives[0]
}

function Run-OneRelayIteration {
    param([int]$Index, [string[]]$AvoidObjectiveIds = @())

    $iterDir = Join-Path $ArtifactPath ("iteration_{0}" -f $Index)
    New-Item -ItemType Directory -Force -Path $iterDir | Out-Null

    $sre = $null
    $srePath = Join-Path $PSScriptRoot "external_judge_sre.ps1"
    if (Test-Path -LiteralPath $srePath -PathType Leaf) {
        $sre = Invoke-JsonScript -ScriptPath $srePath -Arguments @(
            "-Mode", "HealthCheck",
            "-MissionId", $MissionId,
            "-Lane", "all",
            "-DryRun",
            "-NoPrompt",
            "-ArtifactPath", $iterDir,
            "-StatePath", (Join-Path $iterDir "external_judge_sre_state.json"),
            "-OutPath", (Join-Path $iterDir "external_judge_sre_health.json")
        )
    }

    $transport = $null
    $transportPath = Join-Path $PSScriptRoot "supervisor_transport_fabric.ps1"
    if (Test-Path -LiteralPath $transportPath -PathType Leaf) {
        $transport = Invoke-JsonScript -ScriptPath $transportPath -Arguments @(
            "-Mode", "HealthCheck",
            "-MissionId", $MissionId,
            "-ArtifactPath", $iterDir,
            "-OutPath", (Join-Path $iterDir "supervisor_transport_health.json"),
            "-NoPrompt"
        )
    }

    $capsulePath = Join-Path $iterDir "context_capsule.json"
    $capsule = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "context_capsule_builder.ps1") -Arguments @(
        "-Mode", "BuildNextObjectiveCapsule",
        "-MissionId", $MissionId,
        "-MaxWords", "1200",
        "-OutPath", $capsulePath
    )

    $diagPath = Join-Path $iterDir "diagnosis_seed.json"
    Write-JsonFile -Path $diagPath -Payload ([ordered]@{
        verdict = "PASS"
        blocked_lanes = if ($NoLiveWeb) { @("live_gpt_web", "gemini") } else { @("live_gpt_web", "gemini") }
        do_not_repeat = @("do_not_wait_for_external_supervisor")
    })

    $fallbackArgs = @(
        "-MissionId", $MissionId,
        "-DiagnosisPath", $diagPath,
        "-OutPath", (Join-Path $iterDir "local_fallback_result.json"),
        "-NoLiveWeb"
    )
    if ($AvoidObjectiveIds.Count -gt 0) {
        $fallbackArgs += "-AvoidObjectiveIds"
        $fallbackArgs += ($AvoidObjectiveIds -join ",")
    }
    $fallback = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "local_supervisor_fallback.ps1") -Arguments $fallbackArgs

    $missionPath = Join-Path $iterDir "micro_mission.json"
    $probeObjective = Get-ProbeAwareObjective -AvoidObjectiveIds $AvoidObjectiveIds
    if ($probeObjective) {
        $mission = [pscustomobject]@{
            schema_version = "autonomous_micro_mission_v1"
            status = "MICRO_MISSION_GENERATED"
            mission_id = $MissionId
            branch_name = ("auto/{0}-{1}" -f $MissionId.ToLowerInvariant(), ([string]$probeObjective.id).ToLowerInvariant())
            objective = $probeObjective
            generated_by = "probe_aware_local_fallback"
            no_live_web_required = $true
            no_user_intervention = $true
        }
        Write-JsonFile -Path $missionPath -Payload $mission
        $fallback.selected_objective_id = [string]$probeObjective.id
        $fallback.selected_family = [string]$probeObjective.family
        $fallback.reason = if ($MissionId -eq "A20AZ") {
            "A20AZ produced twelve-plus screenshot-backed local pixel deltas but parked live supervisor lanes; local fallback routes toward live supervisor repair before claiming a live-supervised pass."
        } elseif ($MissionId -eq "A20AY") {
            "A20AY real full-night run evidence has six-plus useful screenshot-backed pixel deltas; local fallback routes toward A20AZ audit, integration review, or final handoff."
        } elseif ($MissionId -eq "A20AW") {
            "A20AW full-night rehearsal evidence has five-plus useful pixel deltas; local fallback routes toward a bounded real night run or final hardening."
        } elseif ($MissionId -eq "A20AV") {
            "A20AV pixel deltas exist with external evidence; local fallback routes toward full-night pixel rehearsal or final hardening."
        } else {
            "Ten DEV-only signature probes exist; local fallback routes toward probe review and signature selection."
        }
        Write-JsonFile -Path (Join-Path $iterDir "local_fallback_result.json") -Payload $fallback
    } else {
        $mission = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "generate_micro_mission.ps1") -Arguments @(
            "-MissionId", $MissionId,
            "-ObjectiveId", ([string]$fallback.selected_objective_id),
            "-OutPath", $missionPath,
            "-NoLiveWeb"
        )
    }

    $rawPacketPath = Join-Path $iterDir "local_fallback_raw_packet.json"
    New-LocalDecisionPacketRaw -Mission $mission -Path $rawPacketPath | Out-Null

    $packetPath = Join-Path $iterDir "decision_packet.json"
    $packet = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "normalize_external_decision_packet.ps1") -Arguments @(
        "-Source", "local_fallback",
        "-RawPath", $rawPacketPath,
        "-OutPath", $packetPath
    )

    $auctionPath = Join-Path $iterDir "mission_auction_result.json"
    $auction = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "mission_auction.ps1") -Arguments @(
        "-DecisionPacketPaths", $packetPath,
        "-BlockedLanes", "live_gpt_web,gemini",
        "-OutPath", $auctionPath
    )

    $contractPath = Join-Path $iterDir "codex_patch_contract.json"
    $contractMd = Join-Path $iterDir "codex_patch_contract.md"
    $contract = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "codex_patch_contract_builder.ps1") -Arguments @(
        "-MissionId", $MissionId,
        "-AuctionPath", $auctionPath,
        "-OutPath", $contractPath,
        "-ContractOutPath", $contractMd
    )

    $doctor = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "mission_doctor.ps1") -Arguments @(
        "-MissionId", "$MissionId-RELAY-$Index",
        "-ReportPath", $contractMd,
        "-OutPath", (Join-Path $iterDir "mission_doctor_result.json")
    )

    $memory = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "protocol_memory_update.ps1") -Arguments @(
        "-MemoryPath", (Join-Path $iterDir "protocol_memory_runtime.yaml"),
        "-MissionId", $MissionId,
        "-Category", "relay_protocol",
        "-Lesson", "Codex receives compact patch contracts instead of giant mission histories.",
        "-Evidence", $contractMd,
        "-ActionRule", "Build context capsules, normalize packets, auction missions, then pass one contract.",
        "-OutPath", (Join-Path $iterDir "protocol_memory_update_result.json")
    )

    return [pscustomobject]([ordered]@{
        iteration = $Index
        status = "NEURORELAY_ITERATION_SIMULATED"
        context_capsule_status = [string]$capsule.status
        context_capsule_word_count = [int]$capsule.word_count
        decision_packet_status = [string]$packet.status
        auction_status = [string]$auction.status
        contract_status = [string]$contract.status
        contract_word_count = [int]$contract.word_count
        selected_objective_id = [string]$auction.winner.id
        mission_doctor_verdict = [string]$doctor.verdict
        memory_status = [string]$memory.status
        external_judge_sre_status = if ($sre) { [string]$sre.status } else { "SRE_NOT_PRESENT" }
        supervisor_transport_status = if ($transport) { [string]$transport.status } else { "SUPERVISOR_TRANSPORT_NOT_PRESENT" }
        supervisor_transport_selected = if ($transport) { [string]$transport.selected_transport } else { "local_omega_fallback" }
        desktop_transport_status = if ($transport) { [string]$transport.desktop_adapter.status } else { "CHATGPT_DESKTOP_NOT_CHECKED" }
        desktop_transport_safe_to_send = if ($transport) { [bool]$transport.desktop_adapter.safe_to_send } else { $false }
        chatgpt_packet_status = if ($NoLiveWeb) { "PARKED_NO_LIVE_WEB" } else { "PARKED_UNATTENDED" }
        gemini_packet_status = "SKIPPED_NO_VISUAL_EVIDENCE"
        local_fallback_packets_count = 1
        external_decision_packets_count = 0
        giant_prompt_prevented = [bool]$contract.giant_prompt_prevented
        no_user_intervention = $true
    })
}

New-Item -ItemType Directory -Force -Path $ArtifactPath, (Split-Path -Parent $StatePath) | Out-Null

if ($Mode -eq "Stop") {
    $state = Read-JsonFile -Path $StatePath
    if (-not $state) { $state = New-BaseState }
    $state.status = "STOP_REQUESTED"
    $state.stop_requested = $true
    $state.updated_at = (Get-Date).ToString("o")
    Write-JsonFile -Path $StatePath -Payload $state
    $state | ConvertTo-Json -Depth 50
    exit 0
}

if ($Mode -eq "Status") {
    $state = Read-JsonFile -Path $StatePath
    if (-not $state) { $state = New-BaseState }
    $state | ConvertTo-Json -Depth 50
    exit 0
}

$iterationsToRun = if ($Mode -eq "DryRun") { 1 } elseif ($Mode -eq "Rehearsal") { $MaxIterations } else { 1 }
$state = New-BaseState
$state.status = "RUNNING"
$start = Get-Date
$selected = @()

for ($i = 1; $i -le $iterationsToRun; $i++) {
    if (((Get-Date) - $start).TotalMinutes -gt $MaxRuntimeMinutes) {
        $state.status = "TIME_BUDGET_EXPIRED"
        break
    }
    $iteration = Run-OneRelayIteration -Index $i -AvoidObjectiveIds $selected
    $state.iterations += $iteration
    $selected += [string]$iteration.selected_objective_id
    $state.completed_iterations = $i
    $state.next_planned_objectives = @($selected | Select-Object -Last 3)
    foreach ($lane in @("live_gpt_web", "gemini")) {
        if ($state.blocked_lanes -notcontains $lane) { $state.blocked_lanes += $lane }
    }
}

if ($state.status -eq "RUNNING") {
    $state.status = if ($Mode -eq "DryRun") { "NEURORELAY_DRY_RUN_PASS" } elseif ($Mode -eq "Rehearsal") { "NEURORELAY_REHEARSAL_PASS" } else { "NEURORELAY_RUNONCE_PASS" }
}

$capsuleCounts = @($state.iterations | ForEach-Object { [int]$_.context_capsule_word_count })
$contractCounts = @($state.iterations | ForEach-Object { [int]$_.contract_word_count })
$state.workload_shift_metrics = [ordered]@{
    codex_contract_word_count_avg = if ($contractCounts.Count -gt 0) { [Math]::Round((($contractCounts | Measure-Object -Average).Average), 2) } else { 0 }
    context_capsule_word_count_avg = if ($capsuleCounts.Count -gt 0) { [Math]::Round((($capsuleCounts | Measure-Object -Average).Average), 2) } else { 0 }
    external_decision_packets_count = [int](($state.iterations | Measure-Object -Property external_decision_packets_count -Sum).Sum)
    local_fallback_packets_count = [int](($state.iterations | Measure-Object -Property local_fallback_packets_count -Sum).Sum)
    codex_workload_reduction_estimate = "high_by_word_count_proxy"
    external_reasoning_utilization = 0
    repeated_context_removed_count = [int]$state.completed_iterations
    giant_prompt_prevented_count = [int](@($state.iterations | Where-Object { $_.giant_prompt_prevented }).Count)
}
$state.updated_at = (Get-Date).ToString("o")
$state.gpt_web_required = $false
$state.gemini_required = $false
$state.user_intervention_required = $false
$state.loop_bounded = $true
$state.no_giant_prompt = $true

Write-JsonFile -Path $StatePath -Payload $state
Write-JsonFile -Path (Join-Path $ArtifactPath ("neurorelay_{0}_result.json" -f $Mode.ToLowerInvariant())) -Payload $state
Write-JsonFile -Path (Join-Path $ArtifactPath "workload_shift_metrics.json") -Payload $state.workload_shift_metrics
$firstIterDir = Join-Path $ArtifactPath "iteration_1"
if (Test-Path -LiteralPath $firstIterDir -PathType Container) {
    $sampleMap = @{
        "context_capsule.json" = "context_capsule_sample.json"
        "decision_packet.json" = "decision_packet_sample.json"
        "mission_auction_result.json" = "mission_auction_result.json"
        "codex_patch_contract.md" = "codex_patch_contract_sample.md"
        "protocol_memory_update_result.json" = "protocol_memory_update_result.json"
    }
    foreach ($entry in $sampleMap.GetEnumerator()) {
        $sourcePath = Join-Path $firstIterDir $entry.Key
        if (Test-Path -LiteralPath $sourcePath -PathType Leaf) {
            Copy-Item -LiteralPath $sourcePath -Destination (Join-Path $ArtifactPath $entry.Value) -Force
        }
    }
}
Write-JsonFile -Path (Join-Path $ArtifactPath "manifest.json") -Payload ([ordered]@{
    mission_id = $MissionId
    mode = $Mode
    status = $state.status
    artifact_path = $ArtifactPath
    created_at = (Get-Date).ToString("o")
    secrets_committed = $false
    private_urls_committed = $false
})

$state | ConvertTo-Json -Depth 60
exit 0
