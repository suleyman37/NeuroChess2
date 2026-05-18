param(
    [Parameter(Mandatory = $true)][string]$RawPath,
    [ValidateSet("gemini", "chatgpt", "auto")]
    [string]$JudgeType = "auto",
    [string]$OutPath = "",
    [string]$ReportPath = "",
    [string]$ValidationOutPath = ""
)

$ErrorActionPreference = "Stop"

function Write-Json {
    param([string]$Path, $Payload)
    $Payload | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Test-HasProperty {
    param($Object, [string]$Name)
    return ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name)
}

function Get-JsonObjectTexts {
    param([string]$Text)
    $objects = [System.Collections.Generic.List[string]]::new()

    function Add-BalancedObjectFromSource {
        param([string]$Source, [int]$Start)
        if ($Start -lt 0) { return }
        $depth = 0
        $inString = $false
        $escape = $false
        for ($i = $Start; $i -lt $Source.Length; $i++) {
            $ch = $Source[$i]
            if ($escape) {
                $escape = $false
                continue
            }
            if ($ch -eq "\") {
                $escape = $true
                continue
            }
            if ($ch -eq '"') {
                $inString = -not $inString
                continue
            }
            if ($inString) { continue }
            if ($ch -eq "{") { $depth++ }
            if ($ch -eq "}") {
                $depth--
                if ($depth -eq 0) {
                    $objects.Add($Source.Substring($Start, $i - $Start + 1).Trim()) | Out-Null
                    return
                }
            }
        }
    }

    function Add-BalancedObjectFromStart {
        param([int]$Start)
        Add-BalancedObjectFromSource -Source $Text -Start $Start
    }

    $responseMarkers = @(
        "Gemini a dit",
        "Gemini said",
        "ChatGPT a dit",
        "ChatGPT said",
        "Assistant a dit",
        "Assistant said"
    )
    foreach ($marker in $responseMarkers) {
        $markerIndex = $Text.LastIndexOf($marker, [System.StringComparison]::OrdinalIgnoreCase)
        if ($markerIndex -ge 0) {
            $afterMarker = $Text.Substring($markerIndex + $marker.Length)
            $responseStart = $afterMarker.IndexOf("{")
            if ($responseStart -ge 0) {
                $responseTail = $afterMarker.Substring($responseStart)
                $sentinelMatch = [regex]::Match(
                    $responseTail,
                    '}\s*(?:Outils|Tools|ProGemini|Gemini est|ChatGPT|$)',
                    [System.Text.RegularExpressions.RegexOptions]::Singleline
                )
                if ($sentinelMatch.Success) {
                    $objects.Add($responseTail.Substring(0, $sentinelMatch.Index + 1).Trim()) | Out-Null
                } else {
                    Add-BalancedObjectFromSource -Source $afterMarker -Start $responseStart
                }
            }
        }
    }

    $schemaMatches = [regex]::Matches($Text, '"schema"\s*:\s*"NC_GEMINI_AUDIT_JSON/1"')
    for ($schemaIndex = $schemaMatches.Count - 1; $schemaIndex -ge 0; $schemaIndex--) {
        $match = $schemaMatches[$schemaIndex]
        Add-BalancedObjectFromStart -Start ($Text.LastIndexOf("{", $match.Index))
    }

    $fenceMatches = [regex]::Matches($Text, '```(?:json)?\s*(\{[\s\S]*?\})\s*```', [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
    foreach ($match in $fenceMatches) {
        $objects.Add($match.Groups[1].Value.Trim()) | Out-Null
    }

    $start = $Text.IndexOf("{")
    while ($start -ge 0) {
        $depth = 0
        $inString = $false
        $escape = $false
        for ($i = $start; $i -lt $Text.Length; $i++) {
            $ch = $Text[$i]
            if ($escape) {
                $escape = $false
                continue
            }
            if ($ch -eq "\") {
                $escape = $true
                continue
            }
            if ($ch -eq '"') {
                $inString = -not $inString
                continue
            }
            if ($inString) { continue }
            if ($ch -eq "{") { $depth++ }
            if ($ch -eq "}") {
                $depth--
                if ($depth -eq 0) {
                    $objects.Add($Text.Substring($start, $i - $start + 1).Trim()) | Out-Null
                    break
                }
            }
        }
        $start = $Text.IndexOf("{", $start + 1)
    }

    return @($objects | Select-Object -Unique)
}

function Repair-JsonTextForParsing {
    param([string]$Text)
    return [regex]::Replace($Text, '("evidence_path"\s*:\s*")([^"]*)(")', {
        param($Match)
        $value = $Match.Groups[2].Value.Replace('\', '\\')
        return $Match.Groups[1].Value + $value + $Match.Groups[3].Value
    })
}

function Get-CandidatePayload {
    param($Json, [string]$ExpectedJudge)

    if ($ExpectedJudge -eq "gemini") {
        if (Test-HasProperty $Json "visual_judge_output") { return $Json.visual_judge_output }
        if (Test-HasProperty $Json "judge_output") { return $Json.judge_output }
        if (Test-HasProperty $Json "gemini_visual_observation") { return $Json.gemini_visual_observation }
        if (Test-HasProperty $Json "gemini_visual_verdict" -or Test-HasProperty $Json "verdict") { return $Json }
    }

    if ($ExpectedJudge -eq "chatgpt") {
        if (Test-HasProperty $Json "visual_judge_output") { return $Json.visual_judge_output }
        if (Test-HasProperty $Json "judge_output") { return $Json.judge_output }
        if (Test-HasProperty $Json "chatgpt_art_direction_review") { return $Json.chatgpt_art_direction_review }
        if (Test-HasProperty $Json "chatgpt_art_direction_verdict" -or Test-HasProperty $Json "product_direction_verdict") { return $Json }
    }

    if ($ExpectedJudge -eq "auto") {
        if (Test-HasProperty $Json "visual_judge_output") { return $Json.visual_judge_output }
        if (Test-HasProperty $Json "judge_output") { return $Json.judge_output }
        if (Test-HasProperty $Json "gemini_visual_verdict" -or Test-HasProperty $Json "chatgpt_art_direction_verdict") { return $Json }
    }

    return $null
}

if (-not (Test-Path -LiteralPath $RawPath -PathType Leaf)) {
    throw "RawPath not found: $RawPath"
}

if ([string]::IsNullOrWhiteSpace($OutPath)) {
    $OutPath = Join-Path ([System.IO.Path]::GetTempPath()) ("visual_judge_normalized_" + [System.Guid]::NewGuid().ToString("N") + ".json")
}
if ([string]::IsNullOrWhiteSpace($ReportPath)) {
    $ReportPath = Join-Path ([System.IO.Path]::GetTempPath()) ("visual_judge_normalization_report_" + [System.Guid]::NewGuid().ToString("N") + ".json")
}

$raw = Get-Content -LiteralPath $RawPath -Raw
$attempts = [System.Collections.Generic.List[object]]::new()
$selected = $null
$selectedSource = ""

foreach ($candidateText in @(Get-JsonObjectTexts -Text $raw)) {
    $parseText = Repair-JsonTextForParsing -Text $candidateText
    try {
        $json = $parseText | ConvertFrom-Json
    } catch {
        $attempts.Add([ordered]@{
            parse = "INVALID_JSON"
            error = if ($_.Exception.Message.Length -gt 240) { $_.Exception.Message.Substring(0, 240) + "..." } else { $_.Exception.Message }
        }) | Out-Null
        continue
    }

    $payload = Get-CandidatePayload -Json $json -ExpectedJudge $JudgeType
    if ($null -ne $payload) {
        $selected = $payload
        $selectedSource = if ((Test-HasProperty $json "schema") -and [string]$json.schema -eq "NC_GEMINI_AUDIT_JSON/1") {
            "outer_nc_gemini_audit_json_visual_judge_output"
        } else {
            "direct_or_nested_judge_json"
        }
        break
    }

    $attempts.Add([ordered]@{
        parse = "JSON_BUT_NOT_JUDGE_OUTPUT"
        properties = @($json.PSObject.Properties.Name)
    }) | Out-Null
}

$normalized = $false
if ($null -ne $selected) {
    New-Item -ItemType Directory -Force -Path (Split-Path -Parent $OutPath) | Out-Null
    $selected | ConvertTo-Json -Depth 40 | Set-Content -LiteralPath $OutPath -Encoding UTF8
    $normalized = $true
}

$validation = $null
if ($normalized -and -not [string]::IsNullOrWhiteSpace($ValidationOutPath)) {
    & (Join-Path $PSScriptRoot "validate_visual_judge_output.ps1") -InputPath $OutPath -JudgeType $JudgeType -OutPath $ValidationOutPath | Out-Null
    $validation = Get-Content -LiteralPath $ValidationOutPath -Raw | ConvertFrom-Json
}

$report = [ordered]@{
    schema_version = "A20U_visual_judge_normalization_report_v1"
    raw_path = $RawPath
    judge_type = $JudgeType
    normalization_result = if ($normalized) { "NORMALIZED_JSON_WRITTEN" } else { "NO_VALID_JUDGE_JSON_FOUND" }
    normalized_output_path = if ($normalized) { $OutPath } else { $null }
    selected_source = $selectedSource
    extraction_attempts = @($attempts)
    validation = $validation
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
    fixtures_used_as_real_outputs = $false
}

Write-Json $ReportPath $report
$report | ConvertTo-Json -Depth 40

if ($normalized) { exit 0 }
exit 2
