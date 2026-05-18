param(
    [ValidateSet("DryRun", "Rehearsal", "RunOnce", "Status", "Stop")]
    [string]$Mode = "Status",
    [string]$MissionId = "A20AN",
    [int]$MaxIterations = 6,
    [int]$MaxRuntimeMinutes = 180,
    [switch]$NoLiveWeb,
    [string]$ArtifactPath = "",
    [string]$StatePath = "",
    [string]$ScoreStatePath = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
    $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\autonomous_improvement_conductor\A20AN_autonomous_improvement_conductor_20260518"
}
if ([string]::IsNullOrWhiteSpace($StatePath)) {
    $StatePath = Join-Path $PSScriptRoot "runtime\autonomous_improvement_loop_state.json"
}
if ([string]::IsNullOrWhiteSpace($ScoreStatePath)) {
    $ScoreStatePath = Join-Path $PSScriptRoot "autonomy_score_state.json"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $Path -Encoding UTF8
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
        schema_version = "autonomous_improvement_loop_state_v1"
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
        no_user_intervention = $true
        live_gpt_web_optional = $true
        road_to_v2_pushed = $false
        a21_launched = $false
        night_mode_launched = $false
        bypass_attempted = $false
    }
}

function Run-OneIteration {
    param([int]$Index, [string]$ObjectiveId = "", [string[]]$AvoidObjectiveIds = @())
    $iterDir = Join-Path $ArtifactPath ("iteration_{0}" -f $Index)
    New-Item -ItemType Directory -Force -Path $iterDir | Out-Null
    $fallbackPath = Join-Path $iterDir "fallback_result.json"
    $diagnosisSeed = [ordered]@{
        mission_id = $MissionId
        verdict = "PASS"
        blocked_lanes = if ($NoLiveWeb) { @("live_gpt_web") } else { @() }
        do_not_repeat = @()
    }
    $diagnosisSeedPath = Join-Path $iterDir "diagnosis_seed.json"
    Write-JsonFile -Path $diagnosisSeedPath -Payload $diagnosisSeed
    $fallbackArgs = @(
        "-MissionId", $MissionId,
        "-ReservoirPath", (Join-Path $PSScriptRoot "objective_reservoir.yaml"),
        "-DiagnosisPath", $diagnosisSeedPath,
        "-OutPath", $fallbackPath,
        "-NoLiveWeb"
    )
    if ($AvoidObjectiveIds.Count -gt 0) {
        $fallbackArgs += "-AvoidObjectiveIds"
        $fallbackArgs += ($AvoidObjectiveIds -join ",")
    }
    $fallback = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "local_supervisor_fallback.ps1") -Arguments $fallbackArgs
    $selected = if ([string]::IsNullOrWhiteSpace($ObjectiveId)) { [string]$fallback.selected_objective_id } else { $ObjectiveId }
    $missionPath = Join-Path $iterDir "micro_mission.json"
    $mission = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "generate_micro_mission.ps1") -Arguments @(
        "-MissionId", $MissionId,
        "-ObjectiveId", $selected,
        "-OutPath", $missionPath,
        "-PromptOutPath", (Join-Path $iterDir "micro_mission.md"),
        "-NoLiveWeb"
    )
    $doctorPath = Join-Path $iterDir "mission_doctor_result.json"
    $doctor = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "mission_doctor.ps1") -Arguments @(
        "-MissionId", "$MissionId-ITER-$Index",
        "-ReportPath", $missionPath,
        "-OutPath", $doctorPath,
        "-WebBlocked"
    )
    $bridgePath = Join-Path $iterDir "supervisor_bridge_result.json"
    $bridge = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "supervisor_bridge.ps1") -Arguments @(
        "-MissionId", $MissionId,
        "-DiagnosisPath", $doctorPath,
        "-ScoreStatePath", $ScoreStatePath,
        "-OutPath", $bridgePath,
        "-NoLiveWeb"
    ) -AcceptExitCodes @(0, 3)
    return [pscustomobject]([ordered]@{
        iteration = $Index
        status = "ITERATION_SIMULATED"
        selected_objective_id = $selected
        selected_family = [string]$mission.objective.family
        micro_mission_status = [string]$mission.status
        doctor_verdict = [string]$doctor.verdict
        supervisor_status = [string]$bridge.status
        fallback_used = [bool]$bridge.fallback_required
        live_lane_parked = $true
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
    $state | ConvertTo-Json -Depth 40
    exit 0
}

if ($Mode -eq "Status") {
    $state = Read-JsonFile -Path $StatePath
    if (-not $state) { $state = New-BaseState }
    $state.status = if ($state.status) { [string]$state.status } else { "READY" }
    $state | ConvertTo-Json -Depth 40
    exit 0
}

$start = Get-Date
$iterationsToRun = if ($Mode -eq "DryRun") { 5 } elseif ($Mode -eq "Rehearsal") { [Math]::Min($MaxIterations, 3) } else { 1 }
if ($Mode -eq "Rehearsal") { $iterationsToRun = $MaxIterations }
$state = New-BaseState
$state.status = "RUNNING"
$state.iterations = @()
$selectedObjectiveIds = @()

for ($i = 1; $i -le $iterationsToRun; $i++) {
    if (((Get-Date) - $start).TotalMinutes -gt $MaxRuntimeMinutes) {
        $state.status = "TIME_BUDGET_EXPIRED"
        break
    }
    $iteration = Run-OneIteration -Index $i -AvoidObjectiveIds $selectedObjectiveIds
    $state.iterations += $iteration
    $selectedObjectiveIds += [string]$iteration.selected_objective_id
    $state.completed_iterations = $i
    if ($state.blocked_lanes -notcontains "live_gpt_web") {
        $state.blocked_lanes += "live_gpt_web"
    }
    $state.next_planned_objectives = @($selectedObjectiveIds | Select-Object -Last 3)
}

if ($state.status -eq "RUNNING") {
    $state.status = if ($Mode -eq "DryRun") { "AUTONOMOUS_LOOP_DRY_RUN_PASS" } elseif ($Mode -eq "Rehearsal") { "AUTONOMOUS_LOOP_REHEARSAL_PASS" } else { "AUTONOMOUS_LOOP_RUNONCE_PASS" }
}
$state.updated_at = (Get-Date).ToString("o")
$state.loop_bounded = $true
$state.live_gpt_web_optional = $true
$state.no_user_intervention = $true
$state.blocked_lanes_park_and_continue = $true
Write-JsonFile -Path $StatePath -Payload $state
Write-JsonFile -Path (Join-Path $ArtifactPath ("{0}_result.json" -f $Mode.ToLowerInvariant())) -Payload $state
$state | ConvertTo-Json -Depth 50
exit 0
