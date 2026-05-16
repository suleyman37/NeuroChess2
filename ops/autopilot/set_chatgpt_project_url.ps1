param(
  [Parameter(Mandatory = $true)][string]$ProjectUrl,
  [string]$ConfigPath = "",
  [string]$LocalConfigPath = ""
)

$ErrorActionPreference = "Stop"

if ($ProjectUrl -notmatch '^https://(chatgpt\.com|chat\.openai\.com)/') {
  throw "ProjectUrl must start with https://chatgpt.com/ or https://chat.openai.com/"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if (-not $ConfigPath) {
  $ConfigPath = Join-Path $repoRoot "ops\autopilot\config.json"
}
if (-not (Test-Path -LiteralPath $ConfigPath)) {
  throw "Config file not found: $ConfigPath"
}
if (-not $LocalConfigPath) {
  $LocalConfigPath = Join-Path $repoRoot "ops\autopilot\local\chatgpt_project.local.json"
}

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
if ($null -eq $config.PSObject.Properties["chatgpt_project"]) {
  $config | Add-Member -NotePropertyName "chatgpt_project" -NotePropertyValue ([pscustomobject]@{})
}

$project = $config.chatgpt_project
foreach ($entry in @(
  @{ Name = "enabled"; Value = $true },
  @{ Name = "project_name"; Value = "NeuroChess Supervisor" },
  @{ Name = "require_project_url"; Value = $true },
  @{ Name = "verify_project_name"; Value = $true },
  @{ Name = "allow_generic_chat_fallback"; Value = $false }
)) {
  if ($null -eq $project.PSObject.Properties[$entry.Name]) {
    $project | Add-Member -NotePropertyName $entry.Name -NotePropertyValue $entry.Value
  } else {
    $project.($entry.Name) = $entry.Value
  }
}

$localConfig = [ordered]@{
  chatgpt_project = [ordered]@{
    project_url = $ProjectUrl
  }
}

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $LocalConfigPath) | Out-Null
[System.IO.File]::WriteAllText($LocalConfigPath, ($localConfig | ConvertTo-Json -Depth 20), $utf8NoBom)

$uri = [Uri]$ProjectUrl
$pathPrefix = $uri.AbsolutePath.Substring(0, [Math]::Min(18, $uri.AbsolutePath.Length))

[ordered]@{
  status = "pass"
  config_path = $ConfigPath
  local_config_path = $LocalConfigPath
  project_name = "NeuroChess Supervisor"
  project_url_configured = $true
  project_url_source = "local"
  project_url_host = $uri.Host
  project_url_path_prefix = $pathPrefix
  live_chatgpt_called = $false
  browser_opened = $false
  commit = $false
  push = $false
} | ConvertTo-Json -Depth 6
