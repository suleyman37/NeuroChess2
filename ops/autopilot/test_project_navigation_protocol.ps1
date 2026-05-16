$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Read-Json {
  param([string]$Path)
  return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function Invoke-JsonScript {
  param([string]$ScriptPath, [string[]]$Arguments = @(), [int]$ExpectedExitCode = 0)
  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @Arguments 2>&1
    $exitCode = $LASTEXITCODE
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  Assert-True ($exitCode -eq $ExpectedExitCode) "Unexpected exit code $exitCode for $ScriptPath. Output: $($output -join "`n")"
  if ($ExpectedExitCode -eq 0) {
    return ($output | Out-String | ConvertFrom-Json)
  }
  return $output
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$fixtureRoot = Join-Path $PSScriptRoot "fixtures"
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\session_rollovers" ("A12C_project_navigation_test_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$config = Read-Json -Path (Join-Path $repoRoot "ops\autopilot\config.json")
Assert-True ([bool]$config.chatgpt_project.enabled) "chatgpt_project.enabled must be true"
Assert-True ($config.chatgpt_project.project_name -eq "NeuroChess Supervisor") "project name mismatch"
Assert-True ([bool]$config.chatgpt_project.require_project_url) "require_project_url must be true"
Assert-True ([bool]$config.chatgpt_project.verify_project_name) "verify_project_name must be true"
Assert-True (-not [bool]$config.chatgpt_project.allow_generic_chat_fallback) "generic fallback must be false"

$missing = Read-Json -Path (Join-Path $fixtureRoot "project_navigation_missing_url.json")
Assert-True ([string]::IsNullOrWhiteSpace([string]$missing.chatgpt_project.project_url)) "missing URL fixture should have empty project_url"
Assert-True ([bool]$missing.chatgpt_project.require_project_url) "missing URL fixture should require project_url"

$valid = Read-Json -Path (Join-Path $fixtureRoot "project_navigation_valid_config.json")
Assert-True ($valid.chatgpt_project.project_url -match '^https://chatgpt\.com/') "valid URL fixture should use chatgpt.com"

$tempConfig = Join-Path $runDir "config_under_test.json"
Copy-Item -LiteralPath (Join-Path $fixtureRoot "project_navigation_missing_url.json") -Destination $tempConfig
$setResult = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "set_chatgpt_project_url.ps1") -Arguments @(
  "-ConfigPath", $tempConfig,
  "-ProjectUrl", "https://chatgpt.com/g/g-test-neurochess-supervisor"
)
Assert-True ([bool]$setResult.project_url_configured) "helper should configure project URL"
$updated = Read-Json -Path $tempConfig
Assert-True ($updated.chatgpt_project.project_url -eq "https://chatgpt.com/g/g-test-neurochess-supervisor") "helper did not write project_url"
Assert-True ($updated.chatgpt_project.project_name -eq "NeuroChess Supervisor") "helper must keep project name"

$invalidOutput = Invoke-JsonScript -ScriptPath (Join-Path $PSScriptRoot "set_chatgpt_project_url.ps1") -Arguments @(
  "-ConfigPath", $tempConfig,
  "-ProjectUrl", "https://example.com/not-chatgpt"
) -ExpectedExitCode 1
Assert-True (($invalidOutput -join "`n") -match "ProjectUrl must start") "invalid URL should be rejected"

$bridgeSource = Get-Content -LiteralPath (Join-Path $PSScriptRoot "browser\chatgpt_bridge.mjs") -Raw
foreach ($needle in @(
  "PROJECT_URL_MISSING",
  "PROJECT_CONTEXT_UNVERIFIED",
  "chatgpt_project",
  "project_url",
  "allow_generic_chat_fallback"
)) {
  Assert-True ($bridgeSource.Contains($needle)) "bridge source missing $needle"
}

$nodeCheck = & node --check (Join-Path $PSScriptRoot "browser\chatgpt_bridge.mjs") 2>&1
Assert-True ($LASTEXITCODE -eq 0) "node --check failed: $($nodeCheck -join "`n")"

$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
Assert-True ($endBranch -eq $startBranch) "test should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "test should leave HEAD unchanged"

$result = [ordered]@{
  status = "pass"
  report_dir = $runDir
  project_url_configured_in_repo = -not [string]::IsNullOrWhiteSpace([string]$config.chatgpt_project.project_url)
  start_branch = $startBranch
  end_branch = $endBranch
  start_head = $startHead
  end_head = $endHead
  checks = [ordered]@{
    config_project_block = "PASS"
    missing_url_fixture = "PASS"
    valid_url_fixture = "PASS"
    helper_sets_url = "PASS"
    helper_rejects_invalid_url = "PASS"
    bridge_project_guards_present = "PASS"
    bridge_node_check = "PASS"
    no_live_chatgpt_call = $true
    no_product_mission = $true
  }
}

$result | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "project_navigation_protocol_test_result.json") -Encoding UTF8
$result | ConvertTo-Json -Depth 10
exit 0
