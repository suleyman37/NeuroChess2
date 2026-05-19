param(
    [string]$MissionId = "",
    [ValidateSet("InitPool", "Status", "Setup", "EnsureSessions", "SendChatGPT", "SendGemini", "RotateIfNeeded", "SendBootstrap", "PauseForHuman", "ResumeCheck", "DryRunProblemMatrix", "ResetRuntimeState")]
    [string]$Mode = "Status",
    [string]$MessageFile = "",
    [string[]]$AttachmentPath = @(),
    [string]$JudgeType = "chatgpt",
    [string]$GeminiUrl = "",
    [switch]$NoPrompt,
    [switch]$DryRun,
    [int]$MaxWaitMinutes = 30,
    [switch]$ConfirmReset,
    [switch]$ClearPool,
    [string]$PoolConfigPath = "",
    [string]$StatePath = "",
    [string]$ArtifactPath = "",
    [string]$ProblemCode = "",
    [switch]$ShowPrivateUrls
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
    (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Get-DefaultArtifactPath {
    Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\web_judge_orchestrator\A20AG_web_judge_orchestrator_10_discussions_20260518"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $Payload | ConvertTo-Json -Depth 60 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Read-JsonFile {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        return (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json)
    }
    return $null
}

function Set-ObjectField {
    param($Object, [string]$Name, $Value)
    if ($null -eq $Object) { return }
    if ($Object -is [hashtable] -or $Object -is [System.Collections.Specialized.OrderedDictionary]) {
        $Object[$Name] = $Value
        return
    }
    if ($Object.PSObject.Properties.Name -contains $Name) {
        $Object.$Name = $Value
    } else {
        $Object | Add-Member -NotePropertyName $Name -NotePropertyValue $Value -Force
    }
}

function Emit-Result {
    param([object]$Payload, [int]$ExitCode = 0, [string]$ArtifactName = "")
    if (-not [string]::IsNullOrWhiteSpace($ArtifactName)) {
        Write-JsonFile -Path (Join-Path $ArtifactPath $ArtifactName) -Payload $Payload
    }
    $Payload | ConvertTo-Json -Depth 60
    exit $ExitCode
}

function Convert-JsonOutput {
    param([object[]]$Output)
    $text = ($Output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { throw "Script did not emit JSON: $text" }
    $text.Substring($start) | ConvertFrom-Json
}

function Invoke-JsonScript {
    param([string]$ScriptPath, [string[]]$Arguments = @(), [int[]]$AcceptExitCodes = @(0))
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @Arguments 2>&1
    $exit = $LASTEXITCODE
    if ($AcceptExitCodes -notcontains $exit) {
        $text = ($output | Out-String)
        throw "Script failed with exit code ${exit}: $ScriptPath`n$text"
    }
    Convert-JsonOutput -Output $output
}

function New-DefaultPool {
    $entries = @()
    foreach ($code in 65..74) {
        $label = [char]$code
        $entries += [ordered]@{
            label = [string]$label
            url = ""
            message_count_sent = 0
            bootstrap_sent = $false
            status = if ($label -eq [char]65) { "ACTIVE" } else { "AVAILABLE" }
        }
    }
    [ordered]@{
        schema_version = "web_judge_conversation_pool_local_v1"
        current_label = "A"
        rotation_threshold_messages = 35
        pool = @($entries)
    }
}

function Normalize-Pool {
    param($PoolConfig)
    if (-not $PoolConfig) { $PoolConfig = New-DefaultPool }
    $labels = @("A", "B", "C", "D", "E", "F", "G", "H", "I", "J")
    $existing = @{}
    foreach ($entry in @($PoolConfig.pool)) {
        $existing[[string]$entry.label] = $entry
    }
    $pool = @()
    foreach ($label in $labels) {
        if ($existing.ContainsKey($label)) {
            $entry = $existing[$label]
            $pool += [ordered]@{
                label = $label
                url = [string]$entry.url
                message_count_sent = [int]$entry.message_count_sent
                bootstrap_sent = [bool]$entry.bootstrap_sent
                status = if ([string]::IsNullOrWhiteSpace([string]$entry.status)) { "AVAILABLE" } else { [string]$entry.status }
            }
        } else {
            $pool += [ordered]@{
                label = $label
                url = ""
                message_count_sent = 0
                bootstrap_sent = $false
                status = "AVAILABLE"
            }
        }
    }
    $current = [string]$PoolConfig.current_label
    if ([string]::IsNullOrWhiteSpace($current)) { $current = "A" }
    foreach ($entry in $pool) {
        if ($entry.label -eq $current -and $entry.status -ne "EXHAUSTED" -and $entry.status -ne "BLOCKED") {
            $entry.status = "ACTIVE"
        } elseif ($entry.status -eq "ACTIVE") {
            $entry.status = "AVAILABLE"
        }
    }
    [ordered]@{
        schema_version = "web_judge_conversation_pool_local_v1"
        current_label = $current
        rotation_threshold_messages = if ($PoolConfig.rotation_threshold_messages) { [int]$PoolConfig.rotation_threshold_messages } else { 35 }
        pool = @($pool)
    }
}

function New-StateFromPool {
    param($PoolConfig)
    $now = (Get-Date).ToString("o")
    [ordered]@{
        status = "INITIALIZED"
        created_at = $now
        updated_at = $now
        chatgpt = [ordered]@{
            pool = @($PoolConfig.pool)
            current_label = [string]$PoolConfig.current_label
            rotation_threshold_messages = [int]$PoolConfig.rotation_threshold_messages
            rotation_required = $false
            last_human_action_required_at = $null
            last_email_alert_status = $null
        }
        gemini = [ordered]@{
            enabled = $false
            url = $null
            message_count_sent = 0
            rotation_threshold_messages = 35
            last_human_action_required_at = $null
            last_email_alert_status = $null
        }
        cdp = [ordered]@{
            endpoint = "http://127.0.0.1:9222"
            reachable = $false
            browser_launched_by_codex = $false
            browser_should_remain_open = $true
        }
        email = [ordered]@{
            recipient = "suley37550@gmail.com"
            secret_cache_status = "UNKNOWN"
        }
        problem_solution_log = @()
    }
}

function Load-Or-InitializeState {
    $state = Read-JsonFile -Path $StatePath
    if ($state) { return $state }
    $pool = Normalize-Pool -PoolConfig (Read-JsonFile -Path $PoolConfigPath)
    if (-not (Test-Path -LiteralPath $PoolConfigPath -PathType Leaf)) {
        Write-JsonFile -Path $PoolConfigPath -Payload $pool
    }
    $state = New-StateFromPool -PoolConfig $pool
    Save-StateAndPool -State $state
    return $state
}

function Save-StateAndPool {
    param($State)
    $State.updated_at = (Get-Date).ToString("o")
    Write-JsonFile -Path $StatePath -Payload $State
    $poolPayload = [ordered]@{
        schema_version = "web_judge_conversation_pool_local_v1"
        current_label = [string]$State.chatgpt.current_label
        rotation_threshold_messages = [int]$State.chatgpt.rotation_threshold_messages
        pool = @($State.chatgpt.pool)
    }
    Write-JsonFile -Path $PoolConfigPath -Payload $poolPayload
}

function Get-CurrentEntry {
    param($State)
    foreach ($entry in @($State.chatgpt.pool)) {
        if ([string]$entry.label -eq [string]$State.chatgpt.current_label) { return $entry }
    }
    return $null
}

function Get-RedactedPool {
    param($State)
    @($State.chatgpt.pool | ForEach-Object {
        [ordered]@{
            label = [string]$_.label
            url_configured = -not [string]::IsNullOrWhiteSpace([string]$_.url)
            url_redacted = $true
            message_count_sent = [int]$_.message_count_sent
            bootstrap_sent = [bool]$_.bootstrap_sent
            status = [string]$_.status
        }
    })
}

function Get-RedactedStatus {
    param($State, [string]$Status = "STATUS_READY")
    [ordered]@{
        schema_version = "web_judge_orchestrator_status_v1"
        status = $Status
        mission_id = $MissionId
        state_path = $StatePath
        local_pool_path = $PoolConfigPath
        private_urls_redacted = -not [bool]$ShowPrivateUrls
        current_label = [string]$State.chatgpt.current_label
        rotation_threshold_messages = [int]$State.chatgpt.rotation_threshold_messages
        rotation_required = [bool]$State.chatgpt.rotation_required
        chatgpt_pool = Get-RedactedPool -State $State
        gemini = [ordered]@{
            enabled = [bool]$State.gemini.enabled
            url_configured = -not [string]::IsNullOrWhiteSpace([string]$State.gemini.url)
            url_redacted = $true
        }
        cdp = $State.cdp
        email = $State.email
        live_chatgpt_called = $false
        live_gemini_called = $false
        product_mission_executed = $false
        bypass_attempted = $false
    }
}

function Get-ProblemMatrix {
    @(
        @{ code = "CDP_UNREACHABLE"; action = "launch_or_attach_chrome_cdp"; forbidden = "kill_user_browser"; retry_limit = 1; email = $false; stop_status = "CDP_SESSION_UNAVAILABLE" },
        @{ code = "AUTH_OR_CONSENT_WALL"; action = "ntfy_alert_pause_resume"; forbidden = "click_or_enter_credentials"; retry_limit = 0; email = "gmail_fallback_only"; stop_status = "WAITING_FOR_HUMAN_ACTION" },
        @{ code = "HUMAN_VERIFICATION_REQUIRED"; action = "ntfy_alert_pause_resume"; forbidden = "automate_human_verification"; retry_limit = 0; email = "gmail_fallback_only"; stop_status = "WAITING_FOR_HUMAN_ACTION" },
        @{ code = "CAPTCHA_REQUIRED"; action = "ntfy_alert_pause_resume"; forbidden = "solve_or_click_captcha"; retry_limit = 0; email = "gmail_fallback_only"; stop_status = "WAITING_FOR_HUMAN_ACTION" },
        @{ code = "TWO_FACTOR_REQUIRED"; action = "ntfy_alert_pause_resume"; forbidden = "enter_2fa_code"; retry_limit = 0; email = "gmail_fallback_only"; stop_status = "WAITING_FOR_HUMAN_ACTION" },
        @{ code = "CHATGPT_CONVERSATION_TOO_LONG"; action = "rotate_discussion_or_ntfy_user"; forbidden = "send_to_exhausted_discussion"; retry_limit = 0; email = "gmail_fallback_only_if_enabled"; stop_status = "CHATGPT_POOL_EXHAUSTED" },
        @{ code = "CHATGPT_DISCUSSION_NOT_BOOTSTRAPPED"; action = "send_bootstrap_first"; forbidden = "send_normal_prompt_first"; retry_limit = 1; email = $false; stop_status = "BOOTSTRAP_REQUIRED" },
        @{ code = "EMAIL_PREFLIGHT_FAILED"; action = "record_gmail_fallback_unavailable_but_continue_if_ntfy_ready"; forbidden = "block_live_flow_when_ntfy_ready"; retry_limit = 0; email = "fallback_disabled_by_default"; stop_status = "GMAIL_FALLBACK_UNAVAILABLE" },
        @{ code = "ALERT_DELIVERY_FAILED"; action = "stop_live_action"; forbidden = "proceed_without_human_alert"; retry_limit = 0; email = "fallback_only_if_enabled"; stop_status = "ALERT_DELIVERY_FAILED" },
        @{ code = "OPERATOR_PROMPT_LEAK"; action = "fail_and_route_through_resolver"; forbidden = "ask_low_level_parameters"; retry_limit = 0; email = $false; stop_status = "OPERATOR_PROMPT_LEAK_DETECTED" },
        @{ code = "UPLOAD_ATTACHMENT_NOT_CONFIRMED"; action = "stop_before_send"; forbidden = "send_text_only_visual_prompt"; retry_limit = 0; email = $false; stop_status = "CHATGPT_ATTACHMENT_NOT_CONFIRMED" },
        @{ code = "JSON_INVALID"; action = "one_json_correction"; forbidden = "clamp_or_accept_placeholder"; retry_limit = 1; email = $false; stop_status = "JSON_INVALID" },
        @{ code = "SESSION_CLOSED"; action = "safe_reattach_once"; forbidden = "loop_or_kill_browser"; retry_limit = 1; email = "conditional"; stop_status = "SESSION_CLOSED" },
        @{ code = "PAGE_NOT_EXPECTED_DISCUSSION"; action = "safe_navigate_or_email"; forbidden = "print_private_url"; retry_limit = 1; email = "conditional"; stop_status = "PAGE_NOT_EXPECTED_DISCUSSION" },
        @{ code = "MESSAGE_SEND_FAILED"; action = "retry_once_then_stop"; forbidden = "keep_retrying"; retry_limit = 1; email = $false; stop_status = "MESSAGE_SEND_FAILED" },
        @{ code = "GEMINI_DISABLED_NO_URL"; action = "mark_gemini_disabled"; forbidden = "invent_gemini_url"; retry_limit = 0; email = "optional"; stop_status = "GEMINI_DISABLED_NO_URL" }
    )
}

function Invoke-RotateIfNeeded {
    param($State, [switch]$EmailIfExhausted)
    $threshold = [int]$State.chatgpt.rotation_threshold_messages
    $current = Get-CurrentEntry -State $State
    $rotated = $false
    $emailRequested = $false
    $previousLabel = if ($current) { [string]$current.label } else { [string]$State.chatgpt.current_label }

    if ($current -and [int]$current.message_count_sent -lt $threshold) {
        $State.chatgpt.rotation_required = $false
        return [ordered]@{
            status = "ROTATION_NOT_REQUIRED"
            rotated = $false
            previous_label = $previousLabel
            current_label = [string]$State.chatgpt.current_label
            email_requested = $false
        }
    }

    if ($current) { $current.status = "EXHAUSTED" }
    $labels = @("A", "B", "C", "D", "E", "F", "G", "H", "I", "J")
    $startIndex = [Array]::IndexOf($labels, $previousLabel)
    if ($startIndex -lt 0) { $startIndex = 0 }
    $nextEntry = $null
    for ($offset = 1; $offset -le $labels.Count; $offset++) {
        $candidateLabel = $labels[($startIndex + $offset) % $labels.Count]
        $candidate = @($State.chatgpt.pool | Where-Object { [string]$_.label -eq $candidateLabel }) | Select-Object -First 1
        if ($candidate -and [int]$candidate.message_count_sent -lt $threshold -and [string]$candidate.status -notin @("EXHAUSTED", "BLOCKED")) {
            $nextEntry = $candidate
            break
        }
    }

    if ($nextEntry) {
        foreach ($entry in @($State.chatgpt.pool)) {
            if ([string]$entry.status -eq "ACTIVE") { $entry.status = "AVAILABLE" }
        }
        $nextEntry.status = "ACTIVE"
        $State.chatgpt.current_label = [string]$nextEntry.label
        $State.chatgpt.rotation_required = $false
        $rotated = $true
        $status = "ROTATED_TO_NEXT_DISCUSSION"
    } else {
        $State.chatgpt.rotation_required = $true
        $status = "CHATGPT_POOL_EXHAUSTED"
        if ($EmailIfExhausted) {
            $emailRequested = $true
            $State.chatgpt.last_email_alert_status = if ($DryRun -or $NoPrompt) { "EMAIL_REQUEST_DRY_RUN" } else { "EMAIL_REQUEST_REQUIRED" }
        }
    }

    [ordered]@{
        status = $status
        rotated = $rotated
        previous_label = $previousLabel
        current_label = [string]$State.chatgpt.current_label
        email_requested = $emailRequested
    }
}

function Increment-CurrentCounter {
    param($State, [string]$Reason)
    $entry = Get-CurrentEntry -State $State
    if (-not $entry) { throw "Current discussion not found." }
    $entry.message_count_sent = [int]$entry.message_count_sent + 1
    if ([int]$entry.message_count_sent -ge [int]$State.chatgpt.rotation_threshold_messages) {
        $State.chatgpt.rotation_required = $true
    }
    [ordered]@{
        label = [string]$entry.label
        message_count_sent = [int]$entry.message_count_sent
        reason = $Reason
    }
}

function Build-Bootstrap {
    param($State, [string]$Objective = "Coordinate NeuroChess web judge session safely.")
    $current = Get-CurrentEntry -State $State
    $outPath = Join-Path $ArtifactPath "bootstrap_context_sample.md"
    $args = @(
        "-MissionId", $MissionId,
        "-CurrentObjective", $Objective,
        "-DiscussionLabel", ([string]$current.label),
        "-OutPath", $outPath,
        "-MaxWords", "2500"
    )
    Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "build_web_judge_bootstrap_context.ps1") -Arguments $args
}

function Send-Bootstrap {
    param($State)
    $current = Get-CurrentEntry -State $State
    if ([bool]$current.bootstrap_sent) {
        return [ordered]@{
            status = "BOOTSTRAP_ALREADY_SENT"
            label = [string]$current.label
            message_incremented = $false
        }
    }
    $bootstrap = Build-Bootstrap -State $State
    if (-not $DryRun) {
        $requestOut = Join-Path $ArtifactPath ("chatgpt_bootstrap_{0}" -f $current.label)
        $request = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "run_chatgpt_cdp_request.ps1") -Arguments @(
            "-RequestPath", ([string]$bootstrap.out_path),
            "-ResponseRoot", "NC_SUPERVISOR_RESPONSE",
            "-OutDir", $requestOut,
            "-TimeoutMs", ([string]($MaxWaitMinutes * 60000))
        ) -AcceptExitCodes @(0, 1, 2, 3, 4, 5)
        if ([string]$request.status -ne "pass") {
            return [ordered]@{
                status = "MESSAGE_SEND_FAILED"
                label = [string]$current.label
                bootstrap_context = $bootstrap
                request_result = $request
                message_incremented = $false
            }
        }
    }
    $current.bootstrap_sent = $true
    $increment = Increment-CurrentCounter -State $State -Reason "bootstrap_context"
    [ordered]@{
        status = "BOOTSTRAP_SENT"
        label = [string]$current.label
        bootstrap_context = $bootstrap
        increment = $increment
        message_incremented = $true
    }
}

function Invoke-EmailSetup {
    $resultPath = Join-Path $ArtifactPath "email_secret_status.json"
    $params = @{
        UseStoredSecret = $true
        SaveSecretLocal = $true
        ResultPath = $resultPath
    }
    if ($NoPrompt) { $params.NoPrompt = $true }
    $output = & (Join-Path $PSScriptRoot "setup_email_alert_env.ps1") @params 2>&1
    if (Test-Path -LiteralPath $resultPath -PathType Leaf) {
        return (Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json)
    }
    Convert-JsonOutput -Output $output
}

function Invoke-EmailPreflight {
    $resultPath = Join-Path $ArtifactPath "email_preflight_result.json"
    $args = @(
        "-MissionId", $MissionId,
        "-ArtifactPath", $ArtifactPath,
        "-ResultPath", $resultPath
    )
    if ($DryRun) { $args += "-DryRun" }
    if ($NoPrompt) { $args += "-NoPrompt" }
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "ensure_email_alert_ready.ps1") @args 2>&1
    $exit = $LASTEXITCODE
    $preflight = if (Test-Path -LiteralPath $resultPath -PathType Leaf) {
        Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
    } else {
        Convert-JsonOutput -Output $output
    }
    $preflight | Add-Member -NotePropertyName exit_code -NotePropertyValue $exit -Force
    return $preflight
}

function Stop-IfEmailPreflightFailed {
    param($Preflight)
    if ([int]$Preflight.exit_code -ne 0 -or [string]$Preflight.status -notin @("EMAIL_PREFLIGHT_READY", "EMAIL_SECRET_CACHE_CREATED_AND_READY")) {
        Emit-Result -Payload ([ordered]@{
            status = "EMAIL_PREFLIGHT_FAILED"
            email_preflight_status = [string]$Preflight.status
            email_preflight_exit_code = [int]$Preflight.exit_code
            private_urls_redacted = $true
            live_browser_started = $false
            bypass_attempted = $false
        }) -ExitCode 10 -ArtifactName "auth_wall_preflight_result.json"
    }
}

function Invoke-AlertRouterPreflight {
    $resultPath = Join-Path $ArtifactPath "alert_router_status.json"
    if ($DryRun) {
        $payload = [ordered]@{
            status = "ALERT_ROUTER_DRY_RUN_READY"
            exit_code = 0
            primary_channel = "ntfy"
            ntfy_enabled = $true
            gmail_fallback_enabled = $false
            private_topic_printed = $false
            secrets_redacted = $true
            dry_run = $true
        }
        Write-JsonFile -Path $resultPath -Payload $payload
        return [pscustomobject]$payload
    }
    $args = @(
        "-Action", "Status",
        "-ResultPath", $resultPath,
        "-NoPrompt"
    )
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "setup_alert_router.ps1") @args 2>&1
    $exit = $LASTEXITCODE
    $alert = if (Test-Path -LiteralPath $resultPath -PathType Leaf) {
        Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
    } else {
        Convert-JsonOutput -Output $output
    }
    $alert | Add-Member -NotePropertyName exit_code -NotePropertyValue $exit -Force
    return $alert
}

function Stop-IfAlertRouterFailed {
    param($Alert)
    if ([int]$Alert.exit_code -ne 0 -or [string]$Alert.status -notin @("ALERT_ROUTER_READY", "ALERT_ROUTER_NTFY_CONFIGURED", "ALERT_ROUTER_DRY_RUN_READY")) {
        Emit-Result -Payload ([ordered]@{
            status = "ALERT_ROUTER_NOT_CONFIGURED"
            alert_router_status = [string]$Alert.status
            alert_router_exit_code = [int]$Alert.exit_code
            gmail_preflight_required = $false
            private_urls_redacted = $true
            live_browser_started = $false
            bypass_attempted = $false
        }) -ExitCode 10 -ArtifactName "auth_wall_preflight_result.json"
    }
}

function Invoke-EnsureCdp {
    param($State)
    if ($DryRun) {
        $State.cdp.reachable = $true
        return [ordered]@{
            status = "DRY_RUN_CDP_NOT_TOUCHED"
            cdp_attached = $true
            browser_launched = $false
        }
    }
    $current = Get-CurrentEntry -State $State
    $resultPath = Join-Path $ArtifactPath "cdp_session_result.json"
    $args = @("-ResultPath", $resultPath)
    if ($current -and -not [string]::IsNullOrWhiteSpace([string]$current.url)) {
        $args += @("-ChatGptUrl", ([string]$current.url))
    }
    $cdp = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "ensure_chatgpt_cdp_session.ps1") -Arguments $args -AcceptExitCodes @(0, 3, 4)
    $State.cdp.reachable = ([string]$cdp.status -in @("CDP_ALREADY_AVAILABLE", "CDP_SESSION_BOOTSTRAPPED"))
    $State.cdp.browser_launched_by_codex = [bool]$cdp.browser_launched
    return $cdp
}

if ([string]::IsNullOrWhiteSpace($MissionId)) {
    [ordered]@{
        status = "MISSION_ID_REQUIRED"
        interactive_prompt_used = $false
    } | ConvertTo-Json -Depth 10
    exit 2
}
if ([string]::IsNullOrWhiteSpace($ArtifactPath)) { $ArtifactPath = Get-DefaultArtifactPath }
if ([string]::IsNullOrWhiteSpace($PoolConfigPath)) { $PoolConfigPath = Join-Path $PSScriptRoot "local\web_judge_conversation_pool.local.json" }
if ([string]::IsNullOrWhiteSpace($StatePath)) { $StatePath = Join-Path $PSScriptRoot "runtime\web_judge_session_state.json" }
New-Item -ItemType Directory -Force -Path $ArtifactPath | Out-Null
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $PoolConfigPath), (Split-Path -Parent $StatePath) | Out-Null

switch ($Mode) {
    "InitPool" {
        $pool = Normalize-Pool -PoolConfig (Read-JsonFile -Path $PoolConfigPath)
        Write-JsonFile -Path $PoolConfigPath -Payload $pool
        $state = New-StateFromPool -PoolConfig $pool
        Save-StateAndPool -State $state
        $result = Get-RedactedStatus -State $state -Status "POOL_INITIALIZED"
        $result.pool_registered_labels = @($state.chatgpt.pool | ForEach-Object { [string]$_.label })
        $result.url_count_configured = @($state.chatgpt.pool | Where-Object { -not [string]::IsNullOrWhiteSpace([string]$_.url) }).Count
        Emit-Result -Payload $result -ArtifactName "init_pool_result.json"
    }
    "Status" {
        $state = Load-Or-InitializeState
        Emit-Result -Payload (Get-RedactedStatus -State $state) -ArtifactName "status_result_redacted.json"
    }
    "Setup" {
        $state = Load-Or-InitializeState
        $alert = Invoke-AlertRouterPreflight
        Stop-IfAlertRouterFailed -Alert $alert
        $state.email.secret_cache_status = [string]$alert.status
        Set-ObjectField -Object $state.email -Name "alert_router_status" -Value ([string]$alert.status)
        Set-ObjectField -Object $state.email -Name "primary_channel" -Value ([string]$alert.primary_channel)
        $cdp = Invoke-EnsureCdp -State $state
        Save-StateAndPool -State $state
        $result = Get-RedactedStatus -State $state -Status "SETUP_COMPLETE"
        $result.alert_router_status = [string]$alert.status
        $result.email_preflight_status = "GMAIL_NOT_REQUIRED_WHEN_NTFY_READY"
        $result.gmail_blocks_live_flow = $false
        $result.cdp_status = [string]$cdp.status
        Emit-Result -Payload $result
    }
    "EnsureSessions" {
        $state = Load-Or-InitializeState
        $alert = Invoke-AlertRouterPreflight
        Stop-IfAlertRouterFailed -Alert $alert
        $state.email.secret_cache_status = [string]$alert.status
        Set-ObjectField -Object $state.email -Name "alert_router_status" -Value ([string]$alert.status)
        Set-ObjectField -Object $state.email -Name "primary_channel" -Value ([string]$alert.primary_channel)
        $cdp = Invoke-EnsureCdp -State $state
        Save-StateAndPool -State $state
        $result = Get-RedactedStatus -State $state -Status "SESSIONS_ENSURED"
        $result.alert_router_status = [string]$alert.status
        $result.email_preflight_status = "GMAIL_NOT_REQUIRED_WHEN_NTFY_READY"
        $result.gmail_blocks_live_flow = $false
        $result.cdp_status = [string]$cdp.status
        $result.gemini_status = if ([bool]$state.gemini.enabled) { "GEMINI_OPTIONAL_CONFIGURED" } else { "GEMINI_DISABLED" }
        Emit-Result -Payload $result
    }
    "SendBootstrap" {
        $state = Load-Or-InitializeState
        $alert = Invoke-AlertRouterPreflight
        Stop-IfAlertRouterFailed -Alert $alert
        $state.email.secret_cache_status = [string]$alert.status
        Set-ObjectField -Object $state.email -Name "alert_router_status" -Value ([string]$alert.status)
        $rotation = Invoke-RotateIfNeeded -State $state -EmailIfExhausted
        if ([string]$rotation.status -eq "CHATGPT_POOL_EXHAUSTED") {
            Save-StateAndPool -State $state
            Emit-Result -Payload ([ordered]@{ status = "CHATGPT_POOL_EXHAUSTED"; rotation = $rotation; private_urls_redacted = $true }) -ExitCode 3
        }
        $bootstrap = Send-Bootstrap -State $state
        Save-StateAndPool -State $state
        Emit-Result -Payload ([ordered]@{
            status = [string]$bootstrap.status
            bootstrap = $bootstrap
            current_label = [string]$state.chatgpt.current_label
            private_urls_redacted = $true
        })
    }
    "SendChatGPT" {
        if ([string]::IsNullOrWhiteSpace($MessageFile) -or -not (Test-Path -LiteralPath $MessageFile -PathType Leaf)) {
            Emit-Result -Payload ([ordered]@{
                status = "MESSAGE_FILE_REQUIRED"
                interactive_prompt_used = $false
                private_urls_redacted = $true
            }) -ExitCode 2
        }
        $state = Load-Or-InitializeState
        $alert = Invoke-AlertRouterPreflight
        Stop-IfAlertRouterFailed -Alert $alert
        $state.email.secret_cache_status = [string]$alert.status
        Set-ObjectField -Object $state.email -Name "alert_router_status" -Value ([string]$alert.status)
        $rotation = Invoke-RotateIfNeeded -State $state -EmailIfExhausted
        if ([string]$rotation.status -eq "CHATGPT_POOL_EXHAUSTED") {
            Save-StateAndPool -State $state
            Emit-Result -Payload ([ordered]@{ status = "CHATGPT_POOL_EXHAUSTED"; rotation = $rotation; private_urls_redacted = $true }) -ExitCode 3 -ArtifactName "rotation_test_result.json"
        }
        $bootstrap = $null
        $current = Get-CurrentEntry -State $state
        if (-not [bool]$current.bootstrap_sent) {
            $bootstrap = Send-Bootstrap -State $state
            if ([string]$bootstrap.status -eq "MESSAGE_SEND_FAILED") {
                Save-StateAndPool -State $state
                Emit-Result -Payload ([ordered]@{ status = "MESSAGE_SEND_FAILED"; bootstrap = $bootstrap; private_urls_redacted = $true }) -ExitCode 4
            }
        }
        if (-not $DryRun) {
            $sendOut = Join-Path $ArtifactPath ("chatgpt_send_{0}_{1}" -f $state.chatgpt.current_label, (Get-Date -Format "yyyyMMdd_HHmmss"))
            $sendResult = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "run_chatgpt_cdp_request.ps1") -Arguments @(
                "-RequestPath", (Resolve-Path -LiteralPath $MessageFile).Path,
                "-ResponseRoot", "NC_SUPERVISOR_RESPONSE",
                "-OutDir", $sendOut,
                "-TimeoutMs", ([string]($MaxWaitMinutes * 60000))
            ) -AcceptExitCodes @(0, 1, 2, 3, 4, 5)
            if ([string]$sendResult.status -ne "pass") {
                Save-StateAndPool -State $state
                Emit-Result -Payload ([ordered]@{ status = "MESSAGE_SEND_FAILED"; send_result = $sendResult; private_urls_redacted = $true }) -ExitCode 4
            }
        }
        $increment = Increment-CurrentCounter -State $state -Reason "chatgpt_message"
        Save-StateAndPool -State $state
        Emit-Result -Payload ([ordered]@{
            status = "CHATGPT_MESSAGE_SENT"
            dry_run = [bool]$DryRun
            bootstrap = $bootstrap
            increment = $increment
            current_label = [string]$state.chatgpt.current_label
            rotation_required = [bool]$state.chatgpt.rotation_required
            private_urls_redacted = $true
        })
    }
    "RotateIfNeeded" {
        $state = Load-Or-InitializeState
        $rotation = Invoke-RotateIfNeeded -State $state -EmailIfExhausted
        Save-StateAndPool -State $state
        Emit-Result -Payload ([ordered]@{ status = [string]$rotation.status; rotation = $rotation; state = Get-RedactedStatus -State $state }) -ArtifactName "rotation_test_result.json"
    }
    "SendGemini" {
        $state = Load-Or-InitializeState
        $alert = Invoke-AlertRouterPreflight
        Stop-IfAlertRouterFailed -Alert $alert
        $state.email.secret_cache_status = [string]$alert.status
        Set-ObjectField -Object $state.email -Name "alert_router_status" -Value ([string]$alert.status)
        if (-not [string]::IsNullOrWhiteSpace($GeminiUrl)) {
            $state.gemini.enabled = $true
            $state.gemini.url = $GeminiUrl
        }
        if (-not [bool]$state.gemini.enabled -or [string]::IsNullOrWhiteSpace([string]$state.gemini.url)) {
            Save-StateAndPool -State $state
            Emit-Result -Payload ([ordered]@{
                status = "GEMINI_DISABLED_NO_URL"
                chatgpt_blocked = $false
                private_urls_redacted = $true
            })
        }
        Emit-Result -Payload ([ordered]@{
            status = if ($DryRun) { "GEMINI_DRY_RUN_READY" } else { "GEMINI_SEND_NOT_IMPLEMENTED_IN_A20AG" }
            private_urls_redacted = $true
        })
    }
    "PauseForHuman" {
        $state = Load-Or-InitializeState
        $state.chatgpt.last_human_action_required_at = (Get-Date).ToString("o")
        $reasonValue = if ([string]::IsNullOrWhiteSpace($ProblemCode)) { "HUMAN_VERIFICATION_REQUIRED" } else { $ProblemCode }
        if ($DryRun) {
            $state.chatgpt.last_email_alert_status = "EMAIL_ALERT_DRY_RUN"
            Set-ObjectField -Object $state.chatgpt -Name "last_alert_router_status" -Value "ALERT_DRY_RUN"
            Save-StateAndPool -State $state
            $event = [ordered]@{
                status = "WAITING_FOR_HUMAN_ACTION"
                reason = $reasonValue
                alert_status = "ALERT_DRY_RUN"
                email_alert_status = $state.chatgpt.last_email_alert_status
                browser_should_remain_open = $true
                bypass_attempted = $false
                clicked_verification = $false
            }
            Write-JsonFile -Path (Join-Path $ArtifactPath "email_event_samples.json") -Payload $event
            Emit-Result -Payload $event
        }
        $alert = Invoke-AlertRouterPreflight
        Stop-IfAlertRouterFailed -Alert $alert
        Set-ObjectField -Object $state.email -Name "alert_router_status" -Value ([string]$alert.status)
        $pauseStatePath = Join-Path $PSScriptRoot "runtime\web_judge_human_pause_state.json"
        $pauseResultPath = Join-Path $ArtifactPath "email_event_samples.json"
        $pauseOutput = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "human_verification_pause_resume_gate.ps1") `
            -Mode PauseAndAlert `
            -ServiceName ChatGPT `
            -MissionId $MissionId `
            -Reason $reasonValue `
            -ArtifactPath $ArtifactPath `
            -PauseStatePath $pauseStatePath `
            -AlertRouterEnabled `
            -ResultPath $pauseResultPath 2>&1
        $pauseExit = $LASTEXITCODE
        $event = if (Test-Path -LiteralPath $pauseResultPath -PathType Leaf) {
            Get-Content -LiteralPath $pauseResultPath -Raw | ConvertFrom-Json
        } else {
            Convert-JsonOutput -Output $pauseOutput
        }
        $eventAlertStatus = if ($event.PSObject.Properties.Name -contains "alert_status") { [string]$event.alert_status } else { [string]$event.email_alert_status }
        if ($eventAlertStatus -notin @("ALERT_SENT_NTFY", "ALERT_SENT_GMAIL_FALLBACK", "EMAIL_ALERT_SENT")) {
            $state.chatgpt.last_email_alert_status = [string]$event.email_alert_status
            Set-ObjectField -Object $state.chatgpt -Name "last_alert_router_status" -Value $eventAlertStatus
            Save-StateAndPool -State $state
            Emit-Result -Payload ([ordered]@{
                status = "AUTH_WALL_ALERT_FAILED"
                reason = $reasonValue
                alert_status = $eventAlertStatus
                email_alert_status = [string]$event.email_alert_status
                pause_exit_code = $pauseExit
                browser_should_remain_open = $true
                bypass_attempted = $false
                clicked_verification = $false
            }) -ExitCode 11
        }
        $state.chatgpt.last_email_alert_status = [string]$event.email_alert_status
        Set-ObjectField -Object $state.chatgpt -Name "last_alert_router_status" -Value $eventAlertStatus
        Write-JsonFile -Path (Join-Path $ArtifactPath "email_event_samples.json") -Payload $event
        Save-StateAndPool -State $state
        Emit-Result -Payload $event
    }
    "ResumeCheck" {
        $state = Load-Or-InitializeState
        if (-not $DryRun) {
            $resume = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "classify_web_judge_page_state.ps1") -Arguments @(
                "-Mode", "ResumeCheck",
                "-Service", "chatgpt",
                "-MissionId", $MissionId,
                "-ArtifactPath", $ArtifactPath,
                "-NoPrompt"
            )
            Emit-Result -Payload ([ordered]@{
                status = [string]$resume.status
                classification = [string]$resume.classification
                composer_visible = [bool]$resume.composer_visible
                composer_enabled = [bool]$resume.composer_enabled
                send_available = [bool]$resume.send_available
                history_text_ignored = [bool]$resume.history_text_ignored
                ntfy_should_send = [bool]$resume.ntfy_should_send
                screenshot_path = [string]$resume.screenshot_path
                browser_should_remain_open = $true
                private_urls_redacted = $true
            }) -ArtifactName "resume_check_result.json"
        }
        Emit-Result -Payload ([ordered]@{
            status = if ($DryRun) { "STILL_WAITING" } else { "RESUME_CHECK_DELEGATED_TO_GATE" }
            browser_should_remain_open = $true
            private_urls_redacted = $true
        })
    }
    "DryRunProblemMatrix" {
        $matrix = Get-ProblemMatrix
        $result = [ordered]@{
            schema_version = "web_judge_problem_matrix_dry_run_v1"
            status = "PROBLEM_MATRIX_DRY_RUN_PASS"
            problem_count = @($matrix).Count
            matrix = @($matrix)
            bypass_actions_encoded = $false
        }
        Emit-Result -Payload $result -ArtifactName "dry_run_problem_matrix_result.json"
    }
    "ResetRuntimeState" {
        if (-not $ConfirmReset) {
            Emit-Result -Payload ([ordered]@{
                status = "RESET_REQUIRES_CONFIRM"
                runtime_deleted = $false
                local_pool_deleted = $false
            }) -ExitCode 2
        }
        $pool = Normalize-Pool -PoolConfig (Read-JsonFile -Path $PoolConfigPath)
        foreach ($entry in @($pool.pool)) {
            $entry.message_count_sent = 0
            $entry.bootstrap_sent = $false
            $entry.status = if ([string]$entry.label -eq "A") { "ACTIVE" } else { "AVAILABLE" }
        }
        $pool.current_label = "A"
        if ($ClearPool -and (Test-Path -LiteralPath $PoolConfigPath -PathType Leaf)) {
            Remove-Item -LiteralPath $PoolConfigPath -Force
            if (Test-Path -LiteralPath $StatePath -PathType Leaf) { Remove-Item -LiteralPath $StatePath -Force }
            Emit-Result -Payload ([ordered]@{ status = "RUNTIME_AND_POOL_CLEARED"; local_pool_deleted = $true; runtime_deleted = $true })
        }
        Write-JsonFile -Path $PoolConfigPath -Payload $pool
        $state = New-StateFromPool -PoolConfig $pool
        Save-StateAndPool -State $state
        Emit-Result -Payload ([ordered]@{ status = "RUNTIME_STATE_RESET"; state = Get-RedactedStatus -State $state })
    }
}
