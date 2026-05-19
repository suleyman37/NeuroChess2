param(
    [ValidateSet("Status", "DryRun", "Rehearsal", "RunOnce", "NightCheck", "Stop")]
    [string]$Mode = "Status",
    [string]$MissionId = "A20AU",
    [int]$MaxIterations = 3,
    [int]$MaxRuntimeMinutes = 180,
    [switch]$NoLiveWeb = $true,
    [string]$ArtifactPath = "",
    [string]$StatePath = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
    if ($MissionId -eq "A20AV") {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\limited_pixel_rehearsal\A20AV_limited_autonomous_pixel_rehearsal_20260518"
    } elseif ($MissionId -eq "A20AW") {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\full_night_pixel_rehearsal\A20AW_full_night_pixel_rehearsal_20260518"
    } elseif ($MissionId -eq "A20AY") {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\full_night_real_run\A20AY_full_night_real_pixel_run_20260518"
    } else {
        $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\omega\A20AU_omega_autonomy_kernel_20260518"
    }
}
if ([string]::IsNullOrWhiteSpace($StatePath)) {
    $StatePath = Join-Path $PSScriptRoot "runtime\omega_autopilot_state.json"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 60 | Set-Content -LiteralPath $Path -Encoding UTF8
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

function New-State {
    [ordered]@{
        schema_version = "omega_autopilot_state_v1"
        mission_id = $MissionId
        status = "INITIALIZED"
        created_at = (Get-Date).ToString("o")
        updated_at = (Get-Date).ToString("o")
        completed_iterations = 0
        max_iterations = $MaxIterations
        max_runtime_minutes = $MaxRuntimeMinutes
        no_live_web = [bool]$NoLiveWeb
        no_user_intervention = $true
        loop_bounded = $true
        stop_requested = $false
        selected_objectives = @()
        blocked_lanes = @()
        next_objective = $null
        night_readiness = $null
    }
}

function Run-OneOmegaIteration {
    param([int]$Index, [string[]]$Avoid = @())
    $iterDir = Join-Path $ArtifactPath ("iteration_{0}" -f $Index)
    New-Item -ItemType Directory -Force -Path $iterDir | Out-Null
    $bottleneckPath = Join-Path $iterDir "bottleneck_detection_result.json"
    $utilityPath = Join-Path $iterDir "utility_ranking_result.json"
    $contractPath = Join-Path $iterDir "proof_contract.json"
    $contractMd = Join-Path $iterDir "selected_contract.md"
    $antiPath = Join-Path $iterDir "anti_stagnation_result.json"

    $bottleneck = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "bottleneck_detector.ps1") -Arguments @("-OutPath", $bottleneckPath)
    $utilityArgs = @("-MissionId", $MissionId, "-BottleneckPath", $bottleneckPath, "-OutPath", $utilityPath)
    if ($Avoid.Count -gt 0) {
        $utilityArgs += "-AvoidObjectiveIds"
        $utilityArgs += ($Avoid -join ",")
    }
    $utility = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "mission_utility_engine.ps1") -Arguments $utilityArgs
    $contract = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "build_proof_carrying_contract.ps1") -Arguments @("-MissionId", $MissionId, "-UtilityPath", $utilityPath, "-OutPath", $contractPath, "-ContractOutPath", $contractMd)
    $anti = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "anti_stagnation_sentinel.ps1") -Arguments @("-OutPath", $antiPath)
    Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "protocol_memory_update.ps1") -Arguments @(
        "-MemoryPath", (Join-Path $ArtifactPath "protocol_memory_rehearsal.yaml"),
        "-MissionId", $MissionId,
        "-Category", "omega_kernel",
        "-Lesson", "Pixel mandate activates when visual production remains below target after meta work.",
        "-Evidence", $contractMd,
        "-ActionRule", "Prefer proof-carrying pixel objectives before more control-plane expansion.",
        "-OutPath", (Join-Path $iterDir "protocol_memory_update_result.json")
    ) | Out-Null

    [ordered]@{
        iteration = $Index
        status = "OMEGA_ITERATION_SIMULATED"
        bottleneck = $bottleneck.primary_bottleneck
        pixel_mandate_active = [bool]$bottleneck.pixel_mandate_active
        selected_objective = [string]$utility.winner.id
        selected_utility = [double]$utility.winner.total_utility
        contract_word_count = [int]$contract.contract_word_count
        contract_path = $contractMd
        anti_stagnation_actions = @($anti.actions)
        no_live_web_required = $true
        no_user_intervention = $true
        proof_defined = @($contract.expected_proof).Count -gt 0
    }
}

function Test-FullNightKillSwitch {
    $flag = Join-Path $PSScriptRoot "runtime\STOP_FULL_NIGHT.flag"
    return (Test-Path -LiteralPath $flag -PathType Leaf)
}

New-Item -ItemType Directory -Force -Path $ArtifactPath, (Split-Path -Parent $StatePath) | Out-Null

if ($Mode -eq "Stop") {
    $state = if (Test-Path -LiteralPath $StatePath -PathType Leaf) { Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json } else { New-State }
    $state.status = "STOP_REQUESTED"
    $state.stop_requested = $true
    $state.updated_at = (Get-Date).ToString("o")
    Write-JsonFile -Path $StatePath -Payload $state
    $state | ConvertTo-Json -Depth 60
    exit 0
}

if ($Mode -eq "Status") {
    $bottleneck = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "bottleneck_detector.ps1") -Arguments @("-OutPath", (Join-Path $ArtifactPath "bottleneck_detection_result.json"))
    $state = if (Test-Path -LiteralPath $StatePath -PathType Leaf) { Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json } else { New-State }
    $state.status = "OMEGA_STATUS_READY"
    $state.next_objective = $bottleneck.recommended_objective
    $state.blocked_lanes = @($bottleneck.blocked_lanes)
    $state.updated_at = (Get-Date).ToString("o")
    Write-JsonFile -Path $StatePath -Payload $state
    $state | ConvertTo-Json -Depth 60
    exit 0
}

if ($Mode -eq "NightCheck") {
    $night = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "night_readiness_v2.ps1") -Arguments @("-MissionId", $MissionId, "-ArtifactPath", $ArtifactPath, "-OutPath", (Join-Path $ArtifactPath "night_readiness_v2_result.json"), "-MaxIterations", "$MaxIterations", "-MaxRuntimeMinutes", "$MaxRuntimeMinutes") -AcceptExitCodes @(0,3)
    $night | ConvertTo-Json -Depth 60
    exit 0
}

$iterations = if ($Mode -eq "DryRun") { 1 } elseif ($Mode -eq "Rehearsal") { $MaxIterations } else { 1 }
$state = New-State
$state.status = "RUNNING"
$start = Get-Date
$avoid = @()
$iterationResults = @()

for ($i = 1; $i -le $iterations; $i++) {
    if (Test-FullNightKillSwitch) {
        $state.status = "STOPPED_BY_KILL_SWITCH"
        $state.stop_requested = $true
        break
    }
    if (((Get-Date) - $start).TotalMinutes -gt $MaxRuntimeMinutes) {
        $state.status = "TIME_BUDGET_EXPIRED"
        break
    }
    $result = Run-OneOmegaIteration -Index $i -Avoid $avoid
    $iterationResults += [pscustomobject]$result
    $avoid += [string]$result.selected_objective
    $state.completed_iterations = $i
    $state.selected_objectives = @($avoid)
}

if ($state.status -eq "RUNNING") {
    $state.status = if ($Mode -eq "DryRun") { "OMEGA_DRY_RUN_PASS" } elseif ($Mode -eq "Rehearsal") { "OMEGA_REHEARSAL_PASS" } else { "OMEGA_RUNONCE_PASS" }
}
$state.iterations = $iterationResults
$state.next_objective = @($state.selected_objectives)[0]
$state.blocked_lanes = @("live_gpt_web_optional", "gemini_optional")
$state.updated_at = (Get-Date).ToString("o")
$state.pixel_objective_included = @($iterationResults | Where-Object { $_.pixel_mandate_active -eq $true }).Count -gt 0
$state.contract_word_count_avg = if ($iterationResults.Count -gt 0) { [Math]::Round((($iterationResults | Measure-Object -Property contract_word_count -Average).Average), 2) } else { 0 }

Write-JsonFile -Path $StatePath -Payload $state
Write-JsonFile -Path (Join-Path $ArtifactPath ("omega_{0}_result.json" -f $Mode.ToLowerInvariant())) -Payload $state
if ($Mode -eq "Rehearsal") { Write-JsonFile -Path (Join-Path $ArtifactPath "rehearsal_result.json") -Payload $state }

$first = Join-Path $ArtifactPath "iteration_1"
foreach ($copy in @(
    @{ from = "bottleneck_detection_result.json"; to = "bottleneck_detection_result.json" },
    @{ from = "utility_ranking_result.json"; to = "utility_ranking_result.json" },
    @{ from = "selected_contract.md"; to = "selected_contract.md" },
    @{ from = "anti_stagnation_result.json"; to = "anti_stagnation_result.json" }
)) {
    $from = Join-Path $first $copy.from
    if (Test-Path -LiteralPath $from -PathType Leaf) { Copy-Item -LiteralPath $from -Destination (Join-Path $ArtifactPath $copy.to) -Force }
}

Write-JsonFile -Path (Join-Path $ArtifactPath "manifest.json") -Payload ([ordered]@{
    mission_id = $MissionId
    status = $state.status
    artifact_path = $ArtifactPath
    selected_objectives = @($state.selected_objectives)
    no_live_web = [bool]$NoLiveWeb
    no_user_intervention = $true
    loop_bounded = $true
    screenshots_committed = $false
    qa_artifacts_committed = $false
})

$state | ConvertTo-Json -Depth 60
exit 0
