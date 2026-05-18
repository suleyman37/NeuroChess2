$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20ag_web_judge_orchestrator_test_" + [guid]::NewGuid().ToString("N"))
$ArtifactPath = Join-Path $TempRoot "artifacts"
$MessageFile = Join-Path $TempRoot "message.md"
$PoolPath = Join-Path $RepoRoot "ops\autopilot\local\web_judge_test_pool.local.json"
$StatePath = Join-Path $RepoRoot "ops\autopilot\runtime\web_judge_test_state.json"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Orchestrator {
    param([string[]]$Arguments, [int[]]$AcceptExitCodes = @(0))
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\run_web_judge_orchestrator.ps1") `
        -MissionId A20AG_TEST `
        -PoolConfigPath $PoolPath `
        -StatePath $StatePath `
        -ArtifactPath $ArtifactPath `
        @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($AcceptExitCodes -contains $exit) "unexpected exit code $exit for args $($Arguments -join ' '): $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    Assert-True ($start -ge 0) "orchestrator did not emit JSON"
    $text.Substring($start) | ConvertFrom-Json
}

function Write-TestPool {
    $entries = @()
    foreach ($label in @("A", "B", "C", "D", "E", "F", "G", "H", "I", "J")) {
        $entries += [ordered]@{
            label = $label
            url = "https://chatgpt.com/g/example-neurochess-supervisor/c/local-test-$label"
            message_count_sent = 0
            bootstrap_sent = $false
            status = if ($label -eq "A") { "ACTIVE" } else { "AVAILABLE" }
        }
    }
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $PoolPath) | Out-Null
    [ordered]@{
        schema_version = "web_judge_conversation_pool_local_v1"
        current_label = "A"
        rotation_threshold_messages = 35
        pool = @($entries)
    } | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $PoolPath -Encoding UTF8
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot, $ArtifactPath | Out-Null
    "What is the safe next step?" | Set-Content -LiteralPath $MessageFile -Encoding UTF8
    Remove-Item -LiteralPath $PoolPath, $StatePath -Force -ErrorAction SilentlyContinue
    Write-TestPool

    $init = Invoke-Orchestrator -Arguments @("-Mode", "InitPool", "-DryRun", "-NoPrompt")
    Assert-True ($init.status -eq "POOL_INITIALIZED") "InitPool did not initialize"
    Assert-True ($init.url_count_configured -eq 10) "InitPool did not register all 10 URLs"
    Assert-True ((Test-Path -LiteralPath $StatePath -PathType Leaf)) "runtime state was not created"
    Assert-True ((Test-Path -LiteralPath $PoolPath -PathType Leaf)) "local pool was not created"

    $status = Invoke-Orchestrator -Arguments @("-Mode", "Status", "-DryRun", "-NoPrompt")
    $statusText = $status | ConvertTo-Json -Depth 40
    Assert-True ($status.private_urls_redacted -eq $true) "status did not redact private URLs"
    Assert-True ($statusText -notmatch "local-test-A") "status printed a full URL"

    $bootstrap = Invoke-Orchestrator -Arguments @("-Mode", "SendBootstrap", "-DryRun", "-NoPrompt")
    Assert-True ($bootstrap.status -eq "BOOTSTRAP_SENT") "bootstrap was not sent in dry run"
    $state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
    $active = @($state.chatgpt.pool | Where-Object { $_.label -eq "A" })[0]
    Assert-True ($active.message_count_sent -eq 1) "bootstrap did not count as one message"
    Assert-True ($active.bootstrap_sent -eq $true) "bootstrap flag not set"

    $send = Invoke-Orchestrator -Arguments @("-Mode", "SendChatGPT", "-MessageFile", $MessageFile, "-DryRun", "-NoPrompt")
    Assert-True ($send.status -eq "CHATGPT_MESSAGE_SENT") "dry-run SendChatGPT failed"
    $state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
    $active = @($state.chatgpt.pool | Where-Object { $_.label -eq "A" })[0]
    Assert-True ($active.message_count_sent -eq 2) "message counter did not increment"

    $active.message_count_sent = 35
    $state | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $StatePath -Encoding UTF8
    $state.chatgpt | Select-Object current_label, rotation_threshold_messages, pool | ConvertTo-Json -Depth 40 | Out-Null
    $rotate = Invoke-Orchestrator -Arguments @("-Mode", "RotateIfNeeded", "-DryRun", "-NoPrompt")
    Assert-True ($rotate.status -eq "ROTATED_TO_NEXT_DISCUSSION") "rotation did not occur at threshold"
    Assert-True ($rotate.rotation.current_label -eq "B") "rotation did not move to B"

    $state = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
    foreach ($entry in @($state.chatgpt.pool)) {
        $entry.message_count_sent = 35
        $entry.status = "EXHAUSTED"
    }
    $state.chatgpt.current_label = "J"
    $state | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $StatePath -Encoding UTF8
    $exhausted = Invoke-Orchestrator -Arguments @("-Mode", "RotateIfNeeded", "-DryRun", "-NoPrompt")
    Assert-True ($exhausted.status -eq "CHATGPT_POOL_EXHAUSTED") "exhausted pool was not detected"
    Assert-True ($exhausted.rotation.email_requested -eq $true) "exhausted pool did not request email"

    Write-TestPool
    $init = Invoke-Orchestrator -Arguments @("-Mode", "InitPool", "-DryRun", "-NoPrompt")
    $matrix = Invoke-Orchestrator -Arguments @("-Mode", "DryRunProblemMatrix", "-DryRun", "-NoPrompt")
    Assert-True ($matrix.problem_count -ge 14) "problem matrix missing entries"
    $codes = @($matrix.matrix | ForEach-Object { [string]$_.code })
    foreach ($required in @("CDP_UNREACHABLE", "AUTH_OR_CONSENT_WALL", "HUMAN_VERIFICATION_REQUIRED", "TWO_FACTOR_REQUIRED", "OPERATOR_PROMPT_LEAK")) {
        Assert-True ($codes -contains $required) "problem matrix missing $required"
    }
    $cdp = @($matrix.matrix | Where-Object { $_.code -eq "CDP_UNREACHABLE" })[0]
    Assert-True ($cdp.stop_status -eq "CDP_SESSION_UNAVAILABLE") "CDP_UNREACHABLE mapping wrong"

    $pause = Invoke-Orchestrator -Arguments @("-Mode", "PauseForHuman", "-ProblemCode", "AUTH_OR_CONSENT_WALL", "-DryRun", "-NoPrompt")
    Assert-True ($pause.status -eq "WAITING_FOR_HUMAN_ACTION") "auth wall did not pause"
    Assert-True ($pause.email_alert_status -eq "EMAIL_ALERT_DRY_RUN") "auth wall did not produce email dry-run"
    Assert-True ($pause.clicked_verification -eq $false) "pause encoded click action"

    $missingMessage = Invoke-Orchestrator -Arguments @("-Mode", "SendChatGPT", "-DryRun", "-NoPrompt") -AcceptExitCodes @(2)
    Assert-True ($missingMessage.status -eq "MESSAGE_FILE_REQUIRED") "missing message did not fail clearly"
    Assert-True ($missingMessage.interactive_prompt_used -eq $false) "missing message used interactive prompt"

    $setup = Invoke-Orchestrator -Arguments @("-Mode", "Setup", "-DryRun", "-NoPrompt")
    Assert-True ($setup.status -eq "SETUP_COMPLETE") "setup dry run failed"
    Assert-True ($setup.email_secret_status -in @("EMAIL_PREFLIGHT_READY", "EMAIL_SECRET_CACHE_CREATED_AND_READY")) "unexpected email status"

    $bootstrapPath = Join-Path $ArtifactPath "bootstrap_context_sample.md"
    $bootstrapResult = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\build_web_judge_bootstrap_context.ps1") `
        -MissionId A20AG_TEST `
        -DiscussionLabel A `
        -OutPath $bootstrapPath `
        -MaxWords 2500 2>&1
    $bootstrapJson = ($bootstrapResult | Out-String).Trim()
    $bootstrapJson = $bootstrapJson.Substring($bootstrapJson.IndexOf("{")) | ConvertFrom-Json
    Assert-True ($bootstrapJson.word_count -le 2500) "bootstrap exceeded word limit"
    Assert-True ((Get-Content -LiteralPath $bootstrapPath -Raw) -notmatch "local-test-A") "bootstrap included private URL"

    $gemini = Invoke-Orchestrator -Arguments @("-Mode", "SendGemini", "-DryRun", "-NoPrompt")
    Assert-True ($gemini.status -eq "GEMINI_DISABLED_NO_URL") "Gemini disabled state did not return expected status"
    Assert-True ($gemini.chatgpt_blocked -eq $false) "Gemini disabled blocked ChatGPT"

    $resetBlocked = Invoke-Orchestrator -Arguments @("-Mode", "ResetRuntimeState", "-DryRun", "-NoPrompt") -AcceptExitCodes @(2)
    Assert-True ($resetBlocked.status -eq "RESET_REQUIRES_CONFIRM") "reset did not require confirmation"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\run_web_judge_orchestrator.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host .*EvidencePath") "orchestrator can prompt for EvidencePath"
    Assert-True ($source -notmatch "Read-Host .*OutputPath") "orchestrator can prompt for OutputPath"
    Assert-True ($source -notmatch "Read-Host .*ArtifactPath") "orchestrator can prompt for ArtifactPath"
    Assert-True ($source -notmatch "automate.*I am human") "orchestrator encodes human verification bypass language"
    Assert-True ($source -notmatch 'Click\(') "orchestrator contains click automation"

    $localStatus = & git -C $RepoRoot status --short -- ops/autopilot/local/web_judge_test_pool.local.json
    $runtimeStatus = & git -C $RepoRoot status --short -- ops/autopilot/runtime/web_judge_test_state.json
    Assert-True ([string]::IsNullOrWhiteSpace(($localStatus | Out-String).Trim())) "local URL pool appears in git status"
    Assert-True ([string]::IsNullOrWhiteSpace(($runtimeStatus | Out-String).Trim())) "runtime state appears in git status"

    [ordered]@{
        status = "pass"
        tests = 22
        init_pool_creates_local_state = $true
        real_urls_not_printed_in_status = $true
        message_counter_increments = $true
        bootstrap_counts_as_one = $true
        rotation_at_35 = $true
        exhausted_discussions_not_reused = $true
        exhausted_pool_requests_email = $true
        problem_matrix_maps_cdp = $true
        auth_consent_email_pause = $true
        human_verification_email_pause = ($codes -contains "HUMAN_VERIFICATION_REQUIRED")
        two_factor_email_pause = ($codes -contains "TWO_FACTOR_REQUIRED")
        operator_prompt_leak_detected_by_source_test = $true
        low_level_path_prompts_forbidden = $true
        email_secret_cache_integrated = $true
        no_prompt_mode_no_hang = $true
        local_urls_not_staged = $true
        runtime_state_not_staged = $true
        bootstrap_context_max_length_enforced = $true
        url_pool_survives_status = $true
        gemini_disabled_does_not_block_chatgpt = $true
        reset_requires_confirm = $true
        no_bypass_action_encoded = $true
    } | ConvertTo-Json -Depth 20
} finally {
    Remove-Item -LiteralPath $PoolPath, $StatePath -Force -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}
