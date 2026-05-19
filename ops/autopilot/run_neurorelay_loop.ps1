param(
    [ValidateSet("DryRun", "Rehearsal", "RunOnce", "Status", "Stop")]
    [string]$Mode = "Status",
    [string]$MissionId = "A20AO",
    [int]$MaxIterations = 3,
    [int]$MaxRuntimeMinutes = 180,
    [switch]$NoLiveWeb,
    [string]$ArtifactPath = "",
    [string]$StatePath = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
    if ($MissionId -eq "A20AP") {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_probes\A20AP_critical_deficit_uplift_10_probes_20260518"
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

function Get-ProbeAwareObjective {
    param([string[]]$AvoidObjectiveIds = @())
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
        $fallback.reason = "Ten DEV-only signature probes exist; local fallback routes toward probe review and signature selection."
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
