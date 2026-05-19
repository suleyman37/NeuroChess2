param(
    [ValidateSet("Classify", "ResumeCheck")]
    [string]$Mode = "Classify",
    [ValidateSet("chatgpt", "gemini", "unknown")]
    [string]$Service = "chatgpt",
    [string]$MissionId = "A20BA",
    [string]$FixturePath = "",
    [string]$FixtureJson = "",
    [string]$Endpoint = "",
    [string]$ArtifactPath = "",
    [string]$OutPath = "",
    [switch]$NoPrompt,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Get-DefaultArtifactPath {
    Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\browser_state_truth\A20BA_composer_first_classifier_20260518"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $Payload | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Convert-JsonOutput {
    param([object[]]$Output)
    $text = ($Output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { throw "Classifier did not emit JSON: $text" }
    $text.Substring($start) | ConvertFrom-Json
}

if ([string]::IsNullOrWhiteSpace($ArtifactPath)) { $ArtifactPath = Get-DefaultArtifactPath }
New-Item -ItemType Directory -Force -Path $ArtifactPath | Out-Null

$classifierArgs = @(
    "-Mode", "Classify",
    "-Service", $Service,
    "-MissionId", $MissionId,
    "-ArtifactPath", $ArtifactPath
)
if (-not [string]::IsNullOrWhiteSpace($FixturePath)) { $classifierArgs += @("-FixturePath", $FixturePath) }
if (-not [string]::IsNullOrWhiteSpace($FixtureJson)) { $classifierArgs += @("-FixtureJson", $FixtureJson) }
if (-not [string]::IsNullOrWhiteSpace($Endpoint)) { $classifierArgs += @("-Endpoint", $Endpoint) }
if ($NoPrompt) { $classifierArgs += "-NoPrompt" }
if ($DryRun) { $classifierArgs += "-DryRun" }

$classifierOutput = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "classify_browser_state.ps1") @classifierArgs 2>&1
$browserState = Convert-JsonOutput -Output $classifierOutput

$resumeStatus = switch ([string]$browserState.classification) {
    "PAGE_USABLE" { "RESUME_READY" }
    "HUMAN_ACTION_REQUIRED" { "WAITING_FOR_HUMAN_ACTION" }
    "PAGE_LOADING" { "WAIT_AND_RECHECK" }
    default { "STOP_DIAGNOSTIC" }
}

$ntfyShouldSend = [string]$browserState.classification -eq "HUMAN_ACTION_REQUIRED" -and [bool]$browserState.foreground_blocker_detected

$payload = [ordered]@{
    schema_version = "web_judge_page_state_classifier_v1"
    mode = $Mode
    status = if ($Mode -eq "ResumeCheck") { $resumeStatus } else { [string]$browserState.classification }
    classification = [string]$browserState.classification
    confidence = [string]$browserState.confidence
    service = [string]$browserState.service
    composer_visible = [bool]$browserState.composer_visible
    composer_enabled = [bool]$browserState.composer_enabled
    send_available = [bool]$browserState.send_available
    foreground_blocker_detected = [bool]$browserState.foreground_blocker_detected
    history_text_ignored = [bool]$browserState.history_text_ignored
    screenshot_path = [string]$browserState.screenshot_path
    evidence = @($browserState.evidence)
    recommended_action = [string]$browserState.recommended_action
    ntfy_should_send = $ntfyShouldSend
    resume_ready = $resumeStatus -eq "RESUME_READY"
    private_urls_redacted = $true
    secrets_redacted = $true
    no_bypass = $true
    no_blind_typing = $true
}

$resultPath = if ([string]::IsNullOrWhiteSpace($OutPath)) {
    Join-Path $ArtifactPath "classifier_results\web_judge_page_state_result.json"
} else {
    $OutPath
}
Write-JsonFile -Path $resultPath -Payload $payload
$payload | ConvertTo-Json -Depth 80
