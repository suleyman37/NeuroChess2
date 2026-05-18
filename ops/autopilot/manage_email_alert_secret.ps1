param(
    [ValidateSet("Set", "ImportFromEnv", "Get", "Test", "Clear", "Status")]
    [string]$Action = "Status",
    [string]$SecretPath = "",
    [switch]$NoPrompt,
    [string]$SecretTextForTest = ""
)

$ErrorActionPreference = "Stop"

function Write-Json {
    param([object]$Payload)
    $Payload | ConvertTo-Json -Depth 20
}

function Get-DefaultSecretPath {
    Join-Path $PSScriptRoot "local\email_alert.secret.dpapi.json"
}

function Ensure-ParentDirectory {
    param([string]$Path)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
}

function New-SecretEnvelope {
    param([securestring]$Secret)
    [ordered]@{
        schema_version = "neurochess_email_alert_secret_dpapi_v1"
        encryption = "windows_dpapi_current_user"
        created_at = (Get-Date).ToString("o")
        secret_name = "NC_ALERT_SMTP_PASSWORD"
        ciphertext = ConvertFrom-SecureString -SecureString $Secret
        plaintext_stored = $false
        secrets_redacted = $true
    }
}

function Read-SecretEnvelope {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Test-SecretEnvelope {
    param([object]$Envelope)
    if (-not $Envelope) { return $false }
    if ([string]::IsNullOrWhiteSpace([string]$Envelope.ciphertext)) { return $false }
    $secure = ConvertTo-SecureString -String ([string]$Envelope.ciphertext)
    return ($null -ne $secure -and $secure.Length -gt 0)
}

function Save-Secret {
    param([string]$Path, [securestring]$Secret)
    Ensure-ParentDirectory -Path $Path
    $envelope = New-SecretEnvelope -Secret $Secret
    $envelope | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding UTF8
}

if ([string]::IsNullOrWhiteSpace($SecretPath)) {
    $SecretPath = Get-DefaultSecretPath
}

$base = [ordered]@{
    schema_version = "neurochess_email_alert_secret_manager_result_v1"
    action = $Action
    secret_path = $SecretPath
    secret_path_redacted = $true
    secret_file_exists = Test-Path -LiteralPath $SecretPath -PathType Leaf
    plaintext_printed = $false
    plaintext_written = $false
    secrets_redacted = $true
}

try {
    switch ($Action) {
        "Status" {
            $envelope = Read-SecretEnvelope -Path $SecretPath
            $base.status = if ($envelope) { "EMAIL_SECRET_CACHE_PRESENT" } else { "EMAIL_SECRET_CACHE_MISSING" }
            $base.cache_schema_version = if ($envelope) { [string]$envelope.schema_version } else { $null }
            $base.encryption = if ($envelope) { [string]$envelope.encryption } else { $null }
            Write-Json $base
            exit 0
        }
        "Test" {
            $envelope = Read-SecretEnvelope -Path $SecretPath
            if (Test-SecretEnvelope -Envelope $envelope) {
                $base.status = "SECRET_AVAILABLE"
                $base.legacy_status = "EMAIL_SECRET_CACHE_VALID"
                Write-Json $base
                exit 0
            }
            $base.status = "SECRET_INVALID"
            $base.legacy_status = "EMAIL_SECRET_CACHE_INVALID_OR_MISSING"
            Write-Json $base
            exit 2
        }
        "Get" {
            $envelope = Read-SecretEnvelope -Path $SecretPath
            if (Test-SecretEnvelope -Envelope $envelope) {
                $base.status = "SECRET_AVAILABLE"
                $base.secure_value_available = $true
                $base.secret_value_printed = $false
                Write-Json $base
                exit 0
            }
            $base.status = "SECRET_INVALID"
            $base.secure_value_available = $false
            Write-Json $base
            exit 2
        }
        "ImportFromEnv" {
            $envSecret = [Environment]::GetEnvironmentVariable("NC_ALERT_SMTP_PASSWORD", "Process")
            if ([string]::IsNullOrWhiteSpace($envSecret)) {
                $base.status = "SECRET_ENV_MISSING"
                Write-Json $base
                exit 3
            }
            $secure = ConvertTo-SecureString -String $envSecret -AsPlainText -Force
            Save-Secret -Path $SecretPath -Secret $secure
            $base.status = "SECRET_IMPORTED_TO_CACHE"
            $base.secret_file_exists = $true
            $base.env_secret_value_printed = $false
            Write-Json $base
            exit 0
        }
        "Clear" {
            if (Test-Path -LiteralPath $SecretPath -PathType Leaf) {
                Remove-Item -LiteralPath $SecretPath -Force
            }
            $base.status = "SECRET_CLEARED"
            $base.legacy_status = "EMAIL_SECRET_CACHE_CLEARED"
            $base.secret_file_exists = $false
            Write-Json $base
            exit 0
        }
        "Set" {
            $secure = $null
            if (-not [string]::IsNullOrWhiteSpace($SecretTextForTest)) {
                $secure = ConvertTo-SecureString -String $SecretTextForTest -AsPlainText -Force
            } elseif (-not $NoPrompt) {
                $secure = Read-Host "Enter Gmail app password for NeuroChess email alerts" -AsSecureString
            }
            if ($null -eq $secure -or $secure.Length -le 0) {
                $base.status = "EMAIL_SECRET_PROMPT_REQUIRED"
                Write-Json $base
                exit 3
            }
            Save-Secret -Path $SecretPath -Secret $secure
            $base.status = "SECRET_STORED"
            $base.legacy_status = "EMAIL_SECRET_CACHE_STORED"
            $base.secret_file_exists = $true
            Write-Json $base
            exit 0
        }
    }
} catch {
    $base.status = "EMAIL_SECRET_CACHE_ERROR"
    $base.error_redacted = $_.Exception.Message
    Write-Json $base
    exit 1
}
