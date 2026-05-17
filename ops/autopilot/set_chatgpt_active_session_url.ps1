param(
  [Parameter(Mandatory = $true)][string]$SessionUrl,
  [string]$LocalSessionPath = ""
)

$ErrorActionPreference = "Stop"

$projectPathSegment = "g-p-6a07c20c139c8191a0d8972fc7b7019e-neurochess-supervisor"

if ($SessionUrl -notmatch '^https://chatgpt\.com/') {
  throw "SessionUrl must start with https://chatgpt.com/"
}
if ($SessionUrl -notmatch [regex]::Escape($projectPathSegment)) {
  throw "SessionUrl must contain the NeuroChess Supervisor project path segment"
}
if ($SessionUrl -notmatch '/c/[^/?#]+') {
  throw "SessionUrl must contain a /c/ conversation segment"
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
if (-not $LocalSessionPath) {
  $LocalSessionPath = Join-Path $repoRoot "ops\autopilot\local\chatgpt_sessions.local.json"
}

$session = [ordered]@{
  project_name = "NeuroChess Supervisor"
  active_session_url = $SessionUrl
  active_session_id = "chatgpt-supervisor-active"
  messages_in_session = 0
  assistant_responses_in_session = 0
  missions_in_session = 0
  last_ready_check = $null
  rollover_threshold_messages = 12
  rollover_threshold_missions = 5
}

$utf8NoBom = [System.Text.UTF8Encoding]::new($false)
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $LocalSessionPath) | Out-Null
[System.IO.File]::WriteAllText($LocalSessionPath, ($session | ConvertTo-Json -Depth 20), $utf8NoBom)

$uri = [Uri]$SessionUrl
$pathPrefix = $uri.AbsolutePath.Substring(0, [Math]::Min(18, $uri.AbsolutePath.Length))

[ordered]@{
  status = "pass"
  local_session_path = $LocalSessionPath
  project_name = "NeuroChess Supervisor"
  active_session_url_configured = $true
  active_session_url_redacted = $true
  active_session_url_host = $uri.Host
  active_session_url_path_prefix = $pathPrefix
  active_session_id = "chatgpt-supervisor-active"
  live_chatgpt_called = $false
  browser_opened = $false
  commit = $false
  push = $false
} | ConvertTo-Json -Depth 6
