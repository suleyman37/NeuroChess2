param(
    [ValidateSet("Status", "InitProfile", "OpenDiscussion", "ClassifyPage", "WaitForHumanResume", "VerifySessionReady", "BuildReport")]
    [string]$Mode = "Status",
    [string]$MissionId = "A20BC",
    [switch]$NoPrompt,
    [int]$MaxWaitSeconds = 90,
    [string]$ArtifactPath = "",
    [string]$PoolConfigPath = "",
    [string]$StatePath = "",
    [string]$ProfilePath = "",
    [ValidateSet("", "SESSION_READY", "HUMAN_ACTION_REQUIRED", "SESSION_NOT_AUTHENTICATED", "SESSION_LOADING", "SESSION_UNCLASSIFIED", "CHATGPT_COMPOSER_NOT_FOUND")]
    [string]$MockSessionStatus = ""
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
    $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\mcp_playwright_chatgpt\A20BC_session_bootstrap_e2e_20260518"
}
if ([string]::IsNullOrWhiteSpace($PoolConfigPath)) {
    $PoolConfigPath = Join-Path $PSScriptRoot "local\web_judge_conversation_pool.local.json"
}
if ([string]::IsNullOrWhiteSpace($StatePath)) {
    $StatePath = Join-Path $PSScriptRoot "runtime\playwright_chatgpt_supervisor_state.json"
}
if ([string]::IsNullOrWhiteSpace($ProfilePath)) {
    $ProfilePath = Join-Path $PSScriptRoot "local\playwright_supervisor_profile"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Invoke-HarnessJson {
    param([string[]]$Arguments)
    $args = @(
        "-MissionId", $MissionId,
        "-ArtifactPath", $ArtifactPath,
        "-PoolConfigPath", $PoolConfigPath,
        "-StatePath", $StatePath,
        "-ProfilePath", $ProfilePath,
        "-MaxWaitSeconds", ([string]$MaxWaitSeconds),
        "-NoPrompt"
    ) + $Arguments
    if (-not [string]::IsNullOrWhiteSpace($MockSessionStatus)) {
        $args += @("-MockSessionStatus", $MockSessionStatus)
    }
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "playwright_chatgpt_supervisor_harness.ps1") @args 2>&1
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { throw "Harness emitted no JSON: $text" }
    return $text.Substring($start) | ConvertFrom-Json
}

function Emit-Session {
    param([object]$Payload, [string]$ArtifactName = "profile_status.json")
    Write-JsonFile -Path (Join-Path $ArtifactPath $ArtifactName) -Payload $Payload
    $Payload | ConvertTo-Json -Depth 60
    exit 0
}

New-Item -ItemType Directory -Force -Path $ArtifactPath | Out-Null

switch ($Mode) {
    "InitProfile" {
        $result = Invoke-HarnessJson -Arguments @("-Mode", "Status")
        $payload = [ordered]@{
            schema_version = "chatgpt_supervisor_session_bootstrap_v1"
            mission_id = $MissionId
            status = if ($result.profile.profile_exists -or $result.profile_exists) { "PROFILE_READY" } else { "PROFILE_MISSING" }
            profile_status = $result.profile
            cookies_printed = $false
            tokens_printed = $false
            private_urls_redacted = $true
        }
        Emit-Session -Payload $payload -ArtifactName "profile_status.json"
    }
    "Status" {
        $result = Invoke-HarnessJson -Arguments @("-Mode", "Status")
        $status = if ([string]$result.status -eq "AJ_POOL_READY") { "PROFILE_READY_BUT_PAGE_BLOCKED" } elseif ([string]$result.status -eq "CHATGPT_AJ_POOL_MISSING") { "PROFILE_READY_BUT_PAGE_BLOCKED" } else { [string]$result.status }
        $payload = [ordered]@{
            schema_version = "chatgpt_supervisor_session_bootstrap_v1"
            mission_id = $MissionId
            status = $status
            pool_status = [string]$result.status
            current_label = [string]$result.current_label
            rotation_threshold_messages = 50
            private_urls_redacted = $true
            cookies_printed = $false
            tokens_printed = $false
            local_omega_fallback_available = $true
        }
        Emit-Session -Payload $payload -ArtifactName "profile_status.json"
    }
    "OpenDiscussion" {
        $result = Invoke-HarnessJson -Arguments @("-Mode", "OpenCurrentDiscussion")
        $status = if ([string]$result.status -eq "DISCUSSION_OPENED") { "SESSION_LOADING" } else { [string]$result.status }
        $payload = [ordered]@{ status = $status; discussion_open_status = [string]$result.status; current_url_redacted = $true; private_urls_redacted = $true }
        Emit-Session -Payload $payload -ArtifactName "discussion_open_result.json"
    }
    "ClassifyPage" {
        $result = Invoke-HarnessJson -Arguments @("-Mode", "ClassifyPage")
        $payload = [ordered]@{
            status = [string]$result.status
            composer_detected = [bool]$result.composer_detected
            auth_or_human_wall_detected = [bool]$result.auth_or_human_wall_detected
            private_urls_redacted = $true
            local_omega_fallback_available = $true
        }
        Emit-Session -Payload $payload -ArtifactName "page_classification_result.json"
    }
    "VerifySessionReady" {
        $result = Invoke-HarnessJson -Arguments @("-Mode", "ClassifyPage")
        $status = if ([string]$result.status -eq "SESSION_READY") { "SESSION_READY" } elseif ([string]$result.status -eq "HUMAN_ACTION_REQUIRED") { "HUMAN_ACTION_REQUIRED" } elseif ([string]$result.status -eq "SESSION_LOADING") { "SESSION_LOADING" } else { "SESSION_UNCLASSIFIED" }
        $payload = [ordered]@{ status = $status; composer_detected = [bool]$result.composer_detected; private_urls_redacted = $true; no_bypass_attempted = $true }
        Emit-Session -Payload $payload -ArtifactName "page_classification_result.json"
    }
    "WaitForHumanResume" {
        $deadline = (Get-Date).AddSeconds([Math]::Max(5, [Math]::Min($MaxWaitSeconds, 120)))
        $last = $null
        while ((Get-Date) -lt $deadline) {
            $last = Invoke-HarnessJson -Arguments @("-Mode", "ClassifyPage")
            if ([string]$last.status -eq "SESSION_READY") {
                Emit-Session -Payload ([ordered]@{ status = "SESSION_READY"; private_urls_redacted = $true; waited_bounded = $true }) -ArtifactName "page_classification_result.json"
            }
            Start-Sleep -Seconds 3
        }
        Emit-Session -Payload ([ordered]@{ status = "HUMAN_ACTION_REQUIRED"; private_urls_redacted = $true; waited_bounded = $true; no_bypass_attempted = $true; last_status = if ($last) { [string]$last.status } else { "" } }) -ArtifactName "page_classification_result.json"
    }
    "BuildReport" {
        $result = Invoke-HarnessJson -Arguments @("-Mode", "BuildReport")
        $status = if ([string]$result.status -in @("CHATGPT_A_READY", "CHATGPT_A_MESSAGE_SUBMITTED_RESPONSE_UNREAD")) { "SESSION_READY" } elseif ([string]$result.status -eq "CHATGPT_SESSION_BOOTSTRAP_NEEDS_MANUAL_AUTH") { "HUMAN_ACTION_REQUIRED" } else { "PROFILE_READY_BUT_PAGE_BLOCKED" }
        Emit-Session -Payload ([ordered]@{ status = $status; harness_status = [string]$result.status; private_urls_redacted = $true; local_omega_fallback_available = $true }) -ArtifactName "profile_status.json"
    }
}
