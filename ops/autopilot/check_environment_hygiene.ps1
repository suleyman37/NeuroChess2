param(
  [string]$FixturePath,
  [string]$ProcessRegistryPath,
  [string]$PortFixturePath
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Invoke-JsonScript {
  param([string]$Script, [string[]]$Arguments = @(), [int[]]$AcceptExitCodes = @(0, 2))
  $previous = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $Script @Arguments 2>&1
  } finally {
    $ErrorActionPreference = $previous
  }
  $text = ($output | Out-String).Trim()
  if (-not $text) { throw "No JSON output from $Script" }
  return ($text | ConvertFrom-Json)
}

$warnings = New-Object System.Collections.Generic.List[string]
$violations = New-Object System.Collections.Generic.List[string]

if ($FixturePath) {
  $fullPath = if ([System.IO.Path]::IsPathRooted($FixturePath)) { $FixturePath } else { Join-Path (Get-RepoRoot) $FixturePath }
  $fixture = Get-Content -LiteralPath $fullPath -Raw | ConvertFrom-Json
  $processResult = [string]$fixture.process_registry_result
  $portResult = [string]$fixture.port_registry_result
  if ($processResult -like "STOP_*") { $violations.Add($processResult) | Out-Null }
  elseif ($processResult -like "WARN_*") { $warnings.Add($processResult) | Out-Null }
  if ($portResult -like "STOP_*") { $violations.Add($portResult) | Out-Null }
  elseif ($portResult -like "WARN_*") { $warnings.Add($portResult) | Out-Null }
  if ([string]$fixture.disk_check_result -like "WARN_*") { $warnings.Add([string]$fixture.disk_check_result) | Out-Null }
  foreach ($warning in @($fixture.runtime_lock_warnings)) { $warnings.Add([string]$warning) | Out-Null }
  foreach ($warning in @($fixture.db_lock_warnings)) { $warnings.Add([string]$warning) | Out-Null }
} else {
  $processArgs = @()
  if ($ProcessRegistryPath) { $processArgs += @("-RegistryPath", $ProcessRegistryPath) }
  $process = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "check_runtime_process_registry.ps1") -Arguments $processArgs
  $portArgs = @()
  if ($PortFixturePath) { $portArgs += @("-FixturePath", $PortFixturePath) }
  $port = Invoke-JsonScript -Script (Join-Path $PSScriptRoot "check_port_registry.ps1") -Arguments $portArgs
  $processResult = [string]$process.process_registry_result
  $portResult = [string]$port.port_registry_result
  if ($processResult -like "STOP_*") { $violations.Add($processResult) | Out-Null }
  elseif ($processResult -like "WARN_*") { $warnings.Add($processResult) | Out-Null }
  if ($portResult -like "STOP_*") { $violations.Add($portResult) | Out-Null }
  elseif ($portResult -like "WARN_*") { $warnings.Add($portResult) | Out-Null }
}

if ($violations.Count -gt 0) {
  $resultName = "STOP_ENVIRONMENT_POISONED"
  $action = "DRAIN"
} elseif ($warnings.Count -gt 0) {
  $resultName = "WARN_ENVIRONMENT_DIRTY"
  $action = "DRAIN"
} else {
  $resultName = "PASS"
  $action = "CONTINUE"
}

$result = [ordered]@{
  environment_hygiene_result = $resultName
  warnings = $warnings.ToArray()
  violations = $violations.ToArray()
  recommended_action = $action
  process_registry_result = $processResult
  port_registry_result = $portResult
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
if ($resultName -eq "STOP_ENVIRONMENT_POISONED") { exit 2 }
exit 0
