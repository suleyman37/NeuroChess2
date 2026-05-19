$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20bc_session_bootstrap_test_" + [guid]::NewGuid().ToString("N"))
$ArtifactPath = Join-Path $TempRoot "artifacts"
$PoolPath = Join-Path $TempRoot "web_judge_conversation_pool.local.json"
$StatePath = Join-Path $TempRoot "playwright_state.json"
$ProfilePath = Join-Path $TempRoot "playwright_profile"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Bootstrap {
    param([string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\chatgpt_supervisor_session_bootstrap.ps1") `
        -MissionId A20BC_TEST `
        -ArtifactPath $ArtifactPath `
        -PoolConfigPath $PoolPath `
        -StatePath $StatePath `
        -ProfilePath $ProfilePath `
        @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "unexpected bootstrap exit $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    Assert-True ($start -ge 0) "bootstrap did not emit JSON"
    return $text.Substring($start) | ConvertFrom-Json
}

function Write-TestPool {
    $pool = @()
    foreach ($label in @("A", "B", "C", "D", "E", "F", "G", "H", "I", "J")) {
        $pool += [ordered]@{
            label = $label
            url = "https://example.invalid/session/$label"
            message_count_sent = 0
            status = if ($label -eq "A") { "ACTIVE" } else { "AVAILABLE" }
        }
    }
    [ordered]@{
        schema_version = "web_judge_conversation_pool_local_v1"
        current_label = "A"
        rotation_threshold_messages = 35
        pool = @($pool)
    } | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $PoolPath -Encoding UTF8
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot, $ArtifactPath | Out-Null
    Write-TestPool

    $status = Invoke-Bootstrap -Arguments @("-Mode", "Status", "-NoPrompt")
    Assert-True ($status.status -eq "PROFILE_READY_BUT_PAGE_BLOCKED") "status did not produce profile-ready parked state"
    Assert-True ($status.rotation_threshold_messages -eq 50) "threshold not normalized to 50"

    $open = Invoke-Bootstrap -Arguments @("-Mode", "OpenDiscussion", "-MockSessionStatus", "SESSION_LOADING", "-NoPrompt")
    Assert-True ($open.status -in @("SESSION_LOADING", "SESSION_UNCLASSIFIED", "CHATGPT_DISCUSSION_OPEN_FAILED")) "open discussion status unexpected"

    $human = Invoke-Bootstrap -Arguments @("-Mode", "ClassifyPage", "-MockSessionStatus", "HUMAN_ACTION_REQUIRED", "-NoPrompt")
    Assert-True ($human.status -eq "HUMAN_ACTION_REQUIRED") "human action not classified"
    Assert-True ($human.auth_or_human_wall_detected -eq $true) "human wall flag false"

    $ready = Invoke-Bootstrap -Arguments @("-Mode", "VerifySessionReady", "-MockSessionStatus", "SESSION_READY", "-NoPrompt")
    Assert-True ($ready.status -eq "SESSION_READY") "ready session not verified"
    Assert-True ($ready.composer_detected -eq $true) "ready session composer missing"

    $wait = Invoke-Bootstrap -Arguments @("-Mode", "WaitForHumanResume", "-MockSessionStatus", "HUMAN_ACTION_REQUIRED", "-MaxWaitSeconds", "5", "-NoPrompt")
    Assert-True ($wait.status -eq "HUMAN_ACTION_REQUIRED") "bounded wait did not return human action"
    Assert-True ($wait.waited_bounded -eq $true) "bounded wait flag missing"

    $report = Invoke-Bootstrap -Arguments @("-Mode", "BuildReport", "-NoPrompt")
    Assert-True ($report.local_omega_fallback_available -eq $true) "fallback unavailable in report"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\chatgpt_supervisor_session_bootstrap.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host") "bootstrap prompts user"
    Assert-True ($source -notmatch "\[System\.Windows\.Forms\.SendKeys\]|SendWait\(") "bootstrap contains active-window typing"

    $artifactText = Get-ChildItem -LiteralPath $ArtifactPath -Recurse -File | ForEach-Object { Get-Content -LiteralPath $_.FullName -Raw } | Out-String
    Assert-True ($artifactText -notmatch "https://example\.invalid|https://chatgpt\.com/") "artifact leaked private URL"
    Assert-True ($artifactText -notmatch "(?i)sk-[A-Za-z0-9_\-]{12,}|token\s*[:=]|cookie\s*[:=]|password\s*[:=]") "artifact leaked secret-like content"

    [ordered]@{
        status = "pass"
        tests = 12
        profile_ready = $true
        session_ready_detectable = $true
        human_action_bounded = $true
        no_user_prompt = $true
        no_blind_typing = $true
        resume_loop_bounded = $true
    } | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
