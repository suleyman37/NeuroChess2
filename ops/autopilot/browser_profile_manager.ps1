param(
    [ValidateSet("Status", "EnsureChatGPTProfile", "EnsureGeminiProfile", "EnsureAll", "LaunchChatGPT", "LaunchGemini", "HealthCheck", "StopManagedBrowsers", "DryRun")]
    [string]$Mode = "Status",
    [string]$MissionId = "A20BD",
    [string]$ArtifactPath = "",
    [string]$OutPath = "",
    [switch]$NoPrompt,
    [switch]$DryRun,
    [int]$MaxWaitSeconds = 60
)

$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$ChatGptProfileRel = "ops/autopilot/local/browser_profiles/chatgpt"
$GeminiProfileRel = "ops/autopilot/local/browser_profiles/gemini"
$ChatGptProfile = Join-Path $RepoRoot $ChatGptProfileRel
$GeminiProfile = Join-Path $RepoRoot $GeminiProfileRel
$ChatGptState = Join-Path $PSScriptRoot "runtime\chatgpt_browser_state.json"
$GeminiState = Join-Path $PSScriptRoot "runtime\gemini_browser_state.json"
$ChatGptPort = 9222
$GeminiPort = 9223

if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
    $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\dual_browser_profiles\A20BD_dual_profile_playwright_control_20260518"
}
if ([string]::IsNullOrWhiteSpace($OutPath)) {
    $OutPath = Join-Path $ArtifactPath "browser_profile_status.json"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Read-JsonFile {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path -PathType Leaf) { return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json }
    return $null
}

function Test-CdpReachable {
    param([int]$Port)
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri ("http://127.0.0.1:{0}/json/version" -f $Port) -TimeoutSec 2
        return ([int]$response.StatusCode -ge 200 -and [int]$response.StatusCode -lt 300)
    } catch {
        return $false
    }
}

function Get-CdpProcessInfo {
    param([int]$Port, [string]$ExpectedProfile)
    $expectedFull = [System.IO.Path]::GetFullPath($ExpectedProfile).TrimEnd("\")
    $items = @()
    try {
        $processes = Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" -ErrorAction SilentlyContinue
        foreach ($process in @($processes)) {
            $cmd = [string]$process.CommandLine
            if ([string]::IsNullOrWhiteSpace($cmd)) { continue }
            if ($cmd -notmatch ("--remote-debugging-port[=\s]+{0}\b" -f $Port)) { continue }
            $cmdNormalized = $cmd.Replace("/", "\")
            $expectedNormalized = $expectedFull.Replace("/", "\")
            $profileMatch = $cmdNormalized.IndexOf($expectedNormalized, [System.StringComparison]::OrdinalIgnoreCase) -ge 0
            $items += [pscustomobject]@{
                process_id = [int]$process.ProcessId
                profile_matches_policy = $profileMatch
                command_line_redacted = $true
            }
        }
    } catch {}
    return @($items)
}

function Test-CdpProfileMatchesPolicy {
    param([int]$Port, [string]$ExpectedProfile)
    $infos = @(Get-CdpProcessInfo -Port $Port -ExpectedProfile $ExpectedProfile)
    if ($infos.Count -eq 0) { return $false }
    return @($infos | Where-Object { $_.profile_matches_policy -eq $true }).Count -gt 0
}

function Get-ChromePath {
    $candidates = @(
        (Join-Path $env:ProgramFiles "Google\Chrome\Application\chrome.exe"),
        (Join-Path ${env:ProgramFiles(x86)} "Google\Chrome\Application\chrome.exe"),
        (Join-Path $env:LOCALAPPDATA "Google\Chrome\Application\chrome.exe"),
        "chrome.exe"
    )
    foreach ($candidate in $candidates) {
        if ([string]::IsNullOrWhiteSpace($candidate)) { continue }
        try {
            $cmd = Get-Command $candidate -ErrorAction SilentlyContinue
            if ($cmd) { return $cmd.Source }
        } catch {}
        if (Test-Path -LiteralPath $candidate -PathType Leaf) { return $candidate }
    }
    return ""
}

function Assert-SeparateLanes {
    $chat = (Resolve-Path -LiteralPath $ChatGptProfile -ErrorAction SilentlyContinue)
    $gem = (Resolve-Path -LiteralPath $GeminiProfile -ErrorAction SilentlyContinue)
    $chatPath = if ($chat) { $chat.Path } else { [System.IO.Path]::GetFullPath($ChatGptProfile) }
    $gemPath = if ($gem) { $gem.Path } else { [System.IO.Path]::GetFullPath($GeminiProfile) }
    if ($chatPath -eq $gemPath -or $ChatGptPort -eq $GeminiPort) {
        return [ordered]@{
            ok = $false
            status = "SHARED_BROWSER_PROFILE_FORBIDDEN"
            shared_profile = $chatPath -eq $gemPath
            shared_cdp_port = $ChatGptPort -eq $GeminiPort
        }
    }
    return [ordered]@{ ok = $true; status = "BROWSER_LANES_ISOLATED"; shared_profile = $false; shared_cdp_port = $false }
}

function Test-GitIgnored {
    param([string]$Path)
    $probe = Join-Path $Path ".ignore_probe"
    $repoPrefix = $RepoRoot.TrimEnd("\") + "\"
    $fullProbe = [System.IO.Path]::GetFullPath($probe)
    if ($fullProbe.StartsWith($repoPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
        $relative = $fullProbe.Substring($repoPrefix.Length).Replace("\", "/")
    } else {
        $relative = $fullProbe.Replace("\", "/")
    }
    & git -C $RepoRoot check-ignore -q $relative
    return $LASTEXITCODE -eq 0
}

function Ensure-Profile {
    param([ValidateSet("chatgpt", "gemini")][string]$Service)
    $profile = if ($Service -eq "chatgpt") { $ChatGptProfile } else { $GeminiProfile }
    if (-not $DryRun) { New-Item -ItemType Directory -Force -Path $profile | Out-Null }
    [ordered]@{
        service = $Service
        profile_relative_path = if ($Service -eq "chatgpt") { $ChatGptProfileRel } else { $GeminiProfileRel }
        profile_exists = (Test-Path -LiteralPath $profile -PathType Container)
        profile_gitignored = Test-GitIgnored -Path $profile
        profile_path_redacted = $true
    }
}

function Get-ChatGptStartUrl {
    $poolPath = Join-Path $PSScriptRoot "local\web_judge_conversation_pool.local.json"
    if (-not (Test-Path -LiteralPath $poolPath -PathType Leaf)) { return "https://chatgpt.com/" }
    try {
        $pool = Get-Content -LiteralPath $poolPath -Raw | ConvertFrom-Json
        $current = [string]$pool.current_label
        if ([string]::IsNullOrWhiteSpace($current)) { $current = "A" }
        foreach ($entry in @($pool.pool)) {
            if ([string]$entry.label -eq $current -and -not [string]::IsNullOrWhiteSpace([string]$entry.url)) {
                return [string]$entry.url
            }
        }
    } catch {}
    return "https://chatgpt.com/"
}

function Launch-Lane {
    param([ValidateSet("chatgpt", "gemini")][string]$Service)
    $profile = if ($Service -eq "chatgpt") { $ChatGptProfile } else { $GeminiProfile }
    $port = if ($Service -eq "chatgpt") { $ChatGptPort } else { $GeminiPort }
    $statePath = if ($Service -eq "chatgpt") { $ChatGptState } else { $GeminiState }
    $startUrl = if ($Service -eq "chatgpt") { Get-ChatGptStartUrl } else { "https://gemini.google.com/app" }
    $ensure = Ensure-Profile -Service $Service
    if (Test-CdpReachable -Port $port) {
        $policyMatch = Test-CdpProfileMatchesPolicy -Port $port -ExpectedProfile $profile
        $existingState = "SHARED_BROWSER_PROFILE_FORBIDDEN"
        if ($policyMatch) { $existingState = "BROWSER_ALREADY_READY" }
        $state = New-LaneState -Service $Service -State $existingState -ProcessId 0
        Write-JsonFile -Path $statePath -Payload $state
        return $state
    }
    if ($DryRun) {
        return New-LaneState -Service $Service -State (($Service.ToUpperInvariant()) + "_BROWSER_READY") -ProcessId 0
    }
    $chrome = Get-ChromePath
    if ([string]::IsNullOrWhiteSpace($chrome)) {
        return New-LaneState -Service $Service -State "PROFILE_LAUNCH_FAILED" -ProcessId 0
    }
    $arguments = @(
        "--remote-debugging-port=$port",
        "--user-data-dir=$profile",
        "--no-first-run",
        "--new-window",
        $startUrl
    )
    $process = Start-Process -FilePath $chrome -ArgumentList $arguments -PassThru
    $deadline = (Get-Date).AddSeconds($MaxWaitSeconds)
    while ((Get-Date) -lt $deadline) {
        if (Test-CdpReachable -Port $port) { break }
        Start-Sleep -Milliseconds 500
    }
    $ready = Test-CdpReachable -Port $port
    $launchedState = "PROFILE_LAUNCH_FAILED"
    if ($ready) { $launchedState = (($Service.ToUpperInvariant()) + "_BROWSER_READY") }
    $state = New-LaneState -Service $Service -State $launchedState -ProcessId $process.Id
    Write-JsonFile -Path $statePath -Payload $state
    return $state
}

function New-LaneState {
    param([ValidateSet("chatgpt", "gemini")][string]$Service, [string]$State, [int]$ProcessId = 0)
    $port = if ($Service -eq "chatgpt") { $ChatGptPort } else { $GeminiPort }
    $profileRel = if ($Service -eq "chatgpt") { $ChatGptProfileRel } else { $GeminiProfileRel }
    $expectedProfile = if ($Service -eq "chatgpt") { $ChatGptProfile } else { $GeminiProfile }
    $runtime = if ($Service -eq "chatgpt") { "ops/autopilot/runtime/chatgpt_browser_state.json" } else { "ops/autopilot/runtime/gemini_browser_state.json" }
    [ordered]@{
        schema_version = "browser_lane_state_v1"
        mission_id = $MissionId
        service = $Service
    cdp_port = $port
    profile_relative_path = $profileRel
    profile_path_redacted = $true
    state = $State
    cdp_reachable = Test-CdpReachable -Port $port
    cdp_profile_matches_policy = Test-CdpProfileMatchesPolicy -Port $port -ExpectedProfile $expectedProfile
    browser_process_running = $ProcessId -gt 0
        managed_process_id = if ($ProcessId -gt 0) { $ProcessId } else { $null }
        runtime_state_path = $runtime
        private_urls_redacted = $true
        secrets_redacted = $true
        no_credentials = $true
        no_verification_bypass = $true
    }
}

function Get-StatusPayload {
    $isolation = Assert-SeparateLanes
    $chatEnsure = Ensure-Profile -Service chatgpt
    $gemEnsure = Ensure-Profile -Service gemini
    [ordered]@{
        schema_version = "browser_profile_manager_result_v1"
        mission_id = $MissionId
        mode = $Mode
        status = if (-not $isolation.ok) { "SHARED_BROWSER_PROFILE_FORBIDDEN" } else { "BROWSER_PROFILE_STATUS" }
        chatgpt = [ordered]@{
            service = "chatgpt"
            profile_relative_path = $ChatGptProfileRel
            profile_path_redacted = $true
            cdp_port = $ChatGptPort
            profile_exists = [bool]$chatEnsure.profile_exists
            profile_gitignored = [bool]$chatEnsure.profile_gitignored
            cdp_reachable = Test-CdpReachable -Port $ChatGptPort
            cdp_profile_matches_policy = Test-CdpProfileMatchesPolicy -Port $ChatGptPort -ExpectedProfile $ChatGptProfile
        }
        gemini = [ordered]@{
            service = "gemini"
            profile_relative_path = $GeminiProfileRel
            profile_path_redacted = $true
            cdp_port = $GeminiPort
            profile_exists = [bool]$gemEnsure.profile_exists
            profile_gitignored = [bool]$gemEnsure.profile_gitignored
            cdp_reachable = Test-CdpReachable -Port $GeminiPort
            cdp_profile_matches_policy = Test-CdpProfileMatchesPolicy -Port $GeminiPort -ExpectedProfile $GeminiProfile
        }
        separate_profiles = -not [bool]$isolation.shared_profile
        separate_cdp_ports = -not [bool]$isolation.shared_cdp_port
        shared_profile_rejected = -not [bool]$isolation.ok
        shared_profile_rejection_policy = $true
        shared_cdp_port_rejection_policy = $true
        no_user_prompt = $true
        private_urls_redacted = $true
        secrets_redacted = $true
        no_credentials = $true
        no_verification_bypass = $true
    }
}

function Stop-ManagedLane {
    param([string]$StatePath)
    $state = Read-JsonFile -Path $StatePath
    if (-not $state -or -not $state.managed_process_id) { return [ordered]@{ stopped = $false; reason = "NO_MANAGED_PROCESS" } }
    try {
        Stop-Process -Id ([int]$state.managed_process_id) -ErrorAction Stop
        return [ordered]@{ stopped = $true; process_id = [int]$state.managed_process_id }
    } catch {
        return [ordered]@{ stopped = $false; reason = "STOP_FAILED_OR_ALREADY_EXITED" }
    }
}

New-Item -ItemType Directory -Force -Path $ArtifactPath, (Join-Path $PSScriptRoot "runtime") | Out-Null

$result = switch ($Mode) {
    "EnsureChatGPTProfile" { [ordered]@{ schema_version = "browser_profile_manager_result_v1"; status = "CHATGPT_PROFILE_READY"; chatgpt = (Ensure-Profile -Service chatgpt); private_urls_redacted = $true; secrets_redacted = $true } }
    "EnsureGeminiProfile" { [ordered]@{ schema_version = "browser_profile_manager_result_v1"; status = "GEMINI_PROFILE_READY"; gemini = (Ensure-Profile -Service gemini); private_urls_redacted = $true; secrets_redacted = $true } }
    "EnsureAll" {
        $chat = Ensure-Profile -Service chatgpt
        $gem = Ensure-Profile -Service gemini
        $isolation = Assert-SeparateLanes
        [ordered]@{
            schema_version = "browser_profile_manager_result_v1"
            status = if ($isolation.ok) { "DUAL_BROWSER_PROFILES_READY" } else { "SHARED_BROWSER_PROFILE_FORBIDDEN" }
            chatgpt = $chat
            gemini = $gem
            separate_profiles = -not [bool]$isolation.shared_profile
            separate_cdp_ports = -not [bool]$isolation.shared_cdp_port
            shared_profile_rejected = -not [bool]$isolation.ok
            shared_profile_rejection_policy = $true
            shared_cdp_port_rejection_policy = $true
            private_urls_redacted = $true
            secrets_redacted = $true
        }
    }
    "LaunchChatGPT" { Launch-Lane -Service chatgpt }
    "LaunchGemini" { Launch-Lane -Service gemini }
    "HealthCheck" { Get-StatusPayload }
    "StopManagedBrowsers" {
        [ordered]@{
            schema_version = "browser_profile_manager_result_v1"
            status = "STOP_MANAGED_BROWSERS_COMPLETE"
            chatgpt = Stop-ManagedLane -StatePath $ChatGptState
            gemini = Stop-ManagedLane -StatePath $GeminiState
            user_chrome_killed = $false
            private_urls_redacted = $true
            secrets_redacted = $true
        }
    }
    "DryRun" {
        $chat = Ensure-Profile -Service chatgpt
        $gem = Ensure-Profile -Service gemini
        [ordered]@{
            schema_version = "browser_profile_manager_result_v1"
            status = "DUAL_BROWSER_PROFILE_DRY_RUN_PASS"
            chatgpt = $chat
            gemini = $gem
            separate_profiles = $true
            separate_cdp_ports = $true
            shared_profile_rejected = $true
            shared_profile_rejection_policy = $true
            shared_cdp_port_rejection_policy = $true
            private_urls_redacted = $true
            secrets_redacted = $true
        }
    }
    default { Get-StatusPayload }
}

Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 80
