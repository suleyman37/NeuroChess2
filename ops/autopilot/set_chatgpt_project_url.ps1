param(
  [Parameter(Mandatory = $true)][string]$ProjectUrl,
  [string]$ConfigPath = ""
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

$config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
if ($null -eq $config.PSObject.Properties["chatgpt_project"]) {
  $config | Add-Member -NotePropertyName "chatgpt_project" -NotePropertyValue ([pscustomobject]@{})
}

$project = $config.chatgpt_project
foreach ($entry in @(
  @{ Name = "enabled"; Value = $true },
  @{ Name = "project_name"; Value = "NeuroChess Supervisor" },
  @{ Name = "project_url"; Value = $ProjectUrl },
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

$config | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $ConfigPath -Encoding UTF8

[ordered]@{
  status = "pass"
  config_path = $ConfigPath
  project_name = "NeuroChess Supervisor"
  project_url_configured = $true
  project_url = $ProjectUrl
  live_chatgpt_called = $false
  browser_opened = $false
  commit = $false
  push = $false
} | ConvertTo-Json -Depth 6
