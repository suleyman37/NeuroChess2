param(
    [switch]$UseStoredSecret,
    [switch]$SaveSecretLocal,
    [switch]$NoPrompt,
    [switch]$Status,
    [switch]$ClearStoredSecret,
    [string]$SecretPath = "",
    [string]$ResultPath = "",
    [string]$SecretTextForTest = ""
)

$ErrorActionPreference = "Stop"

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if (-not [string]::IsNullOrWhiteSpace($Path)) {
        $dir = Split-Path -Parent $Path
        if (-not [string]::IsNullOrWhiteSpace($dir)) {
            New-Item -ItemType Directory -Force -Path $dir | Out-Null
        }
        $Payload | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding UTF8
    }
}

function Write-Result {
    param([object]$Payload, [int]$ExitCode)
    Write-JsonFile -Path $ResultPath -Payload $Payload
    $Payload | ConvertTo-Json -Depth 20
    $script:NeuroChessEmailSetupExitCode = $ExitCode
}

function Get-DefaultSecretPath {
    Join-Path $PSScriptRoot "local\email_alert.secret.dpapi.json"
}

function Convert-SecureStringToPlainText {
    param([securestring]$Secure)
    $bstr = [System.IntPtr]::Zero
    try {
        $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
        [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    } finally {
        if ($bstr -ne [System.IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
        }
    }
}

function Load-StoredSecret {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    $envelope = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
    if ([string]::IsNullOrWhiteSpace([string]$envelope.ciphertext)) { return $null }
    ConvertTo-SecureString -String ([string]$envelope.ciphertext)
}

function Save-StoredSecret {
    param([string]$Path, [securestring]$Secret)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    [ordered]@{
        schema_version = "neurochess_email_alert_secret_dpapi_v1"
        encryption = "windows_dpapi_current_user"
        created_at = (Get-Date).ToString("o")
        secret_name = "NC_ALERT_SMTP_PASSWORD"
        ciphertext = ConvertFrom-SecureString -SecureString $Secret
        plaintext_stored = $false
        secrets_redacted = $true
    } | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Set-DefaultEnvIfMissing {
    param([string]$Name, [string]$Value)
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($Name, "Process"))) {
        [Environment]::SetEnvironmentVariable($Name, $Value, "Process")
    }
}

if ([string]::IsNullOrWhiteSpace($SecretPath)) {
    $SecretPath = Get-DefaultSecretPath
}

Set-DefaultEnvIfMissing -Name "NC_ALERT_EMAIL_TO" -Value "suley37550@gmail.com"
Set-DefaultEnvIfMissing -Name "NC_ALERT_EMAIL_FROM" -Value "suley37550@gmail.com"
Set-DefaultEnvIfMissing -Name "NC_ALERT_SMTP_HOST" -Value "smtp.gmail.com"
Set-DefaultEnvIfMissing -Name "NC_ALERT_SMTP_PORT" -Value "587"
Set-DefaultEnvIfMissing -Name "NC_ALERT_SMTP_USER" -Value "suley37550@gmail.com"
Set-DefaultEnvIfMissing -Name "NC_ALERT_SMTP_USE_SSL" -Value "true"

$base = [ordered]@{
    schema_version = "neurochess_email_alert_env_setup_result_v1"
    secret_path = $SecretPath
    secret_path_redacted = $true
    defaults_applied = $true
    recipient = [Environment]::GetEnvironmentVariable("NC_ALERT_EMAIL_TO", "Process")
    sender = [Environment]::GetEnvironmentVariable("NC_ALERT_EMAIL_FROM", "Process")
    smtp_host = [Environment]::GetEnvironmentVariable("NC_ALERT_SMTP_HOST", "Process")
    smtp_port = [Environment]::GetEnvironmentVariable("NC_ALERT_SMTP_PORT", "Process")
    smtp_user = [Environment]::GetEnvironmentVariable("NC_ALERT_SMTP_USER", "Process")
    smtp_use_ssl = [Environment]::GetEnvironmentVariable("NC_ALERT_SMTP_USE_SSL", "Process")
    secret_cache_exists = Test-Path -LiteralPath $SecretPath -PathType Leaf
    secret_cache_used = $false
    password_source = "none"
    password_prompted_securely = $false
    secret_saved_local = $false
    smtp_password_configured = $false
    plaintext_printed = $false
    plaintext_written = $false
    secrets_redacted = $true
}

if ($ClearStoredSecret) {
    if (Test-Path -LiteralPath $SecretPath -PathType Leaf) {
        Remove-Item -LiteralPath $SecretPath -Force
    }
    $base.status = "EMAIL_SECRET_CACHE_CLEARED"
    $base.secret_cache_exists = $false
    Write-Result -Payload $base -ExitCode 0
    return
}

if ($Status) {
    $base.status = if ($base.secret_cache_exists) { "EMAIL_SECRET_CACHE_PRESENT" } else { "EMAIL_SECRET_CACHE_MISSING" }
    $base.smtp_password_configured = -not [string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("NC_ALERT_SMTP_PASSWORD", "Process"))
    Write-Result -Payload $base -ExitCode 0
    return
}

$envPassword = [Environment]::GetEnvironmentVariable("NC_ALERT_SMTP_PASSWORD", "Process")
if (-not [string]::IsNullOrWhiteSpace($envPassword)) {
    $base.status = "EMAIL_ALERT_ENV_READY"
    $base.password_source = "env"
    $base.smtp_password_configured = $true
    Write-Result -Payload $base -ExitCode 0
    return
}

$secure = $null
if ($UseStoredSecret) {
    try {
        $secure = Load-StoredSecret -Path $SecretPath
    } catch {
        $base.secret_cache_error_redacted = $_.Exception.Message
        $secure = $null
    }
    if ($secure -and $secure.Length -gt 0) {
        [Environment]::SetEnvironmentVariable("NC_ALERT_SMTP_PASSWORD", (Convert-SecureStringToPlainText -Secure $secure), "Process")
        $base.status = "EMAIL_ALERT_STORED_SECRET_READY"
        $base.password_source = "stored_dpapi"
        $base.secret_cache_used = $true
        $base.smtp_password_configured = $true
        Write-Result -Payload $base -ExitCode 0
        return
    }
}

if (-not [string]::IsNullOrWhiteSpace($SecretTextForTest)) {
    $secure = ConvertTo-SecureString -String $SecretTextForTest -AsPlainText -Force
} elseif (-not $NoPrompt) {
    $secure = Read-Host "Enter Gmail app password for NeuroChess email alerts" -AsSecureString
    $base.password_prompted_securely = $true
}

if ($secure -and $secure.Length -gt 0) {
    [Environment]::SetEnvironmentVariable("NC_ALERT_SMTP_PASSWORD", (Convert-SecureStringToPlainText -Secure $secure), "Process")
    if ($SaveSecretLocal -or $base.password_prompted_securely -or -not [string]::IsNullOrWhiteSpace($SecretTextForTest)) {
        Save-StoredSecret -Path $SecretPath -Secret $secure
        $base.secret_saved_local = $true
        $base.secret_cache_exists = $true
    }
    $base.status = if ($base.password_prompted_securely) { "EMAIL_ALERT_PROMPTED_SECRET_READY" } else { "EMAIL_ALERT_TEST_SECRET_READY" }
    $base.password_source = if ($base.password_prompted_securely) { "secure_prompt" } else { "test_parameter" }
    $base.smtp_password_configured = $true
    Write-Result -Payload $base -ExitCode 0
    return
}

$base.status = "EMAIL_ALERT_NOT_CONFIGURED"
$base.missing_config_keys = @("smtp_password")
Write-Result -Payload $base -ExitCode 10
return
