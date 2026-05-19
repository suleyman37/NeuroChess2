$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20ba_manual_conversation_test_" + [guid]::NewGuid().ToString("N"))
$ArtifactPath = Join-Path $TempRoot "artifacts"
$PoolPath = Join-Path $TempRoot "web_judge_conversation_pool.local.json"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Write-TestPool {
    param([int]$MessageCount = 0)
    $entries = @()
    foreach ($label in @("A", "B", "C", "D", "E", "F", "G", "H", "I", "J")) {
        $entries += [ordered]@{
            label = $label
            url = "redacted-chatgpt-discussion-$label"
            message_count_sent = if ($label -eq "A") { $MessageCount } else { 0 }
            bootstrap_sent = $false
            status = if ($label -eq "A") { "ACTIVE" } else { "AVAILABLE" }
        }
    }
    [ordered]@{
        schema_version = "web_judge_conversation_pool_local_v1"
        current_label = "A"
        rotation_threshold_messages = 50
        pool = @($entries)
    } | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $PoolPath -Encoding UTF8
}

function Invoke-ManualTest {
    param([string[]]$Arguments, [int[]]$AcceptExitCodes = @(0))
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\chatgpt_manual_conversation_test.ps1") `
        -MissionId A20BA_TEST `
        -PoolConfigPath $PoolPath `
        -ArtifactPath $ArtifactPath `
        -NoPrompt `
        @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($AcceptExitCodes -contains $exit) "unexpected exit $exit $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    Assert-True ($text -notmatch "redacted-chatgpt-discussion-A") "private URL leaked in output"
    $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot, $ArtifactPath | Out-Null

    $missing = Invoke-ManualTest -Arguments @("-MockClassification", "PAGE_USABLE", "-MockComposerDetected", "-MockSendSuccess") -AcceptExitCodes @(2)
    Assert-True ($missing.status -eq "POOL_MISSING") "missing pool did not return POOL_MISSING"

    Write-TestPool -MessageCount 7
    $blocked = Invoke-ManualTest -Arguments @("-MockClassification", "HUMAN_ACTION_REQUIRED", "-MockComposerDetected") 
    Assert-True ($blocked.status -eq "CHATGPT_PAGE_NOT_USABLE") "blocked page should not send"
    $pool = Get-Content -LiteralPath $PoolPath -Raw | ConvertFrom-Json
    $active = @($pool.pool | Where-Object { $_.label -eq "A" })[0]
    Assert-True ($active.message_count_sent -eq 7) "counter incremented despite unusable page"

    $missingComposer = Invoke-ManualTest -Arguments @("-MockClassification", "PAGE_USABLE")
    Assert-True ($missingComposer.status -eq "CHATGPT_COMPOSER_NOT_FOUND") "missing composer should prevent send"

    $pass = Invoke-ManualTest -Arguments @("-MockClassification", "PAGE_USABLE", "-MockComposerDetected", "-MockSendSuccess", "-MockResponseStatus", "RESPONSE_JSON_OK")
    Assert-True ($pass.status -eq "CHATGPT_MANUAL_CONVERSATION_TEST_PASS") "mock pass did not pass"
    Assert-True ($pass.counter_incremented -eq $true) "counter did not increment after send"
    Assert-True ($pass.threshold_50 -eq $true) "threshold 50 not detected"
    $pool = Get-Content -LiteralPath $PoolPath -Raw | ConvertFrom-Json
    $active = @($pool.pool | Where-Object { $_.label -eq "A" })[0]
    Assert-True ($active.message_count_sent -eq 8) "counter increment after pass wrong"

    $unread = Invoke-ManualTest -Arguments @("-MockClassification", "PAGE_USABLE", "-MockComposerDetected", "-MockSendSuccess", "-MockResponseStatus", "RESPONSE_UNREAD")
    Assert-True ($unread.status -eq "CHATGPT_RESPONSE_NOT_READ") "response unread status wrong"
    Assert-True ($unread.counter_incremented -eq $true) "submitted unread message should still increment"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\chatgpt_manual_conversation_test.ps1") -Raw
    Assert-True ($source -notmatch "SendKeys") "manual test must not use blind SendKeys"
    Assert-True ($source -notmatch "Read-Host") "manual test must not prompt"
    Assert-True ($source -notmatch "document\.cookie|localStorage|sessionStorage") "manual test should not read browser secrets"

    [ordered]@{
        status = "pass"
        tests = 12
        pool_missing_handled = $true
        page_not_usable_prevents_send = $true
        composer_missing_prevents_send = $true
        counter_increments_only_after_send = $true
        threshold_50_detected = $true
        no_private_url_output = $true
        no_blind_typing = $true
    } | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}
