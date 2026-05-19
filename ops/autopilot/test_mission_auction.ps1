$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20ao_auction_test_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-JsonCommand {
    param([scriptblock]$Command)
    $output = & $Command 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "unexpected exit code $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    Assert-True ($start -ge 0) "command did not emit JSON"
    $text.Substring($start) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
    $packetPath = Join-Path $TempRoot "packet.json"
    [ordered]@{
        status = "DECISION_PACKET_VALID"
        source = "local_fallback"
        packet_type = "mission_proposal"
        confidence = "high"
        recommended_action = "Create visible signature probes next."
        candidate_mission = [ordered]@{
            id = "SIGNATURE_CANDIDATE_PROBE_SET_V0"
            objective = "Define ten visible Signature Candidate probes."
            expected_value = "high"
            risk = "low"
            allowed_paths = @("docs/design/**", "docs/autopilot/**", "ops/autopilot/**")
            forbidden_paths = @("backend/**", "frontend/**", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
            success_criteria = @("ten_probe_routes_specified")
        }
    } | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $packetPath -Encoding UTF8

    $auction = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\mission_auction.ps1") `
            -DecisionPacketPaths $packetPath `
            -BlockedLanes "live_gpt_web,gemini" `
            -OutPath (Join-Path $TempRoot "auction.json")
    }
    Assert-True ($auction.status -eq "MISSION_AUCTION_WINNER_SELECTED") "auction did not select winner"
    Assert-True ($auction.winner.id -eq "SIGNATURE_CANDIDATE_PROBE_SET_V0") "wrong winner"
    Assert-True ($auction.pixel_production_boost_applied -eq $true) "pixel boost not recorded"
    Assert-True ($auction.fallback_works_with_zero_external_packets -eq $true) "fallback zero external not recorded"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\mission_auction.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host") "auction contains prompt"

    [ordered]@{
        status = "pass"
        tests = 5
        winner_selected = $true
        fallback_zero_external = $true
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
