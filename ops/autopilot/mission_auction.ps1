param(
    [string[]]$DecisionPacketPaths = @(),
    [string]$DecisionPacketJson = "",
    [string]$BlockedLanes = "",
    [string]$OutPath = ""
)

$ErrorActionPreference = "Stop"

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Value-Score {
    param([string]$Value)
    switch ($Value) {
        "high" { 30 }
        "medium" { 20 }
        "low" { 10 }
        default { 10 }
    }
}

function Risk-Score {
    param([string]$Risk)
    switch ($Risk) {
        "low" { 20 }
        "medium" { 5 }
        "high" { -40 }
        default { 0 }
    }
}

$packets = @()
foreach ($path in $DecisionPacketPaths) {
    if (-not [string]::IsNullOrWhiteSpace($path) -and (Test-Path -LiteralPath $path -PathType Leaf)) {
        $packets += (Get-Content -LiteralPath $path -Raw | ConvertFrom-Json)
    }
}
if (-not [string]::IsNullOrWhiteSpace($DecisionPacketJson)) {
    $packets += ($DecisionPacketJson | ConvertFrom-Json)
}

$blocked = @($BlockedLanes -split "," | ForEach-Object { $_.Trim() } | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
$accepted = @()
$rejected = @()

foreach ($packet in $packets) {
    $candidate = $packet.candidate_mission
    if (-not $candidate -or [string]$packet.status -eq "INVALID_PACKET") {
        $rejected += [ordered]@{ source = [string]$packet.source; reason = "invalid_or_missing_candidate" }
        continue
    }
    $allowed = @($candidate.allowed_paths | ForEach-Object { [string]$_ })
    $unsafe = (($allowed -join " ") -match 'backend/\*\*|frontend/\*\*|ops/autopilot/local/\*\*|ops/autopilot/runtime/\*\*|package(-lock)?\.json') -or
        ([string]$packet.recommended_action -match '(?i)bypass|captcha|enter credentials|push road-to-v2|merge road-to-v2')
    if ($unsafe) {
        $rejected += [ordered]@{ source = [string]$packet.source; id = [string]$candidate.id; reason = "unsafe_candidate" }
        continue
    }

    $score = 0
    $score += Value-Score -Value ([string]$candidate.expected_value)
    $score += Risk-Score -Risk ([string]$candidate.risk)
    if ([string]$packet.confidence -eq "high") { $score += 10 }
    if ([string]$packet.source -eq "local_fallback") { $score += 5 }
    if ([string]$candidate.id -match 'VISUAL|SIGNATURE|PROBE|BOARD|CONSTITUTION') { $score += 30 }
    if ([string]$candidate.id -match 'SAFETY|REPAIR') { $score += 10 }
    if (($blocked -contains "live_gpt_web") -and [string]$packet.source -eq "chatgpt_web") { $score -= 35 }
    if (($blocked -contains "gemini") -and [string]$packet.source -eq "gemini") { $score -= 35 }
    if ([string]$candidate.objective -match '(?i)docs-only|documentation only') { $score -= 8 }
    if (([string]$packet.recommended_action).Length -lt 400) { $score += 8 }

    $accepted += [ordered]@{
        source = [string]$packet.source
        packet_type = [string]$packet.packet_type
        id = [string]$candidate.id
        score = $score
        rationale = "score combines safety, expected value, low risk, pixel mandate priority, and low Codex context"
        packet = $packet
    }
}

if ($accepted.Count -eq 0) {
    $result = [ordered]@{
        schema_version = "neurorelay_mission_auction_v1"
        status = "MISSION_AUCTION_NO_SAFE_CANDIDATE"
        accepted_candidates = @()
        rejected_candidates = @($rejected)
        no_user_intervention = $true
    }
    Write-JsonFile -Path $OutPath -Payload $result
    $result | ConvertTo-Json -Depth 40
    exit 5
}

$winner = @($accepted | Sort-Object -Property score -Descending)[0]
$result = [ordered]@{
    schema_version = "neurorelay_mission_auction_v1"
    status = "MISSION_AUCTION_WINNER_SELECTED"
    winner = [ordered]@{
        source = [string]$winner.source
        id = [string]$winner.id
        score = [int]$winner.score
        candidate_mission = $winner.packet.candidate_mission
        recommended_action = [string]$winner.packet.recommended_action
    }
    accepted_candidates = @($accepted | ForEach-Object { [ordered]@{ source = $_.source; id = $_.id; score = $_.score; rationale = $_.rationale } })
    rejected_candidates = @($rejected)
    blocked_lanes = @($blocked)
    pixel_production_boost_applied = $true
    fallback_works_with_zero_external_packets = @($packets | Where-Object { [string]$_.source -ne "local_fallback" }).Count -eq 0
    no_user_intervention = $true
}
Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 40
exit 0
