param(
    [ValidateSet("Inspect", "Select", "DryRun")]
    [string]$Mode = "Select",
    [string]$MissionId = "A20BC",
    [string]$PreferredModel = "Gemini 3.5 Flash",
    [string]$PreferredReasoningMode = "Extended",
    [string]$ModelLabelsJson = "",
    [string]$ModelLabelsPath = "",
    [string]$ArtifactPath = "",
    [string]$OutPath = "",
    [switch]$NoPrompt,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Get-DefaultArtifactPath {
    if ($MissionId -eq "A20BD") {
        return (Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\dual_browser_profiles\A20BD_dual_profile_playwright_control_20260518")
    }
    Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\gemini_web_lane\A20BC_gemini_3_5_flash_extended_lane_20260518"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $Payload | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Read-InputPayload {
    if (-not [string]::IsNullOrWhiteSpace($ModelLabelsJson)) {
        return ($ModelLabelsJson | ConvertFrom-Json)
    }
    if (-not [string]::IsNullOrWhiteSpace($ModelLabelsPath) -and (Test-Path -LiteralPath $ModelLabelsPath -PathType Leaf)) {
        return (Get-Content -LiteralPath $ModelLabelsPath -Raw | ConvertFrom-Json)
    }
    return [pscustomobject]@{
        model_selector_found = $false
        available_model_labels = @()
        reasoning_mode_labels = @()
    }
}

function Normalize-Label {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return "" }
    return (($Text.ToLowerInvariant() -replace '[^a-z0-9]+', ' ') -replace '\s+', ' ').Trim()
}

function Redact-Labels {
    param([object[]]$Labels)
    $safe = @()
    foreach ($label in @($Labels)) {
        $text = ([string]$label).Trim()
        if ([string]::IsNullOrWhiteSpace($text)) { continue }
        if ($text -match '(?i)cookie|token|password|secret|@|https?://') { continue }
        if ($text.Length -gt 120) { $text = $text.Substring(0, 120) }
        $safe += $text
    }
    return @($safe | Select-Object -Unique)
}

if ([string]::IsNullOrWhiteSpace($ArtifactPath)) { $ArtifactPath = Get-DefaultArtifactPath }
New-Item -ItemType Directory -Force -Path $ArtifactPath | Out-Null
if ([string]::IsNullOrWhiteSpace($OutPath)) { $OutPath = Join-Path $ArtifactPath "model_selector_result.json" }

$payload = Read-InputPayload
$modelLabels = Redact-Labels -Labels @($payload.available_model_labels)
$reasoningLabels = Redact-Labels -Labels @($payload.reasoning_mode_labels)
$selectorFound = [bool]($payload.model_selector_found)
if ($modelLabels.Count -gt 0) { $selectorFound = $true }

$preferredModelNorm = Normalize-Label -Text $PreferredModel
$preferredModeNorm = Normalize-Label -Text $PreferredReasoningMode
$modelMatch = $null
foreach ($label in $modelLabels) {
    $norm = Normalize-Label -Text $label
    if ($norm -eq $preferredModelNorm -or ($norm -match 'gemini' -and $norm -match '3\s*5' -and $norm -match 'flash')) {
        $modelMatch = $label
        break
    }
}

$modeMatch = $null
foreach ($label in $reasoningLabels + $modelLabels) {
    $norm = Normalize-Label -Text $label
    if ($norm -eq $preferredModeNorm -or $norm -match 'extended|thinking|deep think|deep reasoning|approfondie|raisonnement') {
        $modeMatch = $label
        break
    }
}

$closest = @($modelLabels | Where-Object {
        $norm = Normalize-Label -Text $_
        ($norm -match 'gemini' -and ($norm -match 'flash|\bpro\b|ultra|[0-9]')) -or
        (($norm -match 'flash|\bpro\b|ultra') -and $norm -match '[0-9]')
    } | Select-Object -First 1)
$selectedModel = if ($modelMatch) { [string]$modelMatch } elseif ($closest.Count -gt 0) { [string]$closest[0] } else { "" }
$selectedMode = if ($modeMatch) { [string]$modeMatch } else { "" }

if (-not $selectorFound) {
    $status = "GEMINI_MODEL_SELECTOR_NOT_FOUND"
} elseif ($modelMatch -and $modeMatch) {
    $status = "GEMINI_3_5_FLASH_EXTENDED_SELECTED"
} elseif ($modelMatch) {
    $status = "GEMINI_3_5_FLASH_SELECTED_NO_EXTENDED_MODE"
} else {
    $status = "GEMINI_3_5_FLASH_NOT_VISIBLE"
}

$result = [ordered]@{
    schema_version = "gemini_model_selection_result_v1"
    mission_id = $MissionId
    mode = $Mode
    status = $status
    model_selector_found = $selectorFound
    preferred_model = $PreferredModel
    preferred_reasoning_mode = $PreferredReasoningMode
    gemini_3_5_flash_visible = [bool]$modelMatch
    extended_thinking_mode_visible = [bool]$modeMatch
    selected_model = $selectedModel
    selected_reasoning_mode = $selectedMode
    exact_model_selected = [bool]$modelMatch
    exact_reasoning_mode_selected = [bool]$modeMatch
    visible_model_labels_redacted = @($modelLabels)
    visible_reasoning_labels_redacted = @($reasoningLabels)
    zero_cost_policy = $true
    no_api_call = $true
    no_paid_upgrade_attempted = $true
    private_urls_redacted = $true
    secrets_redacted = $true
}

Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 50
