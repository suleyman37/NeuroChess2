param(
    [ValidateSet("BuildMissionDiagnosisCapsule", "BuildNextObjectiveCapsule", "BuildVisualReviewCapsule", "BuildFailureReviewCapsule", "BuildNightReadinessCapsule")]
    [string]$Mode = "BuildNextObjectiveCapsule",
    [string]$MissionId = "A20AO",
    [string]$ObjectiveId = "",
    [string]$ReportPath = "",
    [string]$EvidencePath = "",
    [int]$MaxWords = 1200,
    [bool]$NoSecrets = $true,
    [string]$OutPath = ""
)

$ErrorActionPreference = "Stop"

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Count-Words {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return 0 }
    return @($Text -split '\s+' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }).Count
}

function Redact-Text {
    param([string]$Text)
    if (-not $NoSecrets -or [string]::IsNullOrWhiteSpace($Text)) { return $Text }
    $redacted = $Text
    $redacted = $redacted -replace 'https://chatgpt\.com/[^\s"<>]+', '[REDACTED_CHATGPT_URL]'
    $redacted = $redacted -replace 'https://gemini\.google\.com/[^\s"<>]+', '[REDACTED_GEMINI_URL]'
    $redacted = $redacted -replace 'https://ntfy\.sh/[A-Za-z0-9_-]{12,}', 'https://ntfy.sh/[REDACTED_TOPIC]'
    $redacted = $redacted -replace '(?i)(password|token|secret)\s*[:=]\s*\S+', '$1=[REDACTED]'
    return $redacted
}

function Read-JsonFile {
    param([string]$Path)
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    }
    return $null
}

function Read-ObjectiveSummary {
    param([string]$Path, [string]$Id)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    $current = $null
    $items = @()
    foreach ($raw in Get-Content -LiteralPath $Path) {
        $line = $raw.Trim()
        if ($line -match '^- id:\s*(.+)$') {
            if ($current) { $items += [pscustomobject]$current }
            $current = [ordered]@{ id = $Matches[1].Trim() }
        } elseif ($current -and $line -match '^(family|priority|expected_value|risk_tier|fallback_if_blocked):\s*(.+)$') {
            $current[$Matches[1]] = $Matches[2].Trim()
        }
    }
    if ($current) { $items += [pscustomobject]$current }
    if ([string]::IsNullOrWhiteSpace($Id)) {
        return @($items | Sort-Object -Property @{Expression = { [int]$_.priority }; Descending = $true })[0]
    }
    return @($items | Where-Object { [string]$_.id -eq $Id })[0]
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$objective = Read-ObjectiveSummary -Path (Join-Path $PSScriptRoot "objective_reservoir.yaml") -Id $ObjectiveId
$score = Read-JsonFile -Path (Join-Path $PSScriptRoot "autonomy_score_state.json")
$runtime = Read-JsonFile -Path (Join-Path $PSScriptRoot "runtime\autonomous_improvement_loop_state.json")

$lastOutcomes = @()
if ($runtime -and $runtime.iterations) {
    $lastOutcomes = @($runtime.iterations | Select-Object -Last 3 | ForEach-Object {
        [ordered]@{
            objective = [string]$_.selected_objective_id
            status = [string]$_.status
            doctor_verdict = [string]$_.doctor_verdict
        }
    })
}
if ($lastOutcomes.Count -eq 0) {
    $lastOutcomes = @(
        [ordered]@{ objective = "A20AN"; status = "AUTONOMOUS_LOOP_REHEARSAL_PASS"; doctor_verdict = "PASS" }
    )
}

$blockers = @()
if ($runtime -and $runtime.blocked_lanes) { $blockers += @($runtime.blocked_lanes | ForEach-Object { [string]$_ }) }
if ($blockers.Count -eq 0) { $blockers += "live_gpt_web_optional_or_parked" }

$evidenceRefs = @()
if (-not [string]::IsNullOrWhiteSpace($ReportPath)) { $evidenceRefs += (Redact-Text -Text $ReportPath) }
if (-not [string]::IsNullOrWhiteSpace($EvidencePath)) { $evidenceRefs += (Redact-Text -Text $EvidencePath) }

$reportSummary = ""
if (-not [string]::IsNullOrWhiteSpace($ReportPath) -and (Test-Path -LiteralPath $ReportPath -PathType Leaf)) {
    $reportSummary = (Get-Content -LiteralPath $ReportPath -TotalCount 40 | Out-String).Trim()
    $reportSummary = Redact-Text -Text $reportSummary
}

$requestedDecision = switch ($Mode) {
    "BuildMissionDiagnosisCapsule" { "Diagnose the last mission and propose one bounded next micro-mission." }
    "BuildVisualReviewCapsule" { "Review visual evidence only if provided and return a structured visual decision packet." }
    "BuildFailureReviewCapsule" { "Classify the blocker and choose a non-blocking fallback objective." }
    "BuildNightReadinessCapsule" { "Assess readiness for bounded rehearsal without launching Night Mode." }
    default { "Choose the next useful micro-mission with the smallest Codex patch contract." }
}

$capsule = [ordered]@{
    schema_version = "neurorelay_context_capsule_v1"
    capsule_type = $Mode
    mission_id = $MissionId
    objective = if ($objective) {
        [ordered]@{
            id = [string]$objective.id
            family = [string]$objective.family
            expected_value = [string]$objective.expected_value
            risk_tier = [string]$objective.risk_tier
        }
    } else {
        [ordered]@{ id = "UNSELECTED"; family = "UNKNOWN"; expected_value = "Select safe next objective."; risk_tier = "low" }
    }
    current_state_summary = "A20AN conductor exists; NeuroRelay should compress context, normalize external decisions, auction missions, and emit short Codex patch contracts."
    last_outcomes = @($lastOutcomes)
    blockers = @($blockers | Select-Object -Unique)
    score_snapshot = if ($score -and $score.scores) { $score.scores } else { [ordered]@{ overall = 17 } }
    requested_decision = $requestedDecision
    evidence_refs = @($evidenceRefs)
    report_summary = $reportSummary
    omitted_context_reason = "Excluded full mission history, private URLs, local runtime state details, secrets, screenshots, and giant logs."
    no_secrets = [bool]$NoSecrets
    private_urls_redacted = $true
}

$json = (Redact-Text -Text ($capsule | ConvertTo-Json -Depth 30))
$wordCount = Count-Words -Text $json
if ($wordCount -gt $MaxWords) {
    $capsule.report_summary = ""
    $capsule.last_outcomes = @($lastOutcomes | Select-Object -Last 1)
    $capsule.omitted_context_reason = "Compressed to fit context capsule word limit; omitted report summary and older outcomes."
    $json = (Redact-Text -Text ($capsule | ConvertTo-Json -Depth 30))
    $wordCount = Count-Words -Text $json
}
$capsule.word_count = $wordCount
$capsule.max_words = $MaxWords
$capsule.status = if ($wordCount -le $MaxWords) { "CONTEXT_CAPSULE_READY" } else { "CAPSULE_TOO_LARGE" }

Write-JsonFile -Path $OutPath -Payload $capsule
$capsule | ConvertTo-Json -Depth 30
if ($capsule.status -eq "CAPSULE_TOO_LARGE") { exit 4 }
exit 0
