param(
    [string]$ResultsPath = "",
    [string]$OutPath = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($OutPath)) {
    $root = if ([string]::IsNullOrWhiteSpace($ResultsPath)) {
        Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\human_taste_network\A20AT_human_taste_network_20260518"
    } else {
        Split-Path -Parent $ResultsPath
    }
    $OutPath = Join-Path $root "taste_confidence_report.json"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $Payload | ConvertTo-Json -Depth 60 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Get-WilsonLowerBound {
    param([int]$Successes, [int]$Total, [double]$Z = 1.96)
    if ($Total -le 0) { return 0.0 }
    $p = $Successes / $Total
    $z2 = $Z * $Z
    $den = 1 + ($z2 / $Total)
    $centre = $p + ($z2 / (2 * $Total))
    $margin = $Z * [Math]::Sqrt((($p * (1 - $p)) + ($z2 / (4 * $Total))) / $Total)
    return [Math]::Max(0, (($centre - $margin) / $den))
}

function Test-PositiveResponse {
    param([object]$Row)
    $response = ([string]$Row.response).Trim().ToLowerInvariant()
    $rating = [double]$Row.rating
    return ($response -in @("yes", "mostly", "selected", "prefer", "preferred", "winner", "premium", "clear", "memorable", "serious", "useful") -or $rating -ge 4)
}

function Test-WeirdYes {
    param([object]$Row)
    $response = ([string]$Row.response).Trim().ToLowerInvariant()
    return ($response -eq "yes" -or $response -eq "weird" -or $response -eq "confusing" -or $response -eq "cheap")
}

function New-NoDataReport {
    [ordered]@{
        schema_version = "taste_confidence_report_v1"
        mission_id = "A20AT"
        status = "NO_DATA"
        overall_claim_status = "HUMAN_DATA_ABSENT"
        confidence_label = "NO_DATA"
        validation_level = "LEVEL_0_INTERNAL"
        crowd_validation_claim_allowed = $false
        no_95_percent_claim = $true
        confidence_method = "wilson_lower_bound"
        variants = @()
        notes = @("No imported owner or crowd taste results were provided. Packets are ready, but human approval is not claimed.")
    }
}

if ([string]::IsNullOrWhiteSpace($ResultsPath) -or -not (Test-Path -LiteralPath $ResultsPath -PathType Leaf)) {
    $report = New-NoDataReport
    Write-JsonFile -Path $OutPath -Payload $report
    $report | ConvertTo-Json -Depth 60
    exit 0
}

$input = Get-Content -LiteralPath $ResultsPath -Raw | ConvertFrom-Json
if ($input.PSObject.Properties["normalized_results"]) {
    $rows = @($input.normalized_results)
} elseif ($input.PSObject.Properties["results"]) {
    $rows = @($input.results)
} elseif ($input -is [System.Array]) {
    $rows = @($input)
} else {
    $rows = @()
}

if ($rows.Count -eq 0) {
    $report = New-NoDataReport
    Write-JsonFile -Path $OutPath -Payload $report
    $report | ConvertTo-Json -Depth 60
    exit 0
}

$crowdProviders = @("pickfu", "useberry", "lyssna", "maze")
$hasCrowdData = @($rows | Where-Object { $crowdProviders -contains ([string]$_.provider).ToLowerInvariant() }).Count -gt 0
$hasOwnerData = @($rows | Where-Object { ([string]$_.provider).ToLowerInvariant() -eq "local_manual" }).Count -gt 0

$variantReports = @()
foreach ($group in @($rows | Group-Object -Property signature_id, variant_id)) {
    $items = @($group.Group)
    $first = $items[0]
    $participants = @($items | ForEach-Object { [string]$_.participant_id } | Sort-Object -Unique)
    $n = $participants.Count

    $preferenceRows = @($items | Where-Object { ([string]$_.question_id) -match 'preference|owner_vote|local_vote|learning_value' })
    $preferenceSuccess = @($preferenceRows | Where-Object { Test-PositiveResponse $_ }).Count
    $preferenceTotal = $preferenceRows.Count

    $weirdRows = @($items | Where-Object { ([string]$_.question_id) -match 'weird|five_second' })
    $weirdYes = @($weirdRows | Where-Object { Test-WeirdYes $_ }).Count
    $weirdTotal = $weirdRows.Count

    $boardRows = @($items | Where-Object { ([string]$_.question_id) -match 'board|chess_training_clarity|main_action' })
    $boardSuccess = @($boardRows | Where-Object { Test-PositiveResponse $_ }).Count
    $boardTotal = $boardRows.Count

    $premiumRows = @($items | Where-Object { ([string]$_.question_id) -match 'premium|five_second' })
    $premiumSuccess = @($premiumRows | Where-Object { Test-PositiveResponse $_ }).Count
    $premiumTotal = $premiumRows.Count

    $learningRows = @($items | Where-Object { ([string]$_.question_id) -match 'learning|useful|next_action' })
    $learningSuccess = @($learningRows | Where-Object { Test-PositiveResponse $_ }).Count
    $learningTotal = $learningRows.Count

    $preferenceRate = if ($preferenceTotal -gt 0) { $preferenceSuccess / $preferenceTotal } else { 0 }
    $weirdnessRate = if ($weirdTotal -gt 0) { $weirdYes / $weirdTotal } else { 0 }
    $boardRate = if ($boardTotal -gt 0) { $boardSuccess / $boardTotal } else { 0 }
    $premiumRate = if ($premiumTotal -gt 0) { $premiumSuccess / $premiumTotal } else { 0 }
    $learningRate = if ($learningTotal -gt 0) { $learningSuccess / $learningTotal } else { 0 }
    $wilsonPreference = Get-WilsonLowerBound -Successes $preferenceSuccess -Total $preferenceTotal

    $label = "PROVISIONAL"
    $reasons = @()
    if ($n -lt 10) {
        $label = "INSUFFICIENT_SAMPLE"
        $reasons += "sample_size_below_10"
    } elseif ($weirdTotal -gt 0 -and $weirdnessRate -gt 0.15) {
        $label = "HUMAN_VALIDATION_FAILED"
        $reasons += "weirdness_rejection_above_threshold"
    } elseif ($boardTotal -gt 0 -and $boardRate -lt 0.80) {
        $label = "HUMAN_VALIDATION_FAILED"
        $reasons += "board_readability_below_threshold"
    } elseif (-not $hasCrowdData) {
        $label = "PROVISIONAL"
        $reasons += "no_level_2_crowd_data"
    } elseif ($n -ge 50 -and $wilsonPreference -ge 0.55) {
        $label = "STRONG_MAJORITY_SUPPORTED"
    } elseif ($n -ge 30 -and $wilsonPreference -ge 0.50) {
        $label = "MAJORITY_SUPPORTED"
    } else {
        $label = "PROVISIONAL"
        $reasons += "majority_support_not_conservative_enough"
    }

    $variantReports += [ordered]@{
        signature_id = [string]$first.signature_id
        variant_id = [string]$first.variant_id
        sample_size = $n
        preference_rate = [Math]::Round($preferenceRate, 4)
        preference_wilson_lower_bound = [Math]::Round($wilsonPreference, 4)
        weirdness_rejection_rate = [Math]::Round($weirdnessRate, 4)
        board_readability_rate = [Math]::Round($boardRate, 4)
        premium_perception_rate = [Math]::Round($premiumRate, 4)
        learning_value_rate = [Math]::Round($learningRate, 4)
        confidence_label = $label
        reasons = $reasons
        crowd_validation_claim_allowed = ($hasCrowdData -and ($label -in @("MAJORITY_SUPPORTED", "STRONG_MAJORITY_SUPPORTED")))
    }
}

$bestLabel = if (@($variantReports | Where-Object { $_.confidence_label -eq "HUMAN_VALIDATION_FAILED" }).Count -gt 0) {
    "HUMAN_VALIDATION_FAILED"
} elseif (@($variantReports | Where-Object { $_.confidence_label -eq "STRONG_MAJORITY_SUPPORTED" }).Count -gt 0) {
    "STRONG_MAJORITY_SUPPORTED"
} elseif (@($variantReports | Where-Object { $_.confidence_label -eq "MAJORITY_SUPPORTED" }).Count -gt 0) {
    "MAJORITY_SUPPORTED"
} elseif (@($variantReports | Where-Object { $_.confidence_label -eq "PROVISIONAL" }).Count -gt 0) {
    "PROVISIONAL"
} else {
    "INSUFFICIENT_SAMPLE"
}

$report = [ordered]@{
    schema_version = "taste_confidence_report_v1"
    mission_id = "A20AT"
    status = "TASTE_CONFIDENCE_COMPUTED"
    overall_claim_status = if ($hasCrowdData) { "CROWD_RESULTS_IMPORTED" } elseif ($hasOwnerData) { "OWNER_OR_LOCAL_RESULTS_IMPORTED" } else { "HUMAN_DATA_ABSENT" }
    confidence_label = $bestLabel
    validation_level = if ($hasCrowdData) { "LEVEL_2_CROWD" } elseif ($hasOwnerData) { "LEVEL_1_OWNER" } else { "LEVEL_0_INTERNAL" }
    crowd_validation_claim_allowed = [bool](@($variantReports | Where-Object { $_.crowd_validation_claim_allowed }).Count -gt 0)
    no_95_percent_claim = $true
    confidence_method = "wilson_lower_bound"
    sample_rules = [ordered]@{
        insufficient_sample_below = 10
        majority_min_sample = 30
        stronger_sample_target = 50
        weirdness_rejection_threshold = 0.15
        board_readability_threshold = 0.80
    }
    variants = $variantReports
}

Write-JsonFile -Path $OutPath -Payload $report
$report | ConvertTo-Json -Depth 60
exit 0
