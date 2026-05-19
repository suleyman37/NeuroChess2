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

function Invoke-JsonScript {
    param([string]$ScriptPath, [string[]]$Arguments = @(), [int[]]$AcceptExitCodes = @(0))
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @Arguments 2>&1
    $exit = $LASTEXITCODE
    if ($AcceptExitCodes -notcontains $exit) {
        throw "Unexpected exit code $exit from $ScriptPath`: $($output | Out-String)"
    }
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { throw "No JSON emitted by $ScriptPath" }
    return $text.Substring($start) | ConvertFrom-Json
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

$capsule = $null
$decisionPacket = $null
$externalJudgeSre = $null
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("neurorelay_bridge_" + [guid]::NewGuid().ToString("N"))
try {
    New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null
    $sreScript = Join-Path $PSScriptRoot "external_judge_sre.ps1"
    if (Test-Path -LiteralPath $sreScript -PathType Leaf) {
        $externalJudgeSre = Invoke-JsonScript -ScriptPath $sreScript -Arguments @(
            "-Mode", "HealthCheck",
            "-MissionId", $MissionId,
            "-Lane", "chatgpt",
            "-DryRun",
            "-NoPrompt",
            "-ArtifactPath", $tempRoot,
            "-StatePath", (Join-Path $tempRoot "external_judge_sre_state.json"),
            "-OutPath", (Join-Path $tempRoot "external_judge_sre_health.json")
        )
    }
    $capsule = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "context_capsule_builder.ps1") -Arguments @(
        "-Mode", "BuildMissionDiagnosisCapsule",
        "-MissionId", $MissionId,
        "-ReportPath", $DiagnosisPath,
        "-OutPath", (Join-Path $tempRoot "context_capsule.json")
    )
    $rawDecision = [ordered]@{
        source = "mission_doctor"
        packet_type = "failure_review"
        confidence = "medium"
        recommended_action = [string]$diagnosis.next_recommendation
        do_not_do = @("do_not_wait_for_user", "do_not_require_live_web")
        candidate_mission = [ordered]@{
            id = "SUPERVISOR_BRIDGE_LOCAL_FALLBACK"
            objective = "Use local fallback when live supervisor is unavailable."
            expected_value = "medium"
            risk = "low"
            allowed_paths = @("docs/autopilot/**", "ops/autopilot/**")
            forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
            success_criteria = @("live_lane_parked", "fallback_selected", "no_user_intervention")
        }
        evidence_used = @("mission_doctor_result")
        open_risks = @("external supervisor unavailable")
        token_saving_notes = @("Bridge used context capsule instead of raw mission history.")
    }
    $rawPath = Join-Path $tempRoot "raw_decision.json"
    Write-JsonFile -Path $rawPath -Payload $rawDecision
    $decisionPacket = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "normalize_external_decision_packet.ps1") -Arguments @(
        "-Source", "mission_doctor",
        "-RawPath", $rawPath,
        "-OutPath", (Join-Path $tempRoot "decision_packet.json")
    )
} catch {
    $capsule = [pscustomobject]@{ status = "CONTEXT_CAPSULE_UNAVAILABLE"; error_redacted = $_.Exception.Message }
    $decisionPacket = [pscustomobject]@{ status = "INVALID_PACKET"; invalid_reason = "BRIDGE_PACKET_BUILD_FAILED" }
}

if ($NoLiveWeb -or $DryRun -or -not $AllowLiveWeb) {
    $result = [ordered]@{
        schema_version = "supervisor_bridge_result_v1"
        status = "SUPERVISOR_LIVE_UNAVAILABLE"
        reason = if ($NoLiveWeb) { "NoLiveWeb requested" } elseif ($DryRun) { "DryRun requested" } else { "AllowLiveWeb not set for unattended conductor" }
        packet = $packet
        external_judge_sre = $externalJudgeSre
        context_capsule = $capsule
        decision_packet = $decisionPacket
        fallback_required = $true
        live_gpt_web_optional = $true
        no_user_intervention = $true
        waited_for_user = $false
        secrets_redacted = $true
        private_urls_redacted = $true
    }
    if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue }
    Write-JsonFile -Path $OutPath -Payload $result
    $result | ConvertTo-Json -Depth 30
    exit 3
}

$result = [ordered]@{
    schema_version = "supervisor_bridge_result_v1"
    status = "SUPERVISOR_LIVE_PARKED_UNATTENDED"
    reason = "Live web send is not attempted without an explicit mission that allows it."
    packet = $packet
    external_judge_sre = $externalJudgeSre
    context_capsule = $capsule
    decision_packet = $decisionPacket
    fallback_required = $true
    live_gpt_web_optional = $true
    no_user_intervention = $true
    waited_for_user = $false
    secrets_redacted = $true
    private_urls_redacted = $true
}
if (Test-Path -LiteralPath $tempRoot) { Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue }
Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 30
exit 3
