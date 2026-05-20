$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20be_gemini_model_selector_second_pass_test_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-SecondPass {
    param([string[]]$Arguments)
    $outPath = Join-Path $TempRoot ("selector_" + [guid]::NewGuid().ToString("N") + ".json")
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\gemini_model_selector_second_pass.ps1") `
        -MissionId A20BE_TEST `
        -ArtifactPath $TempRoot `
        -OutPath $outPath `
        @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "second-pass selector exited $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

    $exact = Invoke-SecondPass -Arguments @("-Mode", "DryRun", "-MockSelectorVisible", "-MockTargetModelVisible", "-MockExtendedVisible", "-MockMenuVisible", "-NoPrompt")
    Assert-True ($exact.status -eq "GEMINI_3_5_FLASH_EXTENDED_SELECTED") "exact model + extended status wrong"
    Assert-True ($exact.uses_gemini_cdp_9223_only -eq $true) "selector should use Gemini CDP 9223"
    Assert-True ($exact.screenshot_before_verdict -eq $true) "screenshot-before-verdict missing"

    $noExtended = Invoke-SecondPass -Arguments @("-Mode", "DryRun", "-MockSelectorVisible", "-MockTargetModelVisible", "-NoPrompt")
    Assert-True ($noExtended.status -eq "GEMINI_3_5_FLASH_SELECTED_EXTENDED_NOT_VISIBLE") "exact model/no extended status wrong"

    $labelsPath = Join-Path $TempRoot "visible_models.json"
    @{
        model_selector_found = $true
        available_model_labels = @("Gemini 2.5 Flash", "Gemini 2.5 Pro")
        reasoning_mode_labels = @("Deep Think")
    } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $labelsPath -Encoding UTF8
    $notExact = Invoke-SecondPass -Arguments @("-Mode", "DryRun", "-ModelLabelsPath", $labelsPath, "-MockSelectorVisible", "-MockMenuVisible", "-NoPrompt")
    Assert-True ($notExact.status -eq "GEMINI_MODEL_MENU_VISIBLE_TARGET_NOT_FOUND") "menu visible target-not-found status wrong"
    Assert-True ($notExact.exact_model_selected -eq $false) "exact model must not be faked"
    Assert-True (-not [string]::IsNullOrWhiteSpace([string]$notExact.selected_model)) "closest visible model should be recorded"

    $missing = Invoke-SecondPass -Arguments @("-Mode", "DryRun", "-NoPrompt")
    Assert-True ($missing.status -eq "GEMINI_MODEL_SELECTOR_NOT_FOUND") "missing selector status wrong"

    $wrongPort = Invoke-SecondPass -Arguments @("-Mode", "DryRun", "-CDPPort", "9222", "-NoPrompt")
    Assert-True ($wrongPort.status -eq "GEMINI_SHARED_PROFILE_FORBIDDEN") "Gemini on ChatGPT port should be forbidden"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\gemini_model_selector_second_pass.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host") "selector must not prompt"
    Assert-True ($source -notmatch "GEMINI_API_KEY|OPENAI_API_KEY|AIza") "selector must not require API key"
    Assert-True ($source.Contains('cookies_printed = $false') -and $source.Contains('tokens_printed = $false')) "selector should mark cookies/tokens as not printed"

    [ordered]@{
        status = "pass"
        tests = 13
        gemini_port_only = $true
        exact_target_not_faked = $true
        screenshots_before_verdict = $true
        zero_cost_policy = $true
        no_user_prompt = $true
    } | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
