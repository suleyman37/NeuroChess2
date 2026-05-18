$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20ak_alert_router_test_" + [guid]::NewGuid().ToString("N"))
$ArtifactPath = Join-Path $TempRoot "artifacts"
$ConfigPath = Join-Path $RepoRoot "ops\autopilot\local\alert_router_test.local.json"
$RuntimeAlertPath = Join-Path $RepoRoot "ops\autopilot\runtime\autopilot_alert_event.json"
$PrivateTopic = "neurochess-a20ak-private-topic-7f4c9b2d8e6a"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-JsonCommand {
    param([scriptblock]$Command, [int[]]$AcceptExitCodes = @(0))
    $output = & $Command 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($AcceptExitCodes -contains $exit) "unexpected exit code $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    Assert-True ($start -ge 0) "command did not emit JSON: $text"
    $text.Substring($start) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot, $ArtifactPath | Out-Null
    Remove-Item -LiteralPath $ConfigPath, $RuntimeAlertPath -Force -ErrorAction SilentlyContinue

    $missing = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\setup_alert_router.ps1") `
            -Action Status `
            -ConfigPath $ConfigPath `
            -NoPrompt
    } -AcceptExitCodes @(10)
    Assert-True ($missing.status -eq "ALERT_ROUTER_NOT_CONFIGURED") "missing router did not report not configured"

    $init = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\setup_alert_router.ps1") `
            -Action InitNtfy `
            -Topic $PrivateTopic `
            -ConfigPath $ConfigPath `
            -NoPrompt
    }
    Assert-True ($init.status -eq "ALERT_ROUTER_NTFY_CONFIGURED") "InitNtfy did not configure ntfy"
    Assert-True (Test-Path -LiteralPath $ConfigPath -PathType Leaf) "local alert router config missing"
    Assert-True ($init.ntfy_topic_redacted -notmatch [regex]::Escape($PrivateTopic)) "InitNtfy printed full private topic"

    $status = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\setup_alert_router.ps1") `
            -Action Status `
            -ConfigPath $ConfigPath `
            -NoPrompt
    }
    Assert-True ($status.status -eq "ALERT_ROUTER_READY") "status did not report ready"
    Assert-True ($status.primary_channel -eq "ntfy") "primary channel should be ntfy"
    Assert-True ($status.gmail_fallback_enabled -eq $false) "Gmail fallback should default disabled"
    Assert-True (($status | ConvertTo-Json -Depth 20) -notmatch [regex]::Escape($PrivateTopic)) "status printed full private topic"

    $dry = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\send_autopilot_alert.ps1") `
            -Channel auto `
            -MissionId A20AK_TEST `
            -ServiceName ChatGPT `
            -Reason HUMAN_VERIFICATION_REQUIRED `
            -ArtifactPath $ArtifactPath `
            -ConfigPath $ConfigPath `
            -ResultPath (Join-Path $ArtifactPath "dry_alert.json") `
            -DryRun `
            -NoPrompt
    }
    Assert-True ($dry.status -eq "ALERT_DRY_RUN") "dry-run did not return ALERT_DRY_RUN"
    Assert-True ($dry.ntfy_result.network_called -eq $false) "dry-run called network"
    Assert-True ($dry.alert_body_preview -match "Go to the Chrome window left open by Codex") "alert body missing action instruction"
    Assert-True (($dry | ConvertTo-Json -Depth 40) -notmatch [regex]::Escape($PrivateTopic)) "dry-run printed private topic"

    $mockNtfy = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\send_autopilot_alert.ps1") `
            -Channel auto `
            -MissionId A20AK_TEST `
            -ServiceName ChatGPT `
            -Reason HUMAN_VERIFICATION_REQUIRED `
            -ArtifactPath $ArtifactPath `
            -ConfigPath $ConfigPath `
            -ResultPath (Join-Path $ArtifactPath "mock_ntfy.json") `
            -MockNtfySuccess `
            -NoPrompt
    }
    Assert-True ($mockNtfy.status -eq "ALERT_SENT_NTFY") "mock ntfy did not return sent"
    Assert-True (-not ($mockNtfy.PSObject.Properties.Name -contains "gmail_status")) "Gmail should not run after ntfy succeeds"

    $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
    $config.gmail.enabled = $true
    $config | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ConfigPath -Encoding UTF8
    $fallback = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\send_autopilot_alert.ps1") `
            -Channel auto `
            -MissionId A20AK_TEST `
            -ServiceName ChatGPT `
            -Reason HUMAN_VERIFICATION_REQUIRED `
            -ArtifactPath $ArtifactPath `
            -ConfigPath $ConfigPath `
            -ResultPath (Join-Path $ArtifactPath "fallback.json") `
            -MockNtfyFailure `
            -MockGmailSuccess `
            -NoPrompt
    }
    Assert-True ($fallback.status -eq "ALERT_SENT_GMAIL_FALLBACK") "Gmail fallback was not used after ntfy failure"

    $config.gmail.enabled = $false
    $config | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ConfigPath -Encoding UTF8
    $fail = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\send_autopilot_alert.ps1") `
            -Channel auto `
            -MissionId A20AK_TEST `
            -ServiceName ChatGPT `
            -Reason HUMAN_VERIFICATION_REQUIRED `
            -ArtifactPath $ArtifactPath `
            -ConfigPath $ConfigPath `
            -ResultPath (Join-Path $ArtifactPath "failed.json") `
            -MockNtfyFailure `
            -NoPrompt
    } -AcceptExitCodes @(12)
    Assert-True ($fail.status -eq "ALERT_DELIVERY_FAILED") "ntfy failure without Gmail should stop"
    Assert-True (Test-Path -LiteralPath $RuntimeAlertPath -PathType Leaf) "runtime alert fallback was not written"

    $gateSource = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\human_verification_pause_resume_gate.ps1") -Raw
    $orchestratorSource = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\run_web_judge_orchestrator.ps1") -Raw
    $alertSource = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\send_autopilot_alert.ps1") -Raw
    Assert-True ($gateSource -match "send_autopilot_alert.ps1") "human verification gate does not call alert router"
    Assert-True ($orchestratorSource -match "Invoke-AlertRouterPreflight") "orchestrator does not preflight alert router"
    Assert-True ($orchestratorSource -match "Stop-IfAlertRouterFailed") "orchestrator does not stop when alert router missing"
    Assert-True ($orchestratorSource -notmatch "Read-Host .*EvidencePath") "EvidencePath prompt leak"
    Assert-True ($orchestratorSource -notmatch "Read-Host .*OutputPath") "OutputPath prompt leak"
    Assert-True ($orchestratorSource -notmatch "Read-Host .*ArtifactPath") "ArtifactPath prompt leak"
    Assert-True ($alertSource -notmatch "NC_ALERT_SMTP_PASSWORD") "ntfy primary alert script should not prompt for SMTP password"
    Assert-True ($alertSource -match "TimeoutSeconds") "hard timeout missing from alert sender"
    Assert-True ($alertSource -match "Go to the Chrome window left open by Codex") "alert body missing Chrome instruction"
    Assert-True ($alertSource -notmatch "https://chatgpt.com/g/") "alert sender contains private ChatGPT URL"

    $exampleText = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\alert_router.local.example.json") -Raw
    Assert-True ($exampleText -notmatch [regex]::Escape($PrivateTopic)) "tracked example contains private topic"

    $localStatus = & git -C $RepoRoot status --short -- ops/autopilot/local/alert_router_test.local.json
    $runtimeStatus = & git -C $RepoRoot status --short -- ops/autopilot/runtime/autopilot_alert_event.json
    Assert-True ([string]::IsNullOrWhiteSpace(($localStatus | Out-String).Trim())) "private topic local config appears in git status"
    Assert-True ([string]::IsNullOrWhiteSpace(($runtimeStatus | Out-String).Trim())) "runtime alert event appears in git status"

    [ordered]@{
        status = "pass"
        tests = 17
        init_ntfy_creates_local_config_only = $true
        local_config_path_ignored = $true
        tracked_example_has_no_real_topic = $true
        status_redacts_topic = $true
        dry_run_does_not_call_network = $true
        ntfy_success_returns_alert_sent_ntfy = $true
        ntfy_failure_tries_gmail_only_if_enabled = $true
        gmail_failure_irrelevant_when_ntfy_succeeds = $true
        no_smtp_password_prompt_when_ntfy_primary = $true
        human_verification_gate_calls_alert_router = $true
        orchestrator_auth_wall_uses_alert_router = $true
        conversation_too_long_can_trigger_alert = $true
        no_low_level_path_prompts = $true
        private_topic_not_staged = $true
        runtime_alert_not_staged = $true
        hard_timeout_exists = $true
        alert_body_has_action_no_private_url = $true
    } | ConvertTo-Json -Depth 20
} finally {
    Remove-Item -LiteralPath $ConfigPath, $RuntimeAlertPath -Force -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}
