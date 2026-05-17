param(
  [switch]$DryRun,
  [switch]$Live,
  [switch]$CloseProfileProcesses,
  [string]$Fixture = "",
  [string]$EvidencePackPath = "",
  [string[]]$AttachmentPath = @(),
  [string]$MissionId = "SUPERVISOR_BRIDGE_DRY_RUN"
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$configPath = Join-Path $PSScriptRoot "config.json"
$config = Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json

function Set-ProjectUrlIfPresent {
  param(
    [Parameter(Mandatory = $true)]$Config,
    [string]$ProjectUrl,
    [string]$Source
  )
  if ([string]::IsNullOrWhiteSpace($ProjectUrl)) {
    return $null
  }
  if ($null -eq $Config.PSObject.Properties["chatgpt_project"]) {
    $Config | Add-Member -NotePropertyName "chatgpt_project" -NotePropertyValue ([pscustomobject]@{})
  }
  $project = $Config.chatgpt_project
  if ($null -eq $project.PSObject.Properties["project_url"]) {
    $project | Add-Member -NotePropertyName "project_url" -NotePropertyValue $ProjectUrl
  } else {
    $project.project_url = $ProjectUrl
  }
  return $Source
}

function Set-ActiveSessionUrlIfPresent {
  param(
    [Parameter(Mandatory = $true)]$Config,
    [string]$SessionUrl,
    [string]$Source
  )
  if ([string]::IsNullOrWhiteSpace($SessionUrl)) {
    return $null
  }
  if ($null -eq $Config.PSObject.Properties["chatgpt_project"]) {
    $Config | Add-Member -NotePropertyName "chatgpt_project" -NotePropertyValue ([pscustomobject]@{})
  }
  $project = $Config.chatgpt_project
  if ($null -eq $project.PSObject.Properties["active_session_url"]) {
    $project | Add-Member -NotePropertyName "active_session_url" -NotePropertyValue $SessionUrl
  } else {
    $project.active_session_url = $SessionUrl
  }
  return $Source
}

$projectUrlSource = if (-not [string]::IsNullOrWhiteSpace([string]$config.chatgpt_project.project_url)) { "tracked" } else { "none" }
$activeSessionUrlSource = if (-not [string]::IsNullOrWhiteSpace([string]$config.chatgpt_project.active_session_url)) { "tracked" } else { "none" }
$envProjectUrl = [string]$env:NEUROCHESS_CHATGPT_PROJECT_URL
if (-not [string]::IsNullOrWhiteSpace($envProjectUrl)) {
  $projectUrlSource = Set-ProjectUrlIfPresent -Config $config -ProjectUrl $envProjectUrl -Source "environment"
}
$localConfigPath = Join-Path $PSScriptRoot "local\chatgpt_project.local.json"
if (Test-Path -LiteralPath $localConfigPath) {
  $localConfig = Get-Content -LiteralPath $localConfigPath -Raw | ConvertFrom-Json
  $localProjectUrl = [string]$localConfig.chatgpt_project.project_url
  if (-not [string]::IsNullOrWhiteSpace($localProjectUrl)) {
    $projectUrlSource = Set-ProjectUrlIfPresent -Config $config -ProjectUrl $localProjectUrl -Source "local"
  }
}
$localSessionPath = Join-Path $PSScriptRoot "local\chatgpt_sessions.local.json"
if (Test-Path -LiteralPath $localSessionPath) {
  $localSession = Get-Content -LiteralPath $localSessionPath -Raw | ConvertFrom-Json
  $localSessionUrl = [string]$localSession.active_session_url
  if (-not [string]::IsNullOrWhiteSpace($localSessionUrl)) {
    $activeSessionUrlSource = Set-ActiveSessionUrlIfPresent -Config $config -SessionUrl $localSessionUrl -Source "local_session"
  }
}

if (-not $Live) {
  $DryRun = $true
}

if ($Live -and $config.chatgpt_web_bridge.live_send_requires_flag -and -not $PSBoundParameters.ContainsKey("Live")) {
  & "$PSScriptRoot\stop_with_report.ps1" -Reason "LIVE_FLAG_REQUIRED" -Details "Live send requires explicit -Live."
}

if ($Live -and -not $config.chatgpt_web_bridge.enabled) {
  & "$PSScriptRoot\stop_with_report.ps1" -Reason "BRIDGE_DISABLED" -Details "config.json has chatgpt_web_bridge.enabled=false."
}

$runRoot = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\chatgpt_bridge"
try {
  New-Item -ItemType Directory -Force -Path $runRoot | Out-Null
} catch {
  $runRoot = Join-Path $repoRoot "ops\autopilot\reports\generated"
}
$runDir = Join-Path $runRoot (Get-Date -Format "yyyyMMdd_HHmmss")
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

if (-not $EvidencePackPath) {
  $packJson = & "$PSScriptRoot\build_evidence_pack.ps1" -MissionId $MissionId
  $pack = $packJson | ConvertFrom-Json
  $EvidencePackPath = $pack.evidence_pack
  $nonce = $pack.nonce
} else {
  $noncePath = Join-Path $EvidencePackPath "nonce.txt"
  if (-not (Test-Path $noncePath)) {
    & "$PSScriptRoot\stop_with_report.ps1" -RunDir $runDir -Reason "MISSING_NONCE" -Details "Evidence pack has no nonce.txt."
  }
  $nonce = (Get-Content -LiteralPath $noncePath -Raw).Trim()
}

$summary = [ordered]@{
  mode = if ($Live) { "live" } else { "dry_run" }
  live_send = [bool]$Live
  evidence_pack = $EvidencePackPath
  nonce = $nonce
  run_dir = $runDir
  fixture = $Fixture
  attachments = $AttachmentPath
  browser_called = $false
  codex_execution = $false
  commit = $false
  push = $false
}

$projectConfig = $config.chatgpt_project
if ($projectConfig) {
  $summary.chatgpt_project = [ordered]@{
    enabled = [bool]$projectConfig.enabled
    project_name = [string]$projectConfig.project_name
    project_url_configured = -not [string]::IsNullOrWhiteSpace([string]$projectConfig.project_url)
    project_url_source = $projectUrlSource
    active_session_url_configured = -not [string]::IsNullOrWhiteSpace([string]$projectConfig.active_session_url)
    active_session_url_source = $activeSessionUrlSource
    active_session_url_redacted = $true
    require_project_url = [bool]$projectConfig.require_project_url
    allow_generic_chat_fallback = [bool]$projectConfig.allow_generic_chat_fallback
  }
}

if ($DryRun) {
  if (-not $Fixture) {
    $Fixture = Join-Path $PSScriptRoot "fixtures\supervisor_valid_response.txt"
  }
  if (-not (Test-Path $Fixture)) {
    & "$PSScriptRoot\stop_with_report.ps1" -RunDir $runDir -Reason "FIXTURE_MISSING" -Details $Fixture
  }
  $rawPath = Join-Path $runDir "raw_response.txt"
  $fixtureText = Get-Content -LiteralPath $Fixture -Raw
  $fixtureText = $fixtureText -replace "TEST_NONCE_123", $nonce
  Set-Content -LiteralPath $rawPath -Value $fixtureText -Encoding UTF8
  $validation = & "$PSScriptRoot\validate_supervisor_response.ps1" -InputPath $rawPath -Nonce $nonce -OutDir $runDir 2>&1
  $code = $LASTEXITCODE
  $validation | Set-Content -LiteralPath (Join-Path $runDir "validation_stdout.txt") -Encoding UTF8
  $summary.validation_exit_code = $code
  $summary.validation_output = ($validation -join "`n")
  $summary.status = if ($code -eq 0) { "pass" } else { "fail" }
  $summary | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $runDir "ask_chatgpt_web_summary.json") -Encoding UTF8
  $summary | ConvertTo-Json -Depth 12
  exit $code
}

$bridgeScript = Join-Path $PSScriptRoot "browser\chatgpt_bridge.mjs"

if ($Live -and $projectConfig -and [bool]$projectConfig.enabled) {
  $activeSessionUrl = [string]$projectConfig.active_session_url
  $projectUrl = [string]$projectConfig.project_url
  $requiresProjectUrl = [bool]$projectConfig.require_project_url
  $allowGenericFallback = [bool]$projectConfig.allow_generic_chat_fallback
  if ([string]::IsNullOrWhiteSpace($activeSessionUrl) -and [string]::IsNullOrWhiteSpace($projectUrl) -and $requiresProjectUrl -and -not $allowGenericFallback) {
    $summary.status = "fail"
    $summary.reason = "PROJECT_URL_MISSING"
    $summary.browser_called = $false
    $summary.instructions = "Run: powershell -ExecutionPolicy Bypass -File ops/autopilot/set_chatgpt_project_url.ps1 -ProjectUrl `"PASTE_PROJECT_URL_HERE`" or set_chatgpt_active_session_url.ps1 -SessionUrl `"PASTE_PROJECT_CONVERSATION_URL_HERE`""
    $summary | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $runDir "ask_chatgpt_web_summary.json") -Encoding UTF8
    $summary | ConvertTo-Json -Depth 12
    exit 1
  }
}

$profilePath = if ($config.chatgpt_web_bridge.chrome_profile_path) {
  [string]$config.chatgpt_web_bridge.chrome_profile_path
} else {
  "C:\Users\suley\Documents\Dev\ChatGPTSupervisorChromeProfile"
}

if ($CloseProfileProcesses) {
  $cleanupJson = & "$PSScriptRoot\close_chatgpt_profile_processes.ps1" -ProfilePath $profilePath -ForceClose -OutDir $runDir
  $summary.profile_cleanup = ($cleanupJson | ConvertFrom-Json)
} else {
  $lockJson = & "$PSScriptRoot\check_chrome_profile_lock.ps1" -ProfilePath $profilePath -OutDir $runDir -JsonOnly
  $lock = $lockJson | ConvertFrom-Json
  $summary.profile_lock = $lock
  if ($lock.locked) {
    $summary.status = "fail"
    $summary.reason = "CHATGPT_CHROME_PROFILE_LOCKED"
    $summary.browser_called = $false
    $summary.instructions = "Close the dedicated Chrome profile window or run: powershell -ExecutionPolicy Bypass -File ops/autopilot/close_chatgpt_profile_processes.ps1 -ForceClose"
    $summary | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $runDir "ask_chatgpt_web_summary.json") -Encoding UTF8
    $summary | ConvertTo-Json -Depth 12
    exit 1
  }
}

$summary.browser_called = $true
$bridgeArgs = @(
  $bridgeScript,
  "--live",
  "--config", $configPath,
  "--evidence", $EvidencePackPath,
  "--nonce", $nonce,
  "--out", $runDir
)
foreach ($attachment in $AttachmentPath) {
  $bridgeArgs += @("--attachment", $attachment)
}
node @bridgeArgs
$bridgeCode = $LASTEXITCODE
if ($bridgeCode -ne 0) {
  $summary.status = "fail"
  $summary.bridge_exit_code = $bridgeCode
  $summary | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $runDir "ask_chatgpt_web_summary.json") -Encoding UTF8
  $summary | ConvertTo-Json -Depth 12
  exit $bridgeCode
}

$responsePath = Join-Path $runDir "raw_response.txt"
$validation = & "$PSScriptRoot\validate_supervisor_response.ps1" -InputPath $responsePath -Nonce $nonce -OutDir $runDir 2>&1
$code = $LASTEXITCODE
$validation | Set-Content -LiteralPath (Join-Path $runDir "validation_stdout.txt") -Encoding UTF8

if ($code -ne 0 -and [int]$config.chatgpt_web_bridge.format_repair_attempts -gt 0) {
  $repairDir = Join-Path $runDir "format_repair_attempt_1"
  New-Item -ItemType Directory -Force -Path $repairDir | Out-Null
  $repairPrompt = Get-Content -LiteralPath (Join-Path $PSScriptRoot "prompts\format_repair_prompt.md") -Raw
  $repairPrompt = $repairPrompt -replace "\{\{NONCE\}\}", $nonce
  $rawPrevious = if (Test-Path $responsePath) { Get-Content -LiteralPath $responsePath -Raw } else { "" }
  $repairRequest = @"
$repairPrompt

Nonce:
$nonce

Validation rejection:
$($validation -join "`n")

Previous response:
$rawPrevious
"@
  $repairRequestPath = Join-Path $repairDir "format_repair_request.md"
  Set-Content -LiteralPath $repairRequestPath -Value $repairRequest -Encoding UTF8
  node $bridgeScript --live --config "$configPath" --evidence "$EvidencePackPath" --nonce "$nonce" --out "$repairDir" --request "$repairRequestPath"
  $repairBridgeCode = $LASTEXITCODE
  if ($repairBridgeCode -eq 0) {
    $repairResponse = Join-Path $repairDir "raw_response.txt"
    $repairValidation = & "$PSScriptRoot\validate_supervisor_response.ps1" -InputPath $repairResponse -Nonce $nonce -OutDir $repairDir 2>&1
    $repairCode = $LASTEXITCODE
    $repairValidation | Set-Content -LiteralPath (Join-Path $repairDir "validation_stdout.txt") -Encoding UTF8
    $code = $repairCode
    $validation = $repairValidation
    $summary.format_repair_attempted = $true
    $summary.format_repair_exit_code = $repairCode
  } else {
    $summary.format_repair_attempted = $true
    $summary.format_repair_exit_code = $repairBridgeCode
  }
}

$summary.status = if ($code -eq 0) { "pass" } else { "fail" }
$summary.validation_exit_code = $code
$summary | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath (Join-Path $runDir "ask_chatgpt_web_summary.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 12
exit $code
