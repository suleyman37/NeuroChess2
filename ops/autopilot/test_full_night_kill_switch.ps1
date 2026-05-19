$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20ax_kill_switch_" + [guid]::NewGuid().ToString("N"))
$RepoRuntimeFlag = Join-Path $RepoRoot "ops\autopilot\runtime\STOP_FULL_NIGHT.flag"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Json {
    param([string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\full_night_kill_switch.ps1") @Arguments 2>&1
    Assert-True ($LASTEXITCODE -eq 0) "kill switch command failed: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
    $check = Invoke-Json -Arguments @("-RuntimeDir", $TempRoot)
    Assert-True ($check.status -eq "FULL_NIGHT_RUN_ALLOWED") "absent flag should allow run"

    $armed = Invoke-Json -Arguments @("-Action", "Arm", "-RuntimeDir", $TempRoot)
    Assert-True ($armed.status -eq "STOPPED_BY_KILL_SWITCH") "armed flag should stop"
    Assert-True ((Test-Path -LiteralPath (Join-Path $TempRoot "STOP_FULL_NIGHT.flag") -PathType Leaf)) "flag not created"

    $cleared = Invoke-Json -Arguments @("-Action", "Clear", "-RuntimeDir", $TempRoot)
    Assert-True ($cleared.status -eq "FULL_NIGHT_RUN_ALLOWED") "cleared flag should allow"

    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $RepoRuntimeFlag) | Out-Null
    "test" | Set-Content -LiteralPath $RepoRuntimeFlag -Encoding UTF8
    $status = & git -C $RepoRoot status --short -- ops/autopilot/runtime/STOP_FULL_NIGHT.flag
    Assert-True ([string]::IsNullOrWhiteSpace(($status | Out-String).Trim())) "runtime kill switch file appears in git status"

    $omegaState = Join-Path $TempRoot "omega_state.json"
    $omegaArtifacts = Join-Path $TempRoot "omega_artifacts"
    $omegaOutput = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\run_omega_autopilot.ps1") `
        -Mode Rehearsal `
        -MissionId A20AX_KILL_TEST `
        -MaxIterations 2 `
        -ArtifactPath $omegaArtifacts `
        -StatePath $omegaState 2>&1
    Assert-True ($LASTEXITCODE -eq 0) "OMEGA loop failed under kill switch: $($omegaOutput | Out-String)"
    $omegaText = ($omegaOutput | Out-String).Trim()
    $omega = $omegaText.Substring($omegaText.IndexOf("{")) | ConvertFrom-Json
    Assert-True ($omega.status -eq "STOPPED_BY_KILL_SWITCH") "OMEGA loop did not stop on kill switch"
    Assert-True ($omega.completed_iterations -eq 0) "OMEGA loop continued hidden work after kill switch"

    Remove-Item -LiteralPath $RepoRuntimeFlag -Force

    [ordered]@{ status = "pass"; tests = 7; kill_switch = "ready" } | ConvertTo-Json -Depth 6
} finally {
    if (Test-Path -LiteralPath $RepoRuntimeFlag -PathType Leaf) { Remove-Item -LiteralPath $RepoRuntimeFlag -Force }
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
