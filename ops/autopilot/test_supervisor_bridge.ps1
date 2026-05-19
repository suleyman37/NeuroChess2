$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20an_supervisor_bridge_test_" + [guid]::NewGuid().ToString("N"))

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
    Assert-True ($start -ge 0) "command did not emit JSON"
    $text.Substring($start) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
    $diagPath = Join-Path $TempRoot "diagnosis.json"
    [ordered]@{ verdict = "BLOCKED"; blocked_lanes = @("live_gpt_web"); next_recommendation = "PARK" } | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $diagPath -Encoding UTF8
    $result = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\supervisor_bridge.ps1") `
            -MissionId A20AN_TEST `
            -DiagnosisPath $diagPath `
            -ScoreStatePath (Join-Path $RepoRoot "ops\autopilot\autonomy_score_state.json") `
            -OutPath (Join-Path $TempRoot "bridge.json") `
            -NoLiveWeb
    } -AcceptExitCodes @(3)
    Assert-True ($result.status -eq "SUPERVISOR_LIVE_UNAVAILABLE") "NoLiveWeb should park live supervisor"
    Assert-True ($result.fallback_required -eq $true) "fallback should be required"
    Assert-True ($result.no_user_intervention -eq $true) "bridge should not require user"
    Assert-True ($result.external_judge_sre.status -eq "EXTERNAL_JUDGE_SRE_HEALTH_CHECK_COMPLETE") "bridge did not run external judge SRE"
    $json = $result | ConvertTo-Json -Depth 30
    Assert-True ($json -notmatch "https://chatgpt.com/g/") "bridge output leaked private URL"
    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\supervisor_bridge.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host") "bridge contains prompt"
    Assert-True ($source -match "AllowLiveWeb") "bridge missing explicit live gate"
    Assert-True ($source -match "external_judge_sre.ps1") "bridge missing external judge SRE hook"

    [ordered]@{
        status = "pass"
        tests = 8
        live_web_optional = $true
        no_user_intervention = $true
        fallback_required_when_blocked = $true
        external_judge_sre_health_check = $true
        private_urls_redacted = $true
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
