param(
    [string]$MissionId = "A20AI_EMAIL_PREFLIGHT",
    [string]$ResultPath = "",
    [string]$ArtifactPath = "",
    [string]$SecretPath = "",
    [switch]$DryRun,
    [switch]$NoPrompt
)

$ErrorActionPreference = "Stop"

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if (-not [string]::IsNullOrWhiteSpace($Path)) {
        $dir = Split-Path -Parent $Path
        if (-not [string]::IsNullOrWhiteSpace($dir)) {
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
        }
        $Payload | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $Path -Encoding UTF8
    }
}

function Emit {
    param([object]$Payload, [int]$ExitCode = 0)
    Write-JsonFile -Path $ResultPath -Payload $Payload
    $Payload | ConvertTo-Json -Depth 30
    exit $ExitCode
}

function Convert-JsonOutput {
    param([object[]]$Output)
    $text = ($Output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { throw "Script did not emit JSON: $text" }
    $text.Substring($start) | ConvertFrom-Json
}

if ([string]::IsNullOrWhiteSpace($ArtifactPath)) {
    $ArtifactPath = Join-Path $env:USERPROFILE "Documents\Dev\NeuroChess_QA_Artifacts\autopilot\web_judge_orchestrator\A20AI_email_secret_cache_finalization_20260518"
}
if ([string]::IsNullOrWhiteSpace($ResultPath)) {
    $ResultPath = Join-Path $ArtifactPath "email_preflight_result.json"
}
if ([string]::IsNullOrWhiteSpace($SecretPath)) {
    $SecretPath = Join-Path $PSScriptRoot "local\email_alert.secret.dpapi.json"
}
New-Item -ItemType Directory -Force -Path $ArtifactPath | Out-Null

$cacheExistedBefore = Test-Path -LiteralPath $SecretPath -PathType Leaf
$envSecretPresentBefore = -not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("NC_ALERT_SMTP_PASSWORD", "Process"))

$setupArgs = @(
    "-UseStoredSecret",
    "-SaveSecretLocal",
    "-SecretPath", $SecretPath,
    "-ResultPath", (Join-Path $ArtifactPath "secret_cache_status.json")
)
if ($NoPrompt) { $setupArgs += "-NoPrompt" }
$setupOutput = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "setup_email_alert_env.ps1") @setupArgs 2>&1
$setupExit = $LASTEXITCODE
$setup = Convert-JsonOutput -Output $setupOutput

$base = [ordered]@{
    schema_version = "neurochess_email_alert_preflight_result_v1"
    mission_id = $MissionId
    artifact_path = $ArtifactPath
    secret_path_redacted = $true
    cache_existed_before = $cacheExistedBefore
    env_secret_present_before = $envSecretPresentBefore
    setup_status = [string]$setup.status
    setup_exit_code = $setupExit
    defaults_applied = [bool]$setup.defaults_applied
    recipient = [string]$setup.recipient
    sender = [string]$setup.sender
    smtp_host = [string]$setup.smtp_host
    smtp_port = [string]$setup.smtp_port
    smtp_user = [string]$setup.smtp_user
    smtp_use_ssl = [string]$setup.smtp_use_ssl
    user_prompted = [bool]$setup.password_prompted_securely
    prompt_count = if ([bool]$setup.password_prompted_securely) { 1 } else { 0 }
    prompted_more_than_once = $false
    cache_created = (-not $cacheExistedBefore -and (Test-Path -LiteralPath $SecretPath -PathType Leaf))
    cache_used = [bool]$setup.secret_cache_used
    env_secret_imported = [bool]$setup.secret_imported_from_env
    smtp_password_printed = $false
    secrets_redacted = $true
    dry_run = [bool]$DryRun
}

if (($setupExit -ne 0 -or [string]$setup.status -eq "EMAIL_SECRET_CACHE_MISSING") -and $DryRun) {
    $base.status = "EMAIL_PREFLIGHT_READY"
    $base.email_sent = $false
    $base.email_test_skipped = "DRY_RUN_SECRET_MISSING"
    $base.secret_missing_in_dry_run = $true
    Emit -Payload $base -ExitCode 0
}

if ($setupExit -ne 0 -or [string]$setup.status -eq "EMAIL_SECRET_CACHE_MISSING") {
    $base.status = "EMAIL_SECRET_CACHE_MISSING"
    $base.email_sent = $false
    Emit -Payload $base -ExitCode 10
}

if ($DryRun) {
    $base.status = "EMAIL_PREFLIGHT_READY"
    $base.email_sent = $false
    $base.email_test_skipped = "DRY_RUN"
    Emit -Payload $base -ExitCode 0
}

$emailResultPath = Join-Path $ArtifactPath "email_preflight_send_result.json"
$emailOutput = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "send_human_verification_email_alert.ps1") `
    -ServiceName "NeuroChess" `
    -MissionId $MissionId `
    -Reason "Email preflight ready" `
    -BrowserProfile "not applicable" `
    -ArtifactPath $ArtifactPath `
    -PauseStatePath (Join-Path $ArtifactPath "email_preflight_pause_state_not_used.json") `
    -ResultPath $emailResultPath `
    -NoPasswordPrompt `
    -SubjectOverride "[NeuroChess] Email preflight ready" `
    -BodyOverride "This is a NeuroChess web judge orchestrator email preflight. The SMTP secret was loaded from environment or DPAPI cache and was not printed." 2>&1
$emailExit = $LASTEXITCODE
$emailResult = if (Test-Path -LiteralPath $emailResultPath -PathType Leaf) {
    Get-Content -LiteralPath $emailResultPath -Raw | ConvertFrom-Json
} else {
    $null
}

$base.email_exit_code = $emailExit
$base.email_status = if ($emailResult) { [string]$emailResult.status } else { "EMAIL_ALERT_SEND_FAILED" }
$base.email_sent = ($base.email_status -eq "EMAIL_ALERT_SENT")
$base.smtp_password_printed = $false

if ($base.email_sent) {
    $base.status = if ($base.cache_created) { "EMAIL_SECRET_CACHE_CREATED_AND_READY" } else { "EMAIL_PREFLIGHT_READY" }
    Emit -Payload $base -ExitCode 0
}

$base.status = if ($base.email_status -eq "EMAIL_ALERT_SEND_FAILED") { "EMAIL_ALERT_SEND_FAILED" } else { "EMAIL_PREFLIGHT_FAILED" }
Emit -Payload $base -ExitCode 11
