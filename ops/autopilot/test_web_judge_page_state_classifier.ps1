$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20ba_web_judge_state_test_" + [guid]::NewGuid().ToString("N"))
$ArtifactPath = Join-Path $TempRoot "artifacts"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-PageState {
    param([string]$Mode, [hashtable]$Fixture)
    $fixturePath = Join-Path $TempRoot ("fixture_" + [guid]::NewGuid().ToString("N") + ".json")
    $Fixture | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $fixturePath -Encoding UTF8
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\classify_web_judge_page_state.ps1") `
        -Mode $Mode `
        -Service chatgpt `
        -MissionId A20BA_TEST `
        -FixturePath $fixturePath `
        -ArtifactPath $ArtifactPath `
        -NoPrompt 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "page state classifier exited $exit $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot, $ArtifactPath | Out-Null

    $usable = @{
        service = "chatgpt"
        composer_visible = $true
        composer_enabled = $true
        send_available = $true
        foreground_blocker_visible = $false
        body_text = "Historical report text says CAPTCHA and human verification."
        screenshot_path = Join-Path $ArtifactPath "usable.png"
    }
    $resume = Invoke-PageState -Mode ResumeCheck -Fixture $usable
    Assert-True ($resume.status -eq "RESUME_READY") "PAGE_USABLE did not map to RESUME_READY"
    Assert-True ($resume.resume_ready -eq $true) "resume_ready flag not set"
    Assert-True ($resume.ntfy_should_send -eq $false) "usable page should not send ntfy"
    Assert-True ($resume.history_text_ignored -eq $true) "history text must be ignored"

    $blocked = Invoke-PageState -Mode ResumeCheck -Fixture @{
        service = "chatgpt"
        composer_visible = $false
        composer_enabled = $false
        send_available = $false
        foreground_blocker_visible = $true
        screenshot_path = Join-Path $ArtifactPath "blocked.png"
    }
    Assert-True ($blocked.status -eq "WAITING_FOR_HUMAN_ACTION") "foreground blocker did not map to waiting"
    Assert-True ($blocked.ntfy_should_send -eq $true) "foreground blocker should allow ntfy"

    $loading = Invoke-PageState -Mode ResumeCheck -Fixture @{
        service = "chatgpt"
        composer_visible = $false
        composer_enabled = $false
        send_available = $false
        foreground_blocker_visible = $false
        page_loading = $true
    }
    Assert-True ($loading.status -eq "WAIT_AND_RECHECK") "loading shell did not map to wait"

    $unknown = Invoke-PageState -Mode ResumeCheck -Fixture @{
        service = "chatgpt"
        composer_visible = $false
        composer_enabled = $false
        send_available = $false
        foreground_blocker_visible = $false
    }
    Assert-True ($unknown.status -eq "STOP_DIAGNOSTIC") "ambiguous page did not map to diagnostic stop"
    Assert-True ($unknown.ntfy_should_send -eq $false) "unclassified state must not spam ntfy"

    [ordered]@{
        status = "pass"
        tests = 10
        page_usable_maps_resume_ready = $true
        human_action_requires_foreground_evidence = $true
        unclassified_no_ntfy_spam = $true
    } | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}
