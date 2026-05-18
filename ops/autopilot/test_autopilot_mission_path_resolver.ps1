$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-JsonScript {
    param([string[]]$Arguments, [int[]]$AcceptExitCodes = @(0))
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\resolve_autopilot_mission_paths.ps1") @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($AcceptExitCodes -contains $exit) "unexpected exit code $exit"
    $text = ($output | Out-String).Trim()
    $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

$paths = Invoke-JsonScript -Arguments @("-MissionId", "A20AF")
$expected = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\visual_court_bridge\A20AF_zero_friction_chatgpt_visual_autopilot_20260518"
Assert-True ($paths.status -eq "PATHS_RESOLVED") "A20AF paths did not resolve"
Assert-True ($paths.output_path -eq $expected) "A20AF output path mismatch"
Assert-True ($paths.evidence_path -eq $expected) "A20AF evidence path mismatch"
Assert-True (Test-Path -LiteralPath $paths.canary_path -PathType Container) "canary directory not created"
Assert-True (Test-Path -LiteralPath $paths.raw_outputs_path -PathType Container) "raw outputs directory not created"

$a20p = Invoke-JsonScript -Arguments @("-MissionId", "A20AF", "-EvidenceKind", "A20P_VISUAL_TRAINING")
Assert-True ($a20p.evidence_path -like "*A20P_screenshot_to_patch_a20l_20260518") "A20P evidence path was not resolved"

$missing = Invoke-JsonScript -Arguments @() -AcceptExitCodes @(2)
Assert-True ($missing.status -eq "MISSION_ID_REQUIRED") "missing mission id did not return clear error"
Assert-True ($paths.interactive_prompt_used -eq $false) "path resolver used interactive prompt"

[ordered]@{
    status = "pass"
    tests = 8
    a20af_paths_resolved = $true
    directories_created = $true
    no_interactive_prompt = $true
    a20p_evidence_supported = $true
    missing_mission_id_clear_error = $true
} | ConvertTo-Json -Depth 10
