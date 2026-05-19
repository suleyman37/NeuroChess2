$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20bc_gemini_model_selector_test_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Selector {
    param([hashtable]$Payload)
    $payloadPath = Join-Path $TempRoot ("models_" + [guid]::NewGuid().ToString("N") + ".json")
    $outPath = Join-Path $TempRoot ("result_" + [guid]::NewGuid().ToString("N") + ".json")
    $Payload | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $payloadPath -Encoding UTF8
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\gemini_model_selector.ps1") `
        -Mode Select `
        -MissionId A20BC_TEST `
        -ModelLabelsPath $payloadPath `
        -ArtifactPath $TempRoot `
        -OutPath $outPath `
        -NoPrompt 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "selector exited $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null

    $exact = Invoke-Selector -Payload @{
        model_selector_found = $true
        available_model_labels = @("Gemini 3.5 Flash", "Gemini 2.5 Pro")
        reasoning_mode_labels = @("Extended", "Thinking")
    }
    Assert-True ($exact.status -eq "GEMINI_3_5_FLASH_EXTENDED_SELECTED") "exact model + extended not selected"
    Assert-True ($exact.gemini_3_5_flash_visible -eq $true) "exact model not visible"
    Assert-True ($exact.extended_thinking_mode_visible -eq $true) "extended mode not visible"

    $noExtended = Invoke-Selector -Payload @{
        model_selector_found = $true
        available_model_labels = @("Gemini 3.5 Flash")
        reasoning_mode_labels = @()
    }
    Assert-True ($noExtended.status -eq "GEMINI_3_5_FLASH_SELECTED_NO_EXTENDED_MODE") "no-extended status wrong"

    $notExact = Invoke-Selector -Payload @{
        model_selector_found = $true
        available_model_labels = @("Gemini 2.5 Flash", "Gemini 2.5 Pro")
        reasoning_mode_labels = @("Deep Think")
    }
    Assert-True ($notExact.status -eq "GEMINI_3_5_FLASH_NOT_VISIBLE") "unavailable exact model not reported"
    Assert-True ($notExact.exact_model_selected -eq $false) "exact model was faked"
    Assert-True (-not [string]::IsNullOrWhiteSpace([string]$notExact.selected_model)) "closest visible model not recorded"

    $missing = Invoke-Selector -Payload @{
        model_selector_found = $false
        available_model_labels = @()
        reasoning_mode_labels = @()
    }
    Assert-True ($missing.status -eq "GEMINI_MODEL_SELECTOR_NOT_FOUND") "missing selector not reported"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\gemini_model_selector.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host") "selector must not prompt"
    Assert-True ($source -notmatch "AIza|OPENAI_API_KEY|GEMINI_API_KEY") "selector must not require API key"

    [ordered]@{
        status = "pass"
        tests = 10
        exact_model_selection = $true
        extended_mode_detection = $true
        exact_model_unavailable_reported = $true
        selector_missing_reported = $true
        zero_cost_policy = $true
    } | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
