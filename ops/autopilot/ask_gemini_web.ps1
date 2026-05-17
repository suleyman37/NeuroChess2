param(
  [switch]$DryRun,
  [switch]$Live,
  [string]$Fixture = "",
  [string]$RequestPath = "",
  [string[]]$ImagePath = @(),
  [string]$OutDir = "",
  [string]$Nonce = "",
  [int]$TimeoutSeconds = 180,
  [int]$StabilitySeconds = 8,
  [string]$ProfilePath = "C:\Users\suley\Documents\Dev\GeminiAuditorChromeProfile"
)

$ErrorActionPreference = "Stop"

if (-not $Live) { $DryRun = $true }
if (-not $Nonce) {
  $Nonce = if ($DryRun) { "A16H_TEST_NONCE" } else { "A16H_" + ([guid]::NewGuid().ToString("N").Substring(0, 12)) }
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$runRoot = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\gemini_live_smokes"
if (-not $OutDir) {
  $OutDir = Join-Path $runRoot ("gemini_web_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$summary = [ordered]@{
  mode = if ($Live) { "live" } else { "dry_run" }
  nonce = $Nonce
  run_dir = $OutDir
  fixture = $Fixture
  request_path = $RequestPath
  image_paths = @($ImagePath)
  profile_path = $ProfilePath
  browser_called = $false
  live_gemini_called = $false
  live_chatgpt_called = $false
  product_mission_executed = $false
  codex_execution = $false
  commit = $false
  push = $false
}

if ($DryRun) {
  if (-not $Fixture) {
    $Fixture = Join-Path $PSScriptRoot "fixtures\gemini_live_smoke_valid_response.txt"
  }
  if (-not (Test-Path -LiteralPath $Fixture)) { throw "Fixture not found: $Fixture" }
  $rawPath = Join-Path $OutDir "raw_response.txt"
  $fixtureText = Get-Content -LiteralPath $Fixture -Raw
  $fixtureText = $fixtureText -replace "A16H_TEST_NONCE|THE_NONCE|\{\{NONCE\}\}", $Nonce
  Set-Content -LiteralPath $rawPath -Value $fixtureText -Encoding UTF8
  Copy-Item -LiteralPath $rawPath -Destination (Join-Path $OutDir "extracted_response.txt") -Force
  $validationOutput = & "$PSScriptRoot\validate_gemini_audit_response.ps1" -InputPath $rawPath -Nonce $Nonce 2>&1
  $validationCode = $LASTEXITCODE
  $validationOutput | Set-Content -LiteralPath (Join-Path $OutDir "validation_stdout.txt") -Encoding UTF8
  $summary.validation_exit_code = $validationCode
  $summary.validation_output = ($validationOutput -join "`n")
  $summary.status = if ($validationCode -eq 0) { "pass" } else { "fail" }
  $summary | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $OutDir "ask_gemini_web_summary.json") -Encoding UTF8
  $summary | ConvertTo-Json -Depth 12
  exit $validationCode
}

if (-not $RequestPath -or -not (Test-Path -LiteralPath $RequestPath)) {
  $summary.status = "fail"
  $summary.reason = "REQUEST_FILE_MISSING"
  $summary | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $OutDir "ask_gemini_web_summary.json") -Encoding UTF8
  $summary | ConvertTo-Json -Depth 12
  exit 1
}

$imageManifestPath = ""
if ($ImagePath.Count -gt 0) {
  $resolvedImages = @()
  foreach ($image in $ImagePath) {
    if (-not (Test-Path -LiteralPath $image)) {
      $summary.status = "fail"
      $summary.reason = "IMAGE_FILE_MISSING"
      $summary.missing_image = $image
      $summary | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $OutDir "ask_gemini_web_summary.json") -Encoding UTF8
      $summary | ConvertTo-Json -Depth 12
      exit 1
    }
    $resolvedImages += (Resolve-Path -LiteralPath $image).Path
  }
  $imageManifestPath = Join-Path $OutDir "image_paths.json"
  $imageManifestJson = "[`n" + (($resolvedImages | ForEach-Object { $_ | ConvertTo-Json }) -join ",`n") + "`n]"
  $imageManifestJson | Set-Content -LiteralPath $imageManifestPath -Encoding UTF8
  $summary.image_paths = @($resolvedImages)
}

$lockJson = & "$PSScriptRoot\check_chrome_profile_lock.ps1" -ProfilePath $ProfilePath -OutDir $OutDir -JsonOnly
$lock = $lockJson | ConvertFrom-Json
$summary.profile_lock = $lock
if ($lock.locked) {
  $summary.status = "fail"
  $summary.reason = "GEMINI_CHROME_PROFILE_LOCKED"
  $summary.browser_called = $false
  $summary | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $OutDir "ask_gemini_web_summary.json") -Encoding UTF8
  $summary | ConvertTo-Json -Depth 12
  exit 1
}

$bridgeScript = Join-Path $PSScriptRoot "browser\gemini_bridge.mjs"
$summary.browser_called = $true
$summary.live_gemini_called = $true
$bundledNode = "C:\Users\suley\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$bundledNodeModules = "C:\Users\suley\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules"
$nodeExe = if (Test-Path -LiteralPath $bundledNode) { $bundledNode } else { "node" }
$previousNodePath = [string]$env:NODE_PATH
if (Test-Path -LiteralPath $bundledNodeModules) {
  $env:NODE_PATH = if ([string]::IsNullOrWhiteSpace($previousNodePath)) { $bundledNodeModules } else { "$bundledNodeModules;$previousNodePath" }
}
$bridgeArgs = @(
  $bridgeScript,
  "--request", "$RequestPath",
  "--nonce", "$Nonce",
  "--out", "$OutDir",
  "--profile", "$ProfilePath",
  "--timeout", "$TimeoutSeconds",
  "--stability", "$StabilitySeconds"
)
if ($imageManifestPath) {
  $bridgeArgs += @("--imagesFile", "$imageManifestPath")
}
& $nodeExe @bridgeArgs
$bridgeCode = $LASTEXITCODE
$env:NODE_PATH = $previousNodePath
if ($bridgeCode -ne 0) {
  $summary.status = "fail"
  $summary.bridge_exit_code = $bridgeCode
  $errorPath = Join-Path $OutDir "bridge_error.md"
  if (Test-Path -LiteralPath $errorPath) { $summary.reason = (Get-Content -LiteralPath $errorPath -Raw).Trim() }
  $summary | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $OutDir "ask_gemini_web_summary.json") -Encoding UTF8
  $summary | ConvertTo-Json -Depth 12
  exit $bridgeCode
}

$responsePath = Join-Path $OutDir "extracted_response.txt"
$validationOutput = & "$PSScriptRoot\validate_gemini_audit_response.ps1" -InputPath $responsePath -Nonce $Nonce 2>&1
$validationCode = $LASTEXITCODE
$validationOutput | Set-Content -LiteralPath (Join-Path $OutDir "validation_stdout.txt") -Encoding UTF8
$summary.validation_exit_code = $validationCode
$summary.validation_output = ($validationOutput -join "`n")
$summary.status = if ($validationCode -eq 0) { "pass" } else { "fail" }
$summary | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $OutDir "ask_gemini_web_summary.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 12
exit $validationCode
