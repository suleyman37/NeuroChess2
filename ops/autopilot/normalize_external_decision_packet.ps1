param(
    [ValidateSet("chatgpt_web", "gemini", "local_fallback", "mission_doctor")]
    [string]$Source = "local_fallback",
    [ValidateSet("mission_proposal", "critique", "risk_review", "visual_review", "failure_review")]
    [string]$PacketType = "mission_proposal",
    [string]$RawText = "",
    [string]$RawPath = "",
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

function Reject-Packet {
    param([string]$Reason)
    $result = [ordered]@{
        schema_version = "neurorelay_decision_packet_result_v1"
        status = "INVALID_PACKET"
        invalid_reason = $Reason
        source = $Source
        packet_type = $PacketType
        no_user_intervention = $true
    }
    Write-JsonFile -Path $OutPath -Payload $result
    $result | ConvertTo-Json -Depth 20
    exit 0
}

function Redact-Text {
    param([string]$Text)
    $redacted = $Text
    $redacted = $redacted -replace 'https://chatgpt\.com/[^\s"<>]+', '[REDACTED_CHATGPT_URL]'
    $redacted = $redacted -replace 'https://gemini\.google\.com/[^\s"<>]+', '[REDACTED_GEMINI_URL]'
    $redacted = $redacted -replace 'https://ntfy\.sh/[A-Za-z0-9_-]{12,}', 'https://ntfy.sh/[REDACTED_TOPIC]'
    $redacted = $redacted -replace '(?i)(password|token|secret)\s*[:=]\s*\S+', '$1=[REDACTED]'
    return $redacted
}

$text = if (-not [string]::IsNullOrWhiteSpace($RawPath) -and (Test-Path -LiteralPath $RawPath -PathType Leaf)) {
    Get-Content -LiteralPath $RawPath -Raw
} else {
    $RawText
}
$text = Redact-Text -Text $text
if ([string]::IsNullOrWhiteSpace($text)) { Reject-Packet "EMPTY_RESPONSE" }
if ($text -match '(?i)^\s*(great|looks good|nice|excellent)[\s!.]*$') { Reject-Packet "VAGUE_PRAISE_ONLY" }
if ($text -match '(?i)bypass|captcha|i am human|enter credentials|push road-to-v2|merge road-to-v2') { Reject-Packet "UNSAFE_ACTION" }

$jsonObject = $null
$start = $text.IndexOf("{")
$end = $text.LastIndexOf("}")
if ($start -ge 0 -and $end -gt $start) {
    try { $jsonObject = $text.Substring($start, $end - $start + 1) | ConvertFrom-Json } catch { $jsonObject = $null }
}

if ($jsonObject) {
    $packet = $jsonObject
} else {
    $id = if ($text -match '(?im)^\s*id\s*[:=]\s*([A-Z0-9_ -]+)\s*$') { $Matches[1].Trim() } else { "LOCAL_FALLBACK_MICRO_MISSION" }
    $objective = if ($text -match '(?im)^\s*objective\s*[:=]\s*(.+)$') { $Matches[1].Trim() } else { $text.Trim() }
    $packet = [pscustomobject]@{
        source = $Source
        packet_type = $PacketType
        confidence = "medium"
        recommended_action = $objective
        do_not_do = @("do_not_use_live_web_as_required_dependency")
        candidate_mission = [pscustomobject]@{
            id = $id
            objective = $objective
            expected_value = "medium"
            risk = "low"
            allowed_paths = @("docs/autopilot/**", "docs/design/**", "ops/autopilot/**")
            forbidden_paths = @("backend/**", "frontend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
            success_criteria = @("bounded_diff", "tests_pass", "no_user_intervention")
        }
        evidence_used = @()
        open_risks = @()
        token_saving_notes = @("Normalized free text into a short packet.")
    }
}

$candidate = $packet.candidate_mission
if (-not $candidate) { Reject-Packet "MISSING_CANDIDATE_MISSION" }
if ([string]::IsNullOrWhiteSpace([string]$packet.recommended_action)) { Reject-Packet "MISSING_RECOMMENDED_ACTION" }
if ([string]::IsNullOrWhiteSpace([string]$candidate.id) -or [string]::IsNullOrWhiteSpace([string]$candidate.objective)) { Reject-Packet "MISSING_CANDIDATE_FIELDS" }
$allowed = @($candidate.allowed_paths | ForEach-Object { [string]$_ })
if ($allowed.Count -eq 0) { Reject-Packet "MISSING_ALLOWED_PATHS" }
if (($allowed -join " ") -match 'backend/\*\*|frontend/\*\*|ops/autopilot/local/\*\*|ops/autopilot/runtime/\*\*|package(-lock)?\.json') {
    Reject-Packet "FORBIDDEN_ALLOWED_PATH"
}

$normalized = [ordered]@{
    schema_version = "neurorelay_decision_packet_result_v1"
    status = "DECISION_PACKET_VALID"
    source = if ([string]::IsNullOrWhiteSpace([string]$packet.source)) { $Source } else { [string]$packet.source }
    packet_type = if ([string]::IsNullOrWhiteSpace([string]$packet.packet_type)) { $PacketType } else { [string]$packet.packet_type }
    confidence = if ([string]$packet.confidence -in @("low", "medium", "high")) { [string]$packet.confidence } else { "medium" }
    recommended_action = [string]$packet.recommended_action
    do_not_do = @($packet.do_not_do | ForEach-Object { [string]$_ })
    candidate_mission = [ordered]@{
        id = [string]$candidate.id
        objective = [string]$candidate.objective
        expected_value = if ([string]$candidate.expected_value -in @("low", "medium", "high")) { [string]$candidate.expected_value } else { "medium" }
        risk = if ([string]$candidate.risk -in @("low", "medium", "high")) { [string]$candidate.risk } else { "low" }
        allowed_paths = @($candidate.allowed_paths | ForEach-Object { [string]$_ })
        forbidden_paths = @($candidate.forbidden_paths | ForEach-Object { [string]$_ })
        success_criteria = @($candidate.success_criteria | ForEach-Object { [string]$_ })
    }
    evidence_used = @($packet.evidence_used | ForEach-Object { [string]$_ })
    open_risks = @($packet.open_risks | ForEach-Object { [string]$_ })
    token_saving_notes = @($packet.token_saving_notes | ForEach-Object { [string]$_ })
    no_user_intervention = $true
    private_urls_redacted = $true
}

Write-JsonFile -Path $OutPath -Payload $normalized
$normalized | ConvertTo-Json -Depth 30
exit 0
