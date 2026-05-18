param(
    [string]$MissionId = "A20AN",
    [string]$DiagnosisPath = "",
    [string]$ScoreStatePath = "",
    [string]$OutPath = "",
    [switch]$NoLiveWeb,
    [switch]$AllowLiveWeb,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $Path -Encoding UTF8
}

$diagnosis = if (-not [string]::IsNullOrWhiteSpace($DiagnosisPath) -and (Test-Path -LiteralPath $DiagnosisPath -PathType Leaf)) {
    Get-Content -LiteralPath $DiagnosisPath -Raw | ConvertFrom-Json
} else {
    [pscustomobject]@{ verdict = "UNKNOWN"; blocked_lanes = @(); next_recommendation = "SELECT_NEXT_OBJECTIVE" }
}
$score = if (-not [string]::IsNullOrWhiteSpace($ScoreStatePath) -and (Test-Path -LiteralPath $ScoreStatePath -PathType Leaf)) {
    Get-Content -LiteralPath $ScoreStatePath -Raw | ConvertFrom-Json
} else { $null }

$packet = [ordered]@{
    mission_id = $MissionId
    diagnosis_verdict = [string]$diagnosis.verdict
    blocked_lanes = @($diagnosis.blocked_lanes)
    score_overall = if ($score -and $score.scores) { [double]$score.scores.overall } else { $null }
    requested_response = "Return one bounded micro-mission with allowed paths, validation, stop conditions, and no secrets."
    secrets_redacted = $true
    private_urls_redacted = $true
}

if ($NoLiveWeb -or $DryRun -or -not $AllowLiveWeb) {
    $result = [ordered]@{
        schema_version = "supervisor_bridge_result_v1"
        status = "SUPERVISOR_LIVE_UNAVAILABLE"
        reason = if ($NoLiveWeb) { "NoLiveWeb requested" } elseif ($DryRun) { "DryRun requested" } else { "AllowLiveWeb not set for unattended conductor" }
        packet = $packet
        fallback_required = $true
        live_gpt_web_optional = $true
        no_user_intervention = $true
        waited_for_user = $false
        secrets_redacted = $true
        private_urls_redacted = $true
    }
    Write-JsonFile -Path $OutPath -Payload $result
    $result | ConvertTo-Json -Depth 30
    exit 3
}

$result = [ordered]@{
    schema_version = "supervisor_bridge_result_v1"
    status = "SUPERVISOR_LIVE_PARKED_UNATTENDED"
    reason = "Live web send is not attempted without an explicit mission that allows it."
    packet = $packet
    fallback_required = $true
    live_gpt_web_optional = $true
    no_user_intervention = $true
    waited_for_user = $false
    secrets_redacted = $true
    private_urls_redacted = $true
}
Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 30
exit 3
