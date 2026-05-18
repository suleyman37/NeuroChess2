param(
    [string]$MissionId = "",
    [ValidateSet("", "CANARY", "A20P_VISUAL_TRAINING")]
    [string]$EvidenceKind = "",
    [switch]$NoCreate
)

$ErrorActionPreference = "Stop"

function Write-Json {
    param([object]$Payload)
    $Payload | ConvertTo-Json -Depth 20
}

if ([string]::IsNullOrWhiteSpace($MissionId)) {
    [ordered]@{
        schema_version = "neurochess_autopilot_path_resolution_v1"
        status = "MISSION_ID_REQUIRED"
        interactive_prompt_used = $false
    } | ConvertTo-Json -Depth 10
    exit 2
}

$artifactRoot = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot"
$a20afPath = Join-Path $artifactRoot "visual_court_bridge\A20AF_zero_friction_chatgpt_visual_autopilot_20260518"
$a20pPath = Join-Path $artifactRoot "visual_training\A20P_screenshot_to_patch_a20l_20260518"

$missionArtifactPath = switch -Regex ($MissionId) {
    "^A20AF" { $a20afPath; break }
    default {
        Join-Path $artifactRoot ("visual_court_bridge\{0}_{1}" -f $MissionId.ToLowerInvariant(), (Get-Date -Format "yyyyMMdd"))
    }
}

$evidencePath = if ($EvidenceKind -eq "A20P_VISUAL_TRAINING") {
    $a20pPath
} else {
    $missionArtifactPath
}

$canaryPath = Join-Path $missionArtifactPath "canary"
$rawOutputsPath = Join-Path $missionArtifactPath "raw_outputs"
$normalizedOutputsPath = Join-Path $missionArtifactPath "normalized_outputs"
$logsPath = Join-Path $missionArtifactPath "logs"

if (-not $NoCreate) {
    foreach ($dir in @(
        $missionArtifactPath,
        $canaryPath,
        $rawOutputsPath,
        $normalizedOutputsPath,
        $logsPath
    )) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}

$result = [ordered]@{
    schema_version = "neurochess_autopilot_path_resolution_v1"
    status = "PATHS_RESOLVED"
    mission_id = $MissionId
    evidence_kind = if ([string]::IsNullOrWhiteSpace($EvidenceKind)) { "CANARY" } else { $EvidenceKind }
    artifact_root = $artifactRoot
    evidence_path = $evidencePath
    output_path = $missionArtifactPath
    artifact_path = $missionArtifactPath
    canary_path = $canaryPath
    raw_outputs_path = $rawOutputsPath
    normalized_outputs_path = $normalizedOutputsPath
    logs_path = $logsPath
    a20p_visual_training_path = $a20pPath
    directories_created = -not [bool]$NoCreate
    interactive_prompt_used = $false
}

Write-Json $result
exit 0
