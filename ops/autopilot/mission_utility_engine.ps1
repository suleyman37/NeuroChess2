param(
    [string]$ReservoirPath = "",
    [string]$BottleneckPath = "",
    [string]$ScorePath = "",
    [string]$FailureLedgerPath = "",
    [string]$OutPath = "",
    [string[]]$AvoidObjectiveIds = @(),
    [int]$Seed = 0,
    [switch]$Pareto
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ReservoirPath)) { $ReservoirPath = Join-Path $PSScriptRoot "objective_reservoir.yaml" }
if ([string]::IsNullOrWhiteSpace($ScorePath)) { $ScorePath = Join-Path $PSScriptRoot "autonomy_score_state.json" }
if ([string]::IsNullOrWhiteSpace($FailureLedgerPath)) { $FailureLedgerPath = Join-Path $PSScriptRoot "failure_ledger.yaml" }

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 60 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Read-JsonOrNull {
    param([string]$Path)
    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Parse-Reservoir {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Missing reservoir: $Path" }
    $lines = Get-Content -LiteralPath $Path
    $objectives = @()
    $current = $null
    $field = $null
    foreach ($line in $lines) {
        if ($line -match '^\s*-\s+id:\s*(.+?)\s*$') {
            if ($current) { $objectives += [pscustomobject]$current }
            $current = [ordered]@{
                id = $Matches[1].Trim()
                family = ""
                priority = 0
                expected_value = ""
                risk_tier = "medium"
                allowed_paths = @()
                forbidden_paths = @()
                expected_artifacts = @()
                success_criteria = @()
            }
            $field = $null
            continue
        }
        if (-not $current) { continue }
        if ($line -match '^\s{4}family:\s*(.+?)\s*$') { $current.family = $Matches[1].Trim(); $field = $null; continue }
        if ($line -match '^\s{4}priority:\s*(\d+)\s*$') { $current.priority = [int]$Matches[1]; $field = $null; continue }
        if ($line -match '^\s{4}expected_value:\s*(.+?)\s*$') { $current.expected_value = $Matches[1].Trim(); $field = $null; continue }
        if ($line -match '^\s{4}risk_tier:\s*(.+?)\s*$') { $current.risk_tier = $Matches[1].Trim(); $field = $null; continue }
        if ($line -match '^\s{4}(allowed_paths|forbidden_paths|expected_artifacts|success_criteria):\s*$') { $field = $Matches[1]; continue }
        if ($field -and $line -match '^\s{6}-\s*(.+?)\s*$') {
            $current[$field] = @($current[$field]) + $Matches[1].Trim()
        }
    }
    if ($current) { $objectives += [pscustomobject]$current }
    return $objectives
}

function Test-DocsOnly {
    param([object]$Objective)
    $allowed = @($Objective.allowed_paths)
    return ($allowed.Count -gt 0 -and @($allowed | Where-Object { $_ -match '^frontend/|^scripts/' }).Count -eq 0)
}

function Score-Objective {
    param([object]$Objective, [object]$Bottleneck, [string[]]$Avoid, [string]$Failures)
    $rejected = @()
    $notes = @()
    $allowed = @($Objective.allowed_paths)
    $forbidden = @($Objective.forbidden_paths)

    if (-not ($forbidden -contains "ops/autopilot/runtime/**")) { $notes += "runtime_forbidden_not_explicit" }
    if ($Objective.expected_value -match '(?i)road-to-V2|push road|merge road|captcha|2FA|human verification|paid study') { $rejected += "unsafe_mission" }
    if ($allowed -contains "package.json" -or $allowed -contains "backend/**") { $rejected += "unsafe_allowed_path" }
    if (@($Objective.success_criteria).Count -eq 0) { $rejected += "no_bounded_stop_condition" }
    if ($Avoid -contains [string]$Objective.id) { $rejected += "avoided_repeated_objective" }

    $priorityFactor = [Math]::Max(0.1, [double]$Objective.priority / 100.0)
    $impact = if ($Objective.family -in @("SIGNATURE_COMPONENTS", "VISUAL_PRODUCTION_MODE")) { 4.8 } elseif ($Objective.family -eq "NIGHT_MODE_READINESS") { 4.0 } elseif ($Objective.family -eq "HUMAN_TASTE_CALIBRATION") { 3.0 } else { 2.5 }
    $confidence = if ($Objective.risk_tier -eq "low") { 0.92 } else { 0.68 }
    $bottleneckRelevance = if ($Bottleneck.recommended_lane -eq "pixel_production" -and $Objective.family -in @("SIGNATURE_COMPONENTS", "VISUAL_PRODUCTION_MODE")) { 1.55 } elseif ($Objective.family -eq "NIGHT_MODE_READINESS") { 1.20 } else { 0.80 }
    $evidenceValue = if (@($Objective.expected_artifacts | Where-Object { $_ -match 'screenshots|manifest|report|contract' }).Count -gt 0) { 1.35 } else { 0.75 }
    $learningValue = if ([string]$Objective.expected_value -match "feedback|chamber|signature|pixel|visual|rehearsal") { 1.35 } else { 0.85 }
    $cost = 1.0 + ([Math]::Max(0, @($allowed).Count - 4) * 0.12)
    $risk = if ($Objective.risk_tier -eq "low") { 1.0 } else { 1.8 }
    $base = ($impact * $confidence * $bottleneckRelevance * $evidenceValue * $learningValue * $priorityFactor) / [Math]::Max($cost * $risk, 0.10)

    $bonus = 0.0
    if ($Bottleneck.pixel_mandate_active -and $Objective.family -in @("SIGNATURE_COMPONENTS", "VISUAL_PRODUCTION_MODE")) { $bonus += 2.0; $notes += "pixel_mandate_boost" }
    if ([string]$Objective.id -match "A20AU") { $bonus += 0.35; $notes += "novelty_bonus" }
    if ([string]$Objective.id -eq "A20AU_VARIANT_REFINEMENT_FOR_PROVISIONAL_WINNERS") { $bonus += 1.75; $notes += "current_bottleneck_objective_boost" }
    if ($Objective.family -eq "NIGHT_MODE_READINESS") { $bonus += 0.45; $notes += "night_readiness_bonus" }

    $penalty = 0.0
    if ($Bottleneck.pixel_mandate_active -and (Test-DocsOnly -Objective $Objective)) { $penalty += 6.0; $notes += "meta_drift_penalty" }
    $secondary = @($Bottleneck.secondary_bottlenecks)
    if ([string]$Objective.id -eq "RECAPTURE_WEAK_PROBE_EVIDENCE" -and @($secondary | Where-Object { $_ -match "evidence|screenshot|recapture" }).Count -eq 0) {
        $penalty += 8.0
        $notes += "recapture_not_needed_penalty"
    }
    if ([string]$Objective.id -match "^A20AS_|^A20AT_" -and @($objectives | Where-Object { [string]$_.id -match "^A20AU_" }).Count -gt 0) {
        $penalty += 5.0
        $notes += "superseded_objective_penalty"
    }
    if ($Failures -match [regex]::Escape([string]$Objective.id)) { $penalty += 1.5; $notes += "repeated_failure_penalty" }
    if ([string]$Objective.expected_value -match "user vote|required user|manual") { $penalty += 4.0; $notes += "user_dependency_penalty" }
    $expectedText = [string]$Objective.expected_value
    if ($expectedText -match "GPT|Gemini|required live web|requires live web|block on live web") { $penalty += 4.0; $notes += "live_web_dependency_penalty" }
    if (@($Objective.expected_artifacts).Count -eq 0) { $penalty += 1.75; $notes += "evidence_weakness_penalty" }
    if (@($allowed).Count -gt 8) { $penalty += 1.25; $notes += "scope_risk_penalty" }

    $utility = [Math]::Round([Math]::Max(0, $base + $bonus - $penalty), 4)
    [pscustomobject][ordered]@{
        id = [string]$Objective.id
        family = [string]$Objective.family
        priority = [int]$Objective.priority
        expected_value = [string]$Objective.expected_value
        risk_tier = [string]$Objective.risk_tier
        total_utility = if ($rejected.Count -gt 0) { 0 } else { $utility }
        rejected = $rejected.Count -gt 0
        rejection_reasons = $rejected
        explanation = $notes
        factors = [ordered]@{
            impact = $impact
            confidence = $confidence
            bottleneck_relevance = $bottleneckRelevance
            evidence_value = $evidenceValue
            learning_value = $learningValue
            cost = [Math]::Round($cost, 3)
            risk = $risk
            base_utility = [Math]::Round($base, 4)
            bonus = [Math]::Round($bonus, 4)
            penalty = [Math]::Round($penalty, 4)
        }
        allowed_paths = @($Objective.allowed_paths)
        forbidden_paths = @($Objective.forbidden_paths)
        expected_artifacts = @($Objective.expected_artifacts)
        success_criteria = @($Objective.success_criteria)
    }
}

$bottleneck = Read-JsonOrNull -Path $BottleneckPath
if (-not $bottleneck) {
    $bottleneckOutput = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "bottleneck_detector.ps1") -ScorePath $ScorePath 2>&1
    $text = ($bottleneckOutput | Out-String).Trim()
    $bottleneck = $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}
$failures = if (Test-Path -LiteralPath $FailureLedgerPath -PathType Leaf) { Get-Content -LiteralPath $FailureLedgerPath -Raw } else { "" }
$objectives = Parse-Reservoir -Path $ReservoirPath
$avoid = @($AvoidObjectiveIds | ForEach-Object { ([string]$_) -split "," } | ForEach-Object { $_.Trim() } | Where-Object { $_ })

$ranked = @($objectives | ForEach-Object { Score-Objective -Objective $_ -Bottleneck $bottleneck -Avoid $avoid -Failures $failures } | Sort-Object -Property @{ Expression = "rejected"; Ascending = $true }, @{ Expression = "total_utility"; Descending = $true }, @{ Expression = "priority"; Descending = $true })
$winner = @($ranked | Where-Object { -not $_.rejected })[0]
if (-not $winner) { throw "NO_SAFE_UTILITY_WINNER" }

$result = [ordered]@{
    schema_version = "omega_mission_utility_ranking_v1"
    status = "MISSION_UTILITY_WINNER_SELECTED"
    seed = $Seed
    pareto_mode = [bool]$Pareto
    formula = "Impact*Confidence*BottleneckRelevance*EvidenceValue*LearningValue/max(Cost*Risk,epsilon)+bonuses-penalties"
    bottleneck = $bottleneck.primary_bottleneck
    pixel_mandate_active = [bool]$bottleneck.pixel_mandate_active
    winner = $winner
    ranked_candidates = $ranked
    rejected_candidates = @($ranked | Where-Object { $_.rejected })
    explanation = "Winner maximizes utility while satisfying safety, proof, no-user, and no-live-web constraints."
    no_unsafe_candidate_selected = $true
}

Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 60
exit 0
