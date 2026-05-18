param(
    [string]$ServiceName = "ChatGPT",
    [string]$MissionId = "UNKNOWN_MISSION",
    [string]$Reason = "Human verification required",
    [string]$BrowserProfile = "redacted",
    [string]$PageUrl = "",
    [string]$ArtifactPath = "",
    [string]$PauseStatePath = "",
    [string]$SubjectPrefix = "[NeuroChess]",
    [string]$ResultPath = "",
    [string]$LocalConfigPath = "",
    [string]$EmailSecretPath = "",
    [switch]$UseStoredSecret,
    [switch]$SaveSecretLocal,
    [switch]$DryRun,
    [switch]$MockSmtpSuccess,
    [switch]$NoPasswordPrompt,
    [string]$BodyOverride = ""
)

$ErrorActionPreference = "Stop"

function Write-Json {
    param([string]$Path, $Payload)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $Payload | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Redact-Email {
    param([string]$Email)
    if ([string]::IsNullOrWhiteSpace($Email)) { return "" }
    $parts = $Email.Split("@")
    if ($parts.Count -ne 2) { return "[redacted]" }
    $name = $parts[0]
    $domain = $parts[1]
    $head = if ($name.Length -gt 0) { $name.Substring(0, 1) } else { "*" }
    return "$head***@$domain"
}

function Get-ConfigValue {
    param($Config, [string]$EnvName, [string]$ConfigName, [string]$DefaultValue = "")
    $envValue = [Environment]::GetEnvironmentVariable($EnvName)
    if (-not [string]::IsNullOrWhiteSpace($envValue)) { return $envValue }
    if ($Config -and $Config.PSObject.Properties.Name -contains $ConfigName) {
        return [string]$Config.$ConfigName
    }
    return $DefaultValue
}

if ([string]::IsNullOrWhiteSpace($LocalConfigPath)) {
    $LocalConfigPath = Join-Path $PSScriptRoot "local\email_alert.local.json"
}
if ([string]::IsNullOrWhiteSpace($ResultPath)) {
    $ResultPath = Join-Path ([System.IO.Path]::GetTempPath()) ("neurochess_email_alert_" + [guid]::NewGuid().ToString("N") + ".json")
}

$setupScript = Join-Path $PSScriptRoot "setup_email_alert_env.ps1"
if (Test-Path -LiteralPath $setupScript -PathType Leaf) {
    $setupParams = @{
        UseStoredSecret = $true
        NoPrompt = $true
    }
    if (-not [string]::IsNullOrWhiteSpace($EmailSecretPath)) {
        $setupParams.SecretPath = $EmailSecretPath
    }
    if ($SaveSecretLocal) {
        $setupParams.SaveSecretLocal = $true
    }
    try {
        & $setupScript @setupParams | Out-Null
    } catch {
        # The direct email path below will still report missing SMTP config.
    }
}

$localConfig = $null
if (Test-Path -LiteralPath $LocalConfigPath -PathType Leaf) {
    $localConfig = Get-Content -LiteralPath $LocalConfigPath -Raw | ConvertFrom-Json
}

$defaults = [ordered]@{
    to = "suley37550@gmail.com"
    from = "suley37550@gmail.com"
    smtp_host = "smtp.gmail.com"
    smtp_port = "587"
    smtp_user = "suley37550@gmail.com"
    smtp_use_ssl = "true"
}

$settings = [ordered]@{
    to = Get-ConfigValue -Config $localConfig -EnvName "NC_ALERT_EMAIL_TO" -ConfigName "to" -DefaultValue $defaults.to
    from = Get-ConfigValue -Config $localConfig -EnvName "NC_ALERT_EMAIL_FROM" -ConfigName "from" -DefaultValue $defaults.from
    smtp_host = Get-ConfigValue -Config $localConfig -EnvName "NC_ALERT_SMTP_HOST" -ConfigName "smtp_host" -DefaultValue $defaults.smtp_host
    smtp_port = Get-ConfigValue -Config $localConfig -EnvName "NC_ALERT_SMTP_PORT" -ConfigName "smtp_port" -DefaultValue $defaults.smtp_port
    smtp_user = Get-ConfigValue -Config $localConfig -EnvName "NC_ALERT_SMTP_USER" -ConfigName "smtp_user" -DefaultValue $defaults.smtp_user
    smtp_password = Get-ConfigValue -Config $localConfig -EnvName "NC_ALERT_SMTP_PASSWORD" -ConfigName "smtp_password"
    smtp_use_ssl = Get-ConfigValue -Config $localConfig -EnvName "NC_ALERT_SMTP_USE_SSL" -ConfigName "smtp_use_ssl" -DefaultValue $defaults.smtp_use_ssl
}

$missing = @()
foreach ($key in @("to", "from", "smtp_host", "smtp_port", "smtp_user", "smtp_use_ssl")) {
    if ([string]::IsNullOrWhiteSpace([string]$settings[$key])) { $missing += $key }
}

$securePassword = $null
if (-not [string]::IsNullOrWhiteSpace([string]$settings.smtp_password)) {
    $securePassword = ConvertTo-SecureString -String ([string]$settings.smtp_password) -AsPlainText -Force
} elseif (-not $DryRun -and -not $MockSmtpSuccess -and -not $NoPasswordPrompt) {
    $securePassword = Read-Host "Enter Gmail app password for NeuroChess email alerts" -AsSecureString
}
$securePasswordProvided = ($null -ne $securePassword -and $securePassword.Length -gt 0)
if (-not $securePasswordProvided) { $missing += "smtp_password" }

$timestamp = (Get-Date).ToString("o")
$subject = "$SubjectPrefix Human verification required - $ServiceName automation paused"
if ($MissionId -match "TEST") {
    $subject = "$SubjectPrefix Test email alert - human verification gate"
}

$safePageUrl = if ([string]::IsNullOrWhiteSpace($PageUrl)) { "not provided" } else { "provided by caller; redacted in logs" }
$body = if (-not [string]::IsNullOrWhiteSpace($BodyOverride)) {
    $BodyOverride
} else {
@"
NeuroChess automation paused because human verification is required.

Mission id: $MissionId
Service: $ServiceName
Reason: $Reason
Detected at: $timestamp

What you must do:
1. Complete the verification manually in the open Chrome window.
2. Do not close Chrome.
3. Do not share credentials with automation.
4. After verification, rerun the resume check command from the pause-state file.

Pause-state file:
$PauseStatePath

Artifact/log folder:
$ArtifactPath

Browser profile:
$BrowserProfile

Page URL:
$safePageUrl

Timeout policy:
The gate remains in WAITING_FOR_HUMAN_VERIFICATION until manual action clears the verification, the session closes, or the configured timeout expires.

Safety:
Codex did not click verification, did not solve CAPTCHA, did not automate 2FA, and did not bypass consent or human verification.
"@
}

$baseResult = [ordered]@{
    schema_version = "A20AA_human_verification_email_alert_result_v1"
    service = $ServiceName
    mission_id = $MissionId
    reason = $Reason
    timestamp = $timestamp
    result_path = $ResultPath
    local_config_present = (Test-Path -LiteralPath $LocalConfigPath -PathType Leaf)
    local_config_path_redacted = $true
    email_to_redacted = Redact-Email ([string]$settings.to)
    email_from_redacted = Redact-Email ([string]$settings.from)
    smtp_host_configured = -not [string]::IsNullOrWhiteSpace([string]$settings.smtp_host)
    smtp_port_configured = -not [string]::IsNullOrWhiteSpace([string]$settings.smtp_port)
    smtp_user_configured = -not [string]::IsNullOrWhiteSpace([string]$settings.smtp_user)
    smtp_password_configured = -not [string]::IsNullOrWhiteSpace([string]$settings.smtp_password)
    smtp_password_prompted_securely = ($securePasswordProvided -and [string]::IsNullOrWhiteSpace([string]$settings.smtp_password))
    smtp_use_ssl_configured = -not [string]::IsNullOrWhiteSpace([string]$settings.smtp_use_ssl)
    default_gmail_settings_applied = $true
    missing_config_keys = $missing
    dry_run = [bool]$DryRun
    mock_smtp = [bool]$MockSmtpSuccess
    secrets_redacted = $true
    smtp_password_printed = $false
}

if ($DryRun) {
    $payloadPath = Join-Path (Split-Path -Parent $ResultPath) "human_verification_email_dry_run_payload.json"
    $payload = [ordered]@{
        subject = $subject
        body = $body
        to_redacted = $baseResult.email_to_redacted
        from_redacted = $baseResult.email_from_redacted
        secrets_redacted = $true
    }
    Write-Json -Path $payloadPath -Payload $payload
    $baseResult.status = "EMAIL_ALERT_DRY_RUN"
    $baseResult.dry_run_payload_path = $payloadPath
    Write-Json -Path $ResultPath -Payload $baseResult
    $baseResult | ConvertTo-Json -Depth 20
    exit 0
}

if ($missing.Count -gt 0) {
    $baseResult.status = "EMAIL_ALERT_NOT_CONFIGURED"
    Write-Json -Path $ResultPath -Payload $baseResult
    $baseResult | ConvertTo-Json -Depth 20
    exit 10
}

if ($MockSmtpSuccess) {
    $baseResult.status = "EMAIL_ALERT_SENT"
    $baseResult.mock_delivery = $true
    Write-Json -Path $ResultPath -Payload $baseResult
    $baseResult | ConvertTo-Json -Depth 20
    exit 0
}

try {
    $port = [int]$settings.smtp_port
    $enableSsl = ([string]$settings.smtp_use_ssl).ToLowerInvariant() -in @("true", "1", "yes", "ssl")
    $message = New-Object System.Net.Mail.MailMessage
    $message.From = [System.Net.Mail.MailAddress]::new([string]$settings.from)
    $message.To.Add([string]$settings.to)
    $message.Subject = $subject
    $message.Body = $body
    $message.IsBodyHtml = $false

    $client = New-Object System.Net.Mail.SmtpClient([string]$settings.smtp_host, $port)
    $client.EnableSsl = $enableSsl
    $client.Credentials = [System.Net.NetworkCredential]::new([string]$settings.smtp_user, $securePassword)
    $client.Send($message)
    $message.Dispose()
    $client.Dispose()

    $baseResult.status = "EMAIL_ALERT_SENT"
    Write-Json -Path $ResultPath -Payload $baseResult
    $baseResult | ConvertTo-Json -Depth 20
    exit 0
} catch {
    $baseResult.status = "EMAIL_ALERT_SEND_FAILED"
    $baseResult.error_redacted = $_.Exception.Message
    Write-Json -Path $ResultPath -Payload $baseResult
    $baseResult | ConvertTo-Json -Depth 20
    exit 11
}
