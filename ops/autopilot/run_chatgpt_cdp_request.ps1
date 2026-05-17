param(
  [Parameter(Mandatory = $true)][string]$RequestPath,
  [string]$Nonce = "",
  [string]$ResponseRoot = "NC_SUPERVISOR_RESPONSE",
  [string]$Endpoint = "http://127.0.0.1:9222",
  [string]$OutDir = "",
  [int]$TimeoutMs = 600000
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $RequestPath)) {
  throw "RequestPath not found: $RequestPath"
}

if (-not $Nonce) {
  $Nonce = "A19X_CDP_" + ([guid]::NewGuid().ToString("N").Substring(0, 10).ToUpperInvariant())
}

if (-not $OutDir) {
  $root = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\chatgpt_cdp_requests"
  $OutDir = Join-Path $root ("A19X_cdp_request_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$script = Join-Path $PSScriptRoot "browser\chatgpt_cdp_attach_loop.mjs"
$args = @(
  $script,
  "--live",
  "--request", (Resolve-Path -LiteralPath $RequestPath).Path,
  "--nonce", $Nonce,
  "--response-root", $ResponseRoot,
  "--endpoint", $Endpoint,
  "--out", $OutDir,
  "--timeoutMs", ([string]$TimeoutMs)
)

node @args
$exit = $LASTEXITCODE
$summaryPath = Join-Path $OutDir "cdp_request_wrapper_summary.json"
$resultPath = Join-Path $OutDir "cdp_attach_result.json"
$result = $null
if (Test-Path -LiteralPath $resultPath) {
  $result = Get-Content -LiteralPath $resultPath -Raw | ConvertFrom-Json
}

$summary = [ordered]@{
  mode = "live_cdp_request"
  request_path_redacted = $true
  nonce = $Nonce
  response_root = $ResponseRoot
  endpoint = $Endpoint
  output_dir = $OutDir
  browser_launched = $false
  cdp_attach_attempted = $true
  live_chatgpt_called = $true
  live_gemini_called = $false
  product_mission_executed = $false
  chrome_closed_by_codex = $false
  commit = $false
  push = $false
  node_exit_code = $exit
  cdp_request_result = $result
  status = if ($exit -eq 0) { "pass" } else { "fail" }
}

$summary | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $summaryPath -Encoding UTF8
$summary | ConvertTo-Json -Depth 20
exit $exit
