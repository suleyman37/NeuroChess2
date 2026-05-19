param(
    [ValidateSet("Status", "HealthCheck", "ProbeChatGPT", "ProbeGemini", "ParkLane", "RetryParked", "DryRun", "AlertFailure")]
    [string]$Mode = "Status",
    [string]$MissionId = "A20AP",
    [ValidateSet("chatgpt", "gemini", "all")]
    [string]$Lane = "all",
    [switch]$NoPrompt,
    [switch]$DryRun,
    [int]$MaxWaitSeconds = 60,
    [string]$Reason = "",
    [string]$OutPath = "",
    [string]$StatePath = "",
    [string]$ArtifactPath = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($StatePath)) {
    $StatePath = Join-Path $PSScriptRoot "runtime\external_judge_sre_state.json"
}
if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
    $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_probes\A20AP_critical_deficit_uplift_10_probes_20260518"
}
if ([string]::IsNullOrWhiteSpace($OutPath) -and $Mode -eq "DryRun") {
    $OutPath = Join-Path $ArtifactPath "external_judge_sre_report.json"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $Payload | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Read-JsonFile {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    }
    return $null
}

function Emit {
    param([object]$Payload)
    Write-JsonFile -Path $OutPath -Payload $Payload
    $Payload | ConvertTo-Json -Depth 50
    exit 0
}

function New-DefaultState {
    [ordered]@{
        schema_version = "external_judge_sre_state_v1"
        mission_id = $MissionId
        updated_at = (Get-Date).ToString("o")
        lanes = [ordered]@{
            chatgpt = [ordered]@{
                lane = "chatgpt"
                state = "READY"
                reason = ""
                retry_after = ""
                consecutive_same_reason_failures = 0
                last_alert_at = ""
            }
            gemini = [ordered]@{
                lane = "gemini"
                state = "READY"
                reason = ""
                retry_after = ""
                consecutive_same_reason_failures = 0
                last_alert_at = ""
            }
        }
        alert_cooldowns = @()
        runtime_alerts = @()
        no_user_prompt = $true
        fallback_continues = $true
        secrets_redacted = $true
        private_urls_redacted = $true
        bypass_attempted = $false
    }
}

function Get-State {
    $state = Read-JsonFile -Path $StatePath
    if (-not $state) { return New-DefaultState }
    return $state
}

function Set-State {
    param([object]$State)
    $State.updated_at = (Get-Date).ToString("o")
    Write-JsonFile -Path $StatePath -Payload $State
}

function Get-Lanes {
    if ($Lane -eq "all") { return @("chatgpt", "gemini") }
    return @($Lane)
}

function Get-ProblemState {
    param([string]$Problem)
    switch ($Problem) {
        "CHATGPT_CDP_UNREACHABLE" { "PARKED_CDP_UNAVAILABLE" }
        "CHATGPT_AUTH_OR_CONSENT_WALL" { "PARKED_AUTH_REQUIRED" }
        "CHATGPT_PAGE_USABLE" { "AVAILABLE" }
        "CHATGPT_UNCLASSIFIED_PAGE_STATE" { "PARKED_UNCLASSIFIED_PAGE_STATE" }
        "CHATGPT_CONVERSATION_EXHAUSTED" { "PARKED_SESSION_CLOSED" }
        "GEMINI_NOT_CONFIGURED" { "SKIPPED_NOT_CONFIGURED" }
        "GEMINI_PAGE_USABLE" { "AVAILABLE" }
        "GEMINI_WEB_LANE_READY" { "AVAILABLE" }
        "GEMINI_WEB_LANE_READY_MODEL_NOT_EXACT" { "AVAILABLE_MODEL_NOT_EXACT" }
        "GEMINI_AUTH_OR_CONSENT_WALL" { "PARKED_AUTH_REQUIRED" }
        "GEMINI_PAGE_NOT_USABLE" { "PARKED_UNCLASSIFIED_PAGE_STATE" }
        "GEMINI_MODEL_NOT_AVAILABLE_OR_NOT_IN_PLAN" { "PARKED_MODEL_NOT_EXACT" }
        "GEMINI_UPLOAD_UNAVAILABLE" { "PARKED_UPLOAD_UNAVAILABLE" }
        "GEMINI_NO_VISUAL_EVIDENCE" { "SKIPPED_NOT_CONFIGURED" }
        "GEMINI_INVALID_RESPONSE" { "FAILED_INVALID_RESPONSE" }
        "EXTERNAL_RESPONSE_TIMEOUT" { "PARKED_RATE_LIMITED" }
        default { "PARKED_UNCLASSIFIED_PAGE_STATE" }
    }
}

function Get-DefaultProblem {
    param([string]$LaneName)
    if ($LaneName -eq "chatgpt") { return "CHATGPT_CDP_UNREACHABLE" }
    return "GEMINI_NOT_CONFIGURED"
}

function Get-RetryAfter {
    param([string]$Problem, [int]$Failures)
    $minutes = switch ($Problem) {
        "CHATGPT_AUTH_OR_CONSENT_WALL" { 60 }
        "CHATGPT_CONVERSATION_EXHAUSTED" { 60 }
        "GEMINI_NOT_CONFIGURED" { 240 }
        "GEMINI_AUTH_OR_CONSENT_WALL" { 60 }
        "GEMINI_PAGE_NOT_USABLE" { 30 }
        "GEMINI_MODEL_NOT_AVAILABLE_OR_NOT_IN_PLAN" { 60 }
        "GEMINI_UPLOAD_UNAVAILABLE" { 60 }
        "GEMINI_NO_VISUAL_EVIDENCE" { 0 }
        default { 30 }
    }
    if ($Failures -ge 2 -and $minutes -gt 0) { $minutes = $minutes * 2 }
    return (Get-Date).AddMinutes($minutes).ToString("o")
}

function Should-Alert {
    param([string]$Problem)
    return $Problem -notin @("CHATGPT_PAGE_USABLE", "GEMINI_PAGE_USABLE", "GEMINI_WEB_LANE_READY", "GEMINI_WEB_LANE_READY_MODEL_NOT_EXACT", "GEMINI_NOT_CONFIGURED", "GEMINI_NO_VISUAL_EVIDENCE")
}

function Test-AlertCooldown {
    param([object]$State, [string]$LaneName, [string]$Problem)
    $now = Get-Date
    $key = "$LaneName`:$Problem"
    foreach ($entry in @($State.alert_cooldowns)) {
        if ([string]$entry.key -eq $key) {
            $last = [datetime]$entry.last_alert_at
            if (($now - $last).TotalMinutes -lt 30) {
                return $true
            }
        }
    }
    return $false
}

function Record-AlertCooldown {
    param([object]$State, [string]$LaneName, [string]$Problem)
    $key = "$LaneName`:$Problem"
    $remaining = @($State.alert_cooldowns | Where-Object { [string]$_.key -ne $key })
    $remaining += [pscustomobject]@{
        key = $key
        lane = $LaneName
        reason = $Problem
        last_alert_at = (Get-Date).ToString("o")
    }
    $State.alert_cooldowns = @($remaining)
}

function Write-LocalRuntimeAlert {
    param([object]$State, [string]$LaneName, [string]$Problem, [string]$Status)
    $alert = [ordered]@{
        schema_version = "external_judge_runtime_alert_v1"
        mission_id = $MissionId
        service = $LaneName
        reason = $Problem
        status = $Status
        codex_continues_offline = $true
        created_at = (Get-Date).ToString("o")
        secrets_redacted = $true
        private_urls_redacted = $true
    }
    $runtimePath = Join-Path $PSScriptRoot "runtime\external_judge_sre_alert_event.json"
    Write-JsonFile -Path $runtimePath -Payload $alert
    $State.runtime_alerts = @($State.runtime_alerts) + @($alert)
    return $alert
}

function Send-LaneAlert {
    param([object]$State, [string]$LaneName, [string]$Problem, [string]$LaneState)
    if (-not (Should-Alert -Problem $Problem)) {
        return [ordered]@{ status = "ALERT_NOT_REQUIRED"; reason = $Problem }
    }
    if (Test-AlertCooldown -State $State -LaneName $LaneName -Problem $Problem) {
        return [ordered]@{ status = "ALERT_SUPPRESSED_COOLDOWN"; reason = $Problem; cooldown_minutes = 30 }
    }
    $titleService = if ($LaneName -eq "chatgpt") { "ChatGPT" } else { "Gemini" }
    $title = "NeuroChess: $titleService lane parked"
    $message = @"
$titleService is unavailable or requires manual action.

Service: $titleService
Reason: $Problem
Mission id: $MissionId
Status: $LaneState
Codex continues offline: yes

No action is required unless you want to unblock the live lane.
"@
    if ($DryRun) {
        Record-AlertCooldown -State $State -LaneName $LaneName -Problem $Problem
        return [ordered]@{
            status = "ALERT_DRY_RUN"
            service = $titleService
            reason = $Problem
            network_called = $false
            message_preview = $message
        }
    }
    $resultPath = Join-Path $ArtifactPath ("external_judge_{0}_alert_result.json" -f $LaneName)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "send_autopilot_alert.ps1") `
        -Channel auto `
        -Title $title `
        -Message $message `
        -MissionId $MissionId `
        -ServiceName $titleService `
        -Reason $Problem `
        -ArtifactPath $ArtifactPath `
        -ResultPath $resultPath `
        -NoPrompt `
        -TimeoutSeconds 10 2>&1
    $exit = $LASTEXITCODE
    $alertResult = $null
    if (Test-Path -LiteralPath $resultPath -PathType Leaf) {
        $alertResult = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
    }
    if ($exit -eq 0 -and $alertResult -and [string]$alertResult.status -in @("ALERT_SENT_NTFY", "ALERT_SENT_GMAIL_FALLBACK", "ALERT_DRY_RUN")) {
        Record-AlertCooldown -State $State -LaneName $LaneName -Problem $Problem
        return [ordered]@{ status = [string]$alertResult.status; result_path = $resultPath }
    }
    $local = Write-LocalRuntimeAlert -State $State -LaneName $LaneName -Problem $Problem -Status "NTFY_ALERT_FAILED"
    return [ordered]@{
        status = "LOCAL_RUNTIME_ALERT_WRITTEN"
        alert_router_exit = $exit
        error_redacted = (($output | Out-String) -replace "https://chatgpt\.com/[^\s]+", "[redacted-private-url]")
        runtime_alert = $local
    }
}

function Park-Lane {
    param([object]$State, [string]$LaneName, [string]$Problem)
    $laneState = Get-ProblemState -Problem $Problem
    $laneStateObject = $State.lanes.$LaneName
    $previousReason = [string]$laneStateObject.reason
    $failures = if ($previousReason -eq $Problem) { [int]$laneStateObject.consecutive_same_reason_failures + 1 } else { 1 }
    $laneStateObject.state = $laneState
    $laneStateObject.reason = $Problem
    $laneStateObject.retry_after = Get-RetryAfter -Problem $Problem -Failures $failures
    $laneStateObject.consecutive_same_reason_failures = $failures
    $alert = Send-LaneAlert -State $State -LaneName $LaneName -Problem $Problem -LaneState $laneState
    if ([string]$alert.status -in @("ALERT_DRY_RUN", "ALERT_SENT_NTFY", "ALERT_SENT_GMAIL_FALLBACK", "LOCAL_RUNTIME_ALERT_WRITTEN")) {
        $laneStateObject.last_alert_at = (Get-Date).ToString("o")
    }
    return [ordered]@{
        lane = $LaneName
        state = $laneState
        reason = $Problem
        retry_after = [string]$laneStateObject.retry_after
        alert = $alert
        codex_continues_offline = $true
        external_failure_blocks_loop = $false
    }
}

function Set-LaneAvailable {
    param([object]$State, [string]$LaneName, [string]$Reason, [object]$Probe)
    $laneStateObject = $State.lanes.$LaneName
    $laneStateObject.state = Get-ProblemState -Problem $Reason
    $laneStateObject.reason = $Reason
    $laneStateObject.retry_after = ""
    $laneStateObject.consecutive_same_reason_failures = 0
    return [ordered]@{
        lane = $LaneName
        state = [string]$laneStateObject.state
        reason = $Reason
        probe_status = if ($Probe) { [string]$Probe.status } else { "" }
        selected_model = if ($Probe) { [string]$Probe.selected_model } else { "" }
        selected_reasoning_mode = if ($Probe) { [string]$Probe.selected_reasoning_mode } else { "" }
        codex_continues_offline = $true
        external_failure_blocks_loop = $false
    }
}

function Invoke-GeminiLaneAdapterHealth {
    param([object]$State)
    $adapter = Join-Path $PSScriptRoot "gemini_web_lane_adapter.ps1"
    if (-not (Test-Path -LiteralPath $adapter -PathType Leaf)) {
        return Park-Lane -State $State -LaneName "gemini" -Problem "GEMINI_NOT_CONFIGURED"
    }
    $adapterOut = Join-Path $ArtifactPath "gemini_lane_health_from_sre.json"
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $adapter `
        -Mode HealthCheck `
        -MissionId $MissionId `
        -ArtifactPath $ArtifactPath `
        -OutPath $adapterOut `
        -NoPrompt 2>&1
    $probe = $null
    if (Test-Path -LiteralPath $adapterOut -PathType Leaf) {
        $probe = Get-Content -LiteralPath $adapterOut -Raw | ConvertFrom-Json
    } else {
        $text = ($output | Out-String).Trim()
        $start = $text.IndexOf("{")
        if ($start -ge 0) { $probe = $text.Substring($start) | ConvertFrom-Json }
    }
    $status = [string]$probe.status
    switch ($status) {
        "GEMINI_3_5_FLASH_EXTENDED_WEB_LANE_READY" { return Set-LaneAvailable -State $State -LaneName "gemini" -Reason "GEMINI_WEB_LANE_READY" -Probe $probe }
        "GEMINI_WEB_LANE_READY_MODEL_NOT_EXACT" { return Set-LaneAvailable -State $State -LaneName "gemini" -Reason "GEMINI_WEB_LANE_READY_MODEL_NOT_EXACT" -Probe $probe }
        "GEMINI_WEB_LANE_AUTH_REQUIRED_PARKED" { return Park-Lane -State $State -LaneName "gemini" -Problem "GEMINI_AUTH_OR_CONSENT_WALL" }
        "GEMINI_WEB_LANE_PAGE_NOT_USABLE" { return Park-Lane -State $State -LaneName "gemini" -Problem "GEMINI_PAGE_NOT_USABLE" }
        "GEMINI_NOT_CONFIGURED" { return Park-Lane -State $State -LaneName "gemini" -Problem "GEMINI_NOT_CONFIGURED" }
        default { return Park-Lane -State $State -LaneName "gemini" -Problem "GEMINI_PAGE_NOT_USABLE" }
    }
}

function Probe-Lane {
    param([object]$State, [string]$LaneName)
    if ($LaneName -eq "gemini" -and -not $DryRun -and [string]::IsNullOrWhiteSpace($Reason)) {
        return Invoke-GeminiLaneAdapterHealth -State $State
    }
    $problem = if (-not [string]::IsNullOrWhiteSpace($Reason)) { $Reason } else { Get-DefaultProblem -LaneName $LaneName }
    return Park-Lane -State $State -LaneName $LaneName -Problem $problem
}

function Retry-Lane {
    param([object]$State, [string]$LaneName)
    $laneStateObject = $State.lanes.$LaneName
    if (-not [string]::IsNullOrWhiteSpace([string]$laneStateObject.retry_after)) {
        $retryAfter = [datetime]$laneStateObject.retry_after
        if ((Get-Date) -lt $retryAfter) {
            return [ordered]@{
                lane = $LaneName
                state = [string]$laneStateObject.state
                reason = [string]$laneStateObject.reason
                status = "PARKED_RETRY_DEFERRED"
                retry_after = [string]$laneStateObject.retry_after
                codex_continues_offline = $true
            }
        }
    }
    return Probe-Lane -State $State -LaneName $LaneName
}

$state = Get-State
$state.mission_id = $MissionId
$state.no_user_prompt = $true
$state.fallback_continues = $true
$state.secrets_redacted = $true
$state.private_urls_redacted = $true
$state.bypass_attempted = $false

if ($Mode -eq "Status") {
    Set-State -State $state
    Emit ([ordered]@{
        schema_version = "external_judge_sre_result_v1"
        status = "EXTERNAL_JUDGE_SRE_STATUS"
        mission_id = $MissionId
        lanes = $state.lanes
        fallback_continues = $true
        no_user_prompt = $true
        max_wait_seconds = $MaxWaitSeconds
        secrets_redacted = $true
        private_urls_redacted = $true
    })
}

$results = @()
switch ($Mode) {
    "ProbeChatGPT" {
        $results += Probe-Lane -State $state -LaneName "chatgpt"
    }
    "ProbeGemini" {
        $results += Probe-Lane -State $state -LaneName "gemini"
    }
    "HealthCheck" {
        foreach ($laneName in Get-Lanes) { $results += Probe-Lane -State $state -LaneName $laneName }
    }
    "ParkLane" {
        foreach ($laneName in Get-Lanes) {
            $problem = if (-not [string]::IsNullOrWhiteSpace($Reason)) { $Reason } else { Get-DefaultProblem -LaneName $laneName }
            $results += Park-Lane -State $state -LaneName $laneName -Problem $problem
        }
    }
    "RetryParked" {
        foreach ($laneName in Get-Lanes) { $results += Retry-Lane -State $state -LaneName $laneName }
    }
    "AlertFailure" {
        foreach ($laneName in Get-Lanes) {
            $problem = if (-not [string]::IsNullOrWhiteSpace($Reason)) { $Reason } else { Get-DefaultProblem -LaneName $laneName }
            $laneState = Get-ProblemState -Problem $problem
            $results += [ordered]@{
                lane = $laneName
                state = $laneState
                reason = $problem
                alert = Send-LaneAlert -State $state -LaneName $laneName -Problem $problem -LaneState $laneState
                codex_continues_offline = $true
            }
        }
    }
    "DryRun" {
        $DryRun = $true
        $results += Park-Lane -State $state -LaneName "chatgpt" -Problem "CHATGPT_CDP_UNREACHABLE"
        $results += Park-Lane -State $state -LaneName "gemini" -Problem "GEMINI_NOT_CONFIGURED"
    }
}

Set-State -State $state

$overallStatus = switch ($Mode) {
    "DryRun" { "EXTERNAL_JUDGE_SRE_DRY_RUN_PASS" }
    "HealthCheck" { "EXTERNAL_JUDGE_SRE_HEALTH_CHECK_COMPLETE" }
    "AlertFailure" { "EXTERNAL_JUDGE_SRE_ALERT_COMPLETE" }
    default { "EXTERNAL_JUDGE_SRE_ACTION_COMPLETE" }
}

Emit ([ordered]@{
    schema_version = "external_judge_sre_result_v1"
    status = $overallStatus
    mission_id = $MissionId
    mode = $Mode
    lane_requested = $Lane
    results = $results
    lanes = $state.lanes
    fallback_continues = $true
    external_failure_blocks_loop = $false
    no_user_prompt = $true
    waited_for_user = $false
    max_wait_seconds = $MaxWaitSeconds
    secrets_redacted = $true
    private_urls_redacted = $true
    ntfy_topic_printed_full = $false
    bypass_attempted = $false
})
