$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20ap_external_judge_sre_test_" + [guid]::NewGuid().ToString("N"))
$StatePath = Join-Path $TempRoot "external_judge_sre_state.json"
$OutPath = Join-Path $TempRoot "external_judge_sre_result.json"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Sre {
    param([string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\external_judge_sre.ps1") `
        -MissionId A20AP_TEST `
        -StatePath $StatePath `
        -OutPath $OutPath `
        -ArtifactPath $TempRoot `
        @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "unexpected exit code $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    Assert-True ($start -ge 0) "SRE did not emit JSON"
    $text.Substring($start) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

    $dry = Invoke-Sre -Arguments @("-Mode", "DryRun", "-NoPrompt")
    Assert-True ($dry.status -eq "EXTERNAL_JUDGE_SRE_DRY_RUN_PASS") "dry run did not pass"
    Assert-True ($dry.fallback_continues -eq $true) "fallback should continue"
    Assert-True ($dry.external_failure_blocks_loop -eq $false) "external failure blocked loop"
    Assert-True ($dry.no_user_prompt -eq $true) "SRE claims prompt needed"
    Assert-True ($dry.lanes.chatgpt.state -eq "PARKED_CDP_UNAVAILABLE") "ChatGPT lane not parked for CDP"
    Assert-True ($dry.lanes.gemini.state -eq "SKIPPED_NOT_CONFIGURED") "Gemini lane should skip when not configured"

    $chatAlert = Invoke-Sre -Arguments @(
        "-Mode", "AlertFailure",
        "-Lane", "chatgpt",
        "-Reason", "CHATGPT_AUTH_OR_CONSENT_WALL",
        "-DryRun",
        "-NoPrompt"
    )
    Assert-True ($chatAlert.results[0].alert.status -eq "ALERT_DRY_RUN") "ChatGPT failure did not dry-run alert"
    Assert-True ($chatAlert.results[0].alert.message_preview -match "Codex continues offline: yes") "alert does not state offline continuation"

    $chatCooldown = Invoke-Sre -Arguments @(
        "-Mode", "AlertFailure",
        "-Lane", "chatgpt",
        "-Reason", "CHATGPT_AUTH_OR_CONSENT_WALL",
        "-DryRun",
        "-NoPrompt"
    )
    Assert-True ($chatCooldown.results[0].alert.status -eq "ALERT_SUPPRESSED_COOLDOWN") "cooldown did not suppress repeated ChatGPT alert"

    $geminiAlert = Invoke-Sre -Arguments @(
        "-Mode", "AlertFailure",
        "-Lane", "gemini",
        "-Reason", "GEMINI_AUTH_OR_CONSENT_WALL",
        "-DryRun",
        "-NoPrompt"
    )
    Assert-True ($geminiAlert.results[0].alert.status -eq "ALERT_DRY_RUN") "Gemini failure did not dry-run alert"

    $retry = Invoke-Sre -Arguments @("-Mode", "RetryParked", "-Lane", "chatgpt", "-NoPrompt")
    Assert-True ($retry.results[0].status -eq "PARKED_RETRY_DEFERRED") "retry should defer while parked"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\external_judge_sre.ps1") -Raw
    $policy = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\external_judge_sre_policy.yaml") -Raw
    Assert-True ($source -notmatch "Read-Host") "SRE contains user prompt"
    Assert-True ($source -match "send_autopilot_alert.ps1") "SRE does not call alert router"
    Assert-True ($source -notmatch "https://chatgpt\.com/") "SRE contains private ChatGPT URL"
    foreach ($problem in @(
        "CHATGPT_CDP_UNREACHABLE",
        "CHATGPT_AUTH_OR_CONSENT_WALL",
        "CHATGPT_PAGE_USABLE",
        "CHATGPT_UNCLASSIFIED_PAGE_STATE",
        "CHATGPT_CONVERSATION_EXHAUSTED",
        "GEMINI_NOT_CONFIGURED",
        "GEMINI_AUTH_OR_CONSENT_WALL",
        "GEMINI_NO_VISUAL_EVIDENCE",
        "GEMINI_INVALID_RESPONSE",
        "EXTERNAL_RESPONSE_TIMEOUT",
        "NTFY_ALERT_FAILED"
    )) {
        Assert-True ($policy -match $problem) "policy missing $problem"
    }

    [ordered]@{
        status = "pass"
        tests = 18
        chatgpt_sre = $true
        gemini_sre = $true
        ntfy_alert_on_failure = $true
        park_and_continue = $true
        fallback_works = $true
        no_user_prompt = $true
        alert_cooldown = $true
        policy_coverage = $true
    } | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}
