param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,
    [string]$OutPath = ""
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($OutPath)) {
    $OutPath = Join-Path (Split-Path -Parent $InputPath) "normalized_taste_results.json"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $Payload | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Get-PropertyValue {
    param([object]$Row, [string]$Name)
    if ($null -eq $Row) { return $null }
    $prop = $Row.PSObject.Properties[$Name]
    if ($null -eq $prop) { return $null }
    return $prop.Value
}

function Test-PiiField {
    param([string]$Name, [object]$Value)
    if ($Name -notmatch '^(email|name|full_name|ip|ip_address|phone|address)$') { return $false }
    $text = [string]$Value
    if ([string]::IsNullOrWhiteSpace($text)) { return $false }
    return ($text -notmatch '^\[?redacted\]?$')
}

if (-not (Test-Path -LiteralPath $InputPath -PathType Leaf)) {
    throw "Taste result input not found: $InputPath"
}

$ext = [System.IO.Path]::GetExtension($InputPath).ToLowerInvariant()
if ($ext -eq ".csv") {
    $rows = @(Import-Csv -LiteralPath $InputPath)
} elseif ($ext -eq ".json") {
    $json = Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json
    if ($json.PSObject.Properties["results"]) {
        $rows = @($json.results)
    } elseif ($json -is [System.Array]) {
        $rows = @($json)
    } else {
        $rows = @($json)
    }
} else {
    throw "Unsupported taste result format: $ext"
}

$required = @("participant_id", "provider", "study_id", "question_id", "signature_id", "variant_id", "response", "rating")
$accepted = @()
$rejected = @()
$seen = @{}

foreach ($row in $rows) {
    $reasons = @()
    foreach ($field in $required) {
        $value = Get-PropertyValue -Row $row -Name $field
        if ([string]::IsNullOrWhiteSpace([string]$value)) {
            $reasons += "missing_$field"
        }
    }

    foreach ($prop in @($row.PSObject.Properties)) {
        if (Test-PiiField -Name $prop.Name -Value $prop.Value) {
            $reasons += "pii_field_$($prop.Name)"
        }
    }

    $ratingValue = Get-PropertyValue -Row $row -Name "rating"
    $rating = 0.0
    if (-not [double]::TryParse([string]$ratingValue, [ref]$rating)) {
        $reasons += "rating_not_numeric"
    } elseif ($rating -lt 0 -or $rating -gt 5) {
        $reasons += "rating_out_of_range"
    }

    $key = "{0}|{1}|{2}|{3}" -f (Get-PropertyValue $row "participant_id"), (Get-PropertyValue $row "question_id"), (Get-PropertyValue $row "signature_id"), (Get-PropertyValue $row "variant_id")
    if ($seen.ContainsKey($key)) {
        $reasons += "duplicate_participant_question_variant"
    } else {
        $seen[$key] = $true
    }

    if ($reasons.Count -gt 0) {
        $rejected += [ordered]@{
            participant_id = [string](Get-PropertyValue $row "participant_id")
            question_id = [string](Get-PropertyValue $row "question_id")
            signature_id = [string](Get-PropertyValue $row "signature_id")
            variant_id = [string](Get-PropertyValue $row "variant_id")
            reasons = $reasons
        }
        continue
    }

    $accepted += [ordered]@{
        participant_id = [string](Get-PropertyValue $row "participant_id")
        provider = [string](Get-PropertyValue $row "provider")
        study_id = [string](Get-PropertyValue $row "study_id")
        question_id = [string](Get-PropertyValue $row "question_id")
        signature_id = [string](Get-PropertyValue $row "signature_id")
        variant_id = [string](Get-PropertyValue $row "variant_id")
        response = [string](Get-PropertyValue $row "response")
        rating = [double]$rating
        free_text = [string](Get-PropertyValue $row "free_text")
        timestamp = [string](Get-PropertyValue $row "timestamp")
    }
}

$result = [ordered]@{
    schema_version = "normalized_taste_results_v1"
    mission_id = "A20AT"
    status = if ($accepted.Count -gt 0) { "TASTE_RESULTS_IMPORTED" } else { "TASTE_RESULTS_REJECTED_OR_EMPTY" }
    input_path = $InputPath
    accepted_count = $accepted.Count
    rejected_count = $rejected.Count
    normalized_results = $accepted
    rejected_results = $rejected
    pii_committed = $false
    private_urls_committed = $false
}

Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 50
exit 0
