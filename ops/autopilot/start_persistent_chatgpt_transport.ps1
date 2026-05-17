param(
  [switch]$DryRun,
  [switch]$LiveSmoke,
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$configPath = Join-Path $PSScriptRoot "config.json"
$sessionPath = Join-Path $PSScriptRoot "local\chatgpt_sessions.local.json"

if (-not (Test-Path -LiteralPath $sessionPath)) {
  throw "Active ChatGPT session file missing: ops/autopilot/local/chatgpt_sessions.local.json"
}

$session = Get-Content -LiteralPath $sessionPath -Raw | ConvertFrom-Json
$sessionUrl = [string]$session.active_session_url
if ([string]::IsNullOrWhiteSpace($sessionUrl)) {
  throw "active_session_url missing from local session file"
}
if ($sessionUrl -notmatch '^https://chatgpt\.com/' -or $sessionUrl -notmatch 'g-p-6a07c20c139c8191a0d8972fc7b7019e-neurochess-supervisor' -or $sessionUrl -notmatch '/c/') {
  throw "active_session_url must be a NeuroChess Supervisor project conversation URL"
}

if (-not $OutDir) {
  $root = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\persistent_chatgpt_sessions"
  New-Item -ItemType Directory -Force -Path $root | Out-Null
  $OutDir = Join-Path $root ("A18G_persistent_transport_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$summary = [ordered]@{
  mode = if ($LiveSmoke) { "live_smoke" } else { "dry_run" }
  active_session_url_configured = $true
  active_session_url_redacted = $true
  run_dir = $OutDir
  browser_called = $false
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
  micro_prompt_requested = $false
}

if ($DryRun -or -not $LiveSmoke) {
  $summary.status = "pass"
  $summary.note = "Dry-run only; no browser opened."
  $summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $OutDir "persistent_transport_start_summary.json") -Encoding UTF8
  $summary | ConvertTo-Json -Depth 10
  exit 0
}

$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json
$profilePath = if ($config.chatgpt_web_bridge.chrome_profile_path) {
  [string]$config.chatgpt_web_bridge.chrome_profile_path
} else {
  "C:\Users\suley\Documents\Dev\ChatGPTSupervisorChromeProfile"
}

$lockJson = & "$PSScriptRoot\check_chrome_profile_lock.ps1" -ProfilePath $profilePath -OutDir $OutDir -JsonOnly
$lock = $lockJson | ConvertFrom-Json
$summary.profile_lock = $lock
if ([bool]$lock.locked) {
  $summary.status = "fail"
  $summary.reason = "CHATGPT_CHROME_PROFILE_LOCKED"
  $summary | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $OutDir "persistent_transport_start_summary.json") -Encoding UTF8
  $summary | ConvertTo-Json -Depth 12
  exit 1
}

$nonce = "A18G_" + ([guid]::NewGuid().ToString("N").Substring(0, 12).ToUpperInvariant())
$bridgeScript = Join-Path $PSScriptRoot "browser\chatgpt_bridge.mjs"
$summary.browser_called = $true
$summary.live_chatgpt_called = $true

node $bridgeScript --live --persistent-smoke --config $configPath --nonce $nonce --out $OutDir
$bridgeCode = $LASTEXITCODE
$summary.bridge_exit_code = $bridgeCode
if (Test-Path -LiteralPath (Join-Path $OutDir "persistent_transport_summary.json")) {
  $summary.persistent_transport_summary = Get-Content -LiteralPath (Join-Path $OutDir "persistent_transport_summary.json") -Raw | ConvertFrom-Json
}
$summary.status = if ($bridgeCode -eq 0) { "pass" } else { "fail" }
$summary | ConvertTo-Json -Depth 14 | Set-Content -LiteralPath (Join-Path $OutDir "persistent_transport_start_summary.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 14
exit $bridgeCode
