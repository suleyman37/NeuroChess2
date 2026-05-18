param(
    [string]$MissionId = "A20AN",
    [string]$ReservoirPath = "",
    [string]$DiagnosisPath = "",
    [string]$OutPath = "",
    [string[]]$AvoidObjectiveIds = @(),
    [switch]$NoLiveWeb
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($ReservoirPath)) {
    $ReservoirPath = Join-Path $PSScriptRoot "objective_reservoir.yaml"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Read-ObjectiveSummaries {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "RESERVOIR_NOT_FOUND" }
    $items = @()
    $current = $null
    foreach ($rawLine in Get-Content -LiteralPath $Path) {
        $line = $rawLine.Trim()
        if ($line -match '^- id:\s*(.+)$') {
            if ($current) { $items += [pscustomobject]$current }
            $current = [ordered]@{ id = $Matches[1].Trim() }
        } elseif ($current -and $line -match '^(family|priority|fallback_if_blocked):\s*(.+)$') {
            $key = $Matches[1]
            $value = $Matches[2].Trim()
            $current[$key] = if ($key -eq "priority") { [int]$value } else { $value }
        }
    }
    if ($current) { $items += [pscustomobject]$current }
    return @($items)
}

$diagnosis = if (-not [string]::IsNullOrWhiteSpace($DiagnosisPath) -and (Test-Path -LiteralPath $DiagnosisPath -PathType Leaf)) {
    Get-Content -LiteralPath $DiagnosisPath -Raw | ConvertFrom-Json
} else {
    [pscustomobject]@{ blocked_lanes = @(); do_not_repeat = @(); verdict = "UNKNOWN" }
}
$objectives = @(Read-ObjectiveSummaries -Path $ReservoirPath)
$blocked = @($diagnosis.blocked_lanes | ForEach-Object { [string]$_ })
$avoidLive = [bool]$NoLiveWeb -or ($blocked -contains "live_gpt_web")
$candidates = if ($avoidLive) {
    @($objectives | Where-Object { [string]$_.family -ne "ORCHESTRATOR_RELIABILITY" })
} else {
    @($objectives)
}
if ($candidates.Count -eq 0) { $candidates = $objectives }
$avoid = @(
    $AvoidObjectiveIds |
        ForEach-Object { ([string]$_) -split "," } |
        ForEach-Object { $_.Trim() } |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
)
if ($avoid.Count -gt 0) {
    $filtered = @($candidates | Where-Object { $avoid -notcontains [string]$_.id })
    if ($filtered.Count -gt 0) { $candidates = $filtered }
}
$visual = @($candidates | Where-Object { [string]$_.family -in @("VISUAL_PRODUCTION_MODE", "SIGNATURE_COMPONENTS") } | Sort-Object -Property priority -Descending)
$selected = if ($visual.Count -gt 0) { $visual[0] } else { @($candidates | Sort-Object -Property priority -Descending)[0] }

$result = [ordered]@{
    schema_version = "local_supervisor_fallback_result_v1"
    status = "LOCAL_FALLBACK_NEXT_OBJECTIVE_SELECTED"
    mission_id = $MissionId
    selected_objective_id = [string]$selected.id
    selected_family = [string]$selected.family
    priority = [int]$selected.priority
    avoided_objective_ids = $avoid
    reason = if ($avoidLive) { "Live supervisor lane parked; continuing offline with highest-value visual objective." } else { "Local deterministic supervisor selected highest-priority objective." }
    live_lane_parked = $avoidLive
    no_user_intervention = $true
    next_command = "powershell -ExecutionPolicy Bypass -File ops/autopilot/generate_micro_mission.ps1 -ObjectiveId $($selected.id)"
    secrets_redacted = $true
    private_urls_redacted = $true
}
Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 30
exit 0
