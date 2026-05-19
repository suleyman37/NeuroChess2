param(
    [ValidateSet("Check", "Arm", "Clear")]
    [string]$Action = "Check",
    [string]$MissionId = "A20AX",
    [string]$RuntimeDir = "",
    [string]$OutPath = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($RuntimeDir)) {
    $RuntimeDir = Join-Path $PSScriptRoot "runtime"
}
$FlagPath = Join-Path $RuntimeDir "STOP_FULL_NIGHT.flag"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding UTF8
}

if ($Action -eq "Arm") {
    New-Item -ItemType Directory -Force -Path $RuntimeDir | Out-Null
    "STOP_FULL_NIGHT $MissionId $(Get-Date -Format o)" | Set-Content -LiteralPath $FlagPath -Encoding UTF8
}
if ($Action -eq "Clear" -and (Test-Path -LiteralPath $FlagPath -PathType Leaf)) {
    Remove-Item -LiteralPath $FlagPath -Force
}

$relativeFlag = "ops/autopilot/runtime/STOP_FULL_NIGHT.flag"
& git -C $RepoRoot check-ignore -q -- $relativeFlag
$ignored = ($LASTEXITCODE -eq 0)
$exists = Test-Path -LiteralPath $FlagPath -PathType Leaf

$result = [ordered]@{
    schema_version = "full_night_kill_switch_v1"
    mission_id = $MissionId
    action = $Action
    status = if ($exists) { "STOPPED_BY_KILL_SWITCH" } else { "FULL_NIGHT_RUN_ALLOWED" }
    stop_requested = $exists
    flag_path = $FlagPath
    runtime_path_gitignored = $ignored
    artifacts_preserved = $true
    hidden_work_continues = $false
    checked_at = (Get-Date).ToString("o")
}

Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 20
exit 0
