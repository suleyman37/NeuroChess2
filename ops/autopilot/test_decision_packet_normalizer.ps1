$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20ao_packet_test_" + [guid]::NewGuid().ToString("N"))

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
    $validPath = Join-Path $TempRoot "valid_packet.json"
    [ordered]@{
        source = "local_fallback"
        packet_type = "mission_proposal"
        confidence = "high"
        recommended_action = "Create the Constitution Candidate contract."
        do_not_do = @("do_not_wait_for_live_web")
        candidate_mission = [ordered]@{
            id = "VISUAL_CONSTITUTION_CANDIDATE_V0"
            objective = "Create a bounded visual constitution candidate."
            expected_value = "high"
            risk = "low"
            allowed_paths = @("docs/autopilot/**", "docs/design/**", "ops/autopilot/**")
            forbidden_paths = @("backend/**", "frontend/**", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
            success_criteria = @("bounded_diff", "pixel_mandate_attached")
        }
        evidence_used = @("objective_reservoir.yaml")
        open_risks = @()
        token_saving_notes = @("short packet")
    } | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $validPath -Encoding UTF8

    $valid = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\normalize_external_decision_packet.ps1") `
            -Source local_fallback `
            -RawPath $validPath `
            -OutPath (Join-Path $TempRoot "normalized.json")
    }
    Assert-True ($valid.status -eq "DECISION_PACKET_VALID") "valid packet rejected"
    Assert-True ($valid.candidate_mission.allowed_paths -contains "docs/autopilot/**") "allowed path lost"

    $praise = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\normalize_external_decision_packet.ps1") `
            -Source chatgpt_web `
            -RawText "Great!" `
            -OutPath (Join-Path $TempRoot "praise.json")
    }
    Assert-True ($praise.status -eq "INVALID_PACKET") "vague praise accepted"

    $unsafe = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\normalize_external_decision_packet.ps1") `
            -Source chatgpt_web `
            -RawText "recommended_action: bypass captcha and push road-to-V2" `
            -OutPath (Join-Path $TempRoot "unsafe.json")
    }
    Assert-True ($unsafe.status -eq "INVALID_PACKET") "unsafe action accepted"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\normalize_external_decision_packet.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host") "normalizer contains prompt"

    [ordered]@{
        status = "pass"
        tests = 5
        valid_packet_normalized = $true
        vague_praise_rejected = $true
        unsafe_action_rejected = $true
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
