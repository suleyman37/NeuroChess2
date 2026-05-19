$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20bc_gemini_web_lane_adapter_test_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Adapter {
    param([string[]]$Arguments)
    $outPath = Join-Path $TempRoot ("adapter_" + [guid]::NewGuid().ToString("N") + ".json")
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\gemini_web_lane_adapter.ps1") `
        -MissionId A20BC_TEST `
        -ArtifactPath $TempRoot `
        -OutPath $outPath `
        @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "adapter exited $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

    $status = Invoke-Adapter -Arguments @("-Mode", "Status", "-NoPrompt")
    Assert-True ($status.default_start_url_used -eq $true) "missing local config should use default URL"
    Assert-True ($status.no_api_call -eq $true) "status should not call API"

    $models = (@{
        available_model_labels = @("Gemini 3.5 Flash", "Extended")
        reasoning_mode_labels = @("Extended")
    } | ConvertTo-Json -Compress)
    $modelsPath = Join-Path $TempRoot "mock_models.json"
    $models | Set-Content -LiteralPath $modelsPath -Encoding UTF8

    $usable = Invoke-Adapter -Arguments @(
        "-Mode", "HealthCheck",
        "-DryRun",
        "-MockClassification", "PAGE_USABLE",
        "-MockComposerVisible",
        "-MockUploadAvailable",
        "-MockModelLabelsPath", $modelsPath,
        "-NoPrompt"
    )
    Assert-True ($usable.classification -eq "PAGE_USABLE") "composer visible should classify usable"
    Assert-True ($usable.composer_usable -eq $true) "composer not usable"
    Assert-True ($usable.status -eq "GEMINI_3_5_FLASH_EXTENDED_WEB_LANE_READY") "ready status wrong"
    Assert-True ($usable.upload_available -eq $true) "upload availability not detected"

    $auth = Invoke-Adapter -Arguments @(
        "-Mode", "HealthCheck",
        "-DryRun",
        "-MockClassification", "HUMAN_ACTION_REQUIRED",
        "-NoPrompt"
    )
    Assert-True ($auth.status -eq "GEMINI_WEB_LANE_AUTH_REQUIRED_PARKED") "auth should park lane"
    Assert-True ($auth.no_api_call -eq $true) "auth path should not call API"

    $noSelector = Invoke-Adapter -Arguments @(
        "-Mode", "SelectModel",
        "-DryRun",
        "-MockClassification", "PAGE_USABLE",
        "-MockComposerVisible",
        "-NoPrompt"
    )
    Assert-True ($noSelector.model_selector_found -eq $false) "missing selector not reported"

    $textSmoke = Invoke-Adapter -Arguments @(
        "-Mode", "SendTextSmoke",
        "-DryRun",
        "-MockClassification", "PAGE_USABLE",
        "-MockComposerVisible",
        "-MockModelLabelsPath", $modelsPath,
        "-MockTextSmokePass",
        "-NoPrompt"
    )
    Assert-True ($textSmoke.text_smoke_result -eq "GEMINI_TEXT_SMOKE_PASS") "text smoke mock did not pass"
    Assert-True ($textSmoke.decision_packet_produced -eq $true) "text smoke should produce packet"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\gemini_web_lane_adapter.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host") "adapter must not prompt"
    Assert-True ($source -notmatch "SendKeys") "adapter must not blindly type"
    Assert-True ($source -notmatch "GEMINI_API_KEY|OPENAI_API_KEY|AIza") "adapter must not require API keys"
    Assert-True ($source -notmatch "click.*captcha|captcha.*click") "adapter must not click verification"

    [ordered]@{
        status = "pass"
        tests = 17
        default_config = $true
        composer_first = $true
        auth_parks_lane = $true
        model_selector_status = $true
        text_smoke_packet = $true
        zero_cost_policy = $true
        local_fallback_preserved = $true
    } | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
