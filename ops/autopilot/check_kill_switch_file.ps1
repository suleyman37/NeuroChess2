param(
  [string]$Path = (Join-Path $PSScriptRoot "STOP_NOW"),
  [string]$FixturePath
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

if ($FixturePath) {
  $fixtureFullPath = if ([System.IO.Path]::IsPathRooted($FixturePath)) { $FixturePath } else { Join-Path (Get-RepoRoot) $FixturePath }
  $fixture = Get-Content -LiteralPath $fixtureFullPath -Raw | ConvertFrom-Json
  $present = [bool]$fixture.kill_switch_present
  $resolvedPath = "fixture:$fixtureFullPath"
} else {
  $resolvedPath = if ([System.IO.Path]::IsPathRooted($Path)) { $Path } else { Join-Path (Get-RepoRoot) $Path }
  $present = Test-Path -LiteralPath $resolvedPath -PathType Leaf
}

$result = [ordered]@{
  kill_switch_present = [bool]$present
  kill_switch_result = $(if ($present) { "STOP_KILL_SWITCH_FILE" } else { "CLEAR" })
  recommended_action = $(if ($present) { "DRAIN" } else { "CONTINUE" })
  kill_switch_path = $resolvedPath
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
if ($present) { exit 2 }
exit 0
