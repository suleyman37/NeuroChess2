param(
  [string]$BaselinePath,
  [string]$CurrentPath,
  [string]$PolicyPath = (Join-Path $PSScriptRoot "long_run_safety_policy.yaml")
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Read-JsonFile {
  param([string]$Path)
  if (-not $Path) { throw "Path is required" }
  $fullPath = if ([System.IO.Path]::IsPathRooted($Path)) { $Path } else { Join-Path (Get-RepoRoot) $Path }
  return (Get-Content -LiteralPath $fullPath -Raw | ConvertFrom-Json)
}

function Convert-FilesToMap {
  param($Files)
  $map = @{}
  foreach ($file in @($Files)) {
    $map[[string]$file.path] = $file
  }
  return $map
}

if (-not $BaselinePath) {
  throw "BaselinePath is required"
}

$baseline = Read-JsonFile -Path $BaselinePath
if ($CurrentPath) {
  $current = Read-JsonFile -Path $CurrentPath
} else {
  $temp = Join-Path ([System.IO.Path]::GetTempPath()) ("a20a_policy_kernel_current_{0}.json" -f ([guid]::NewGuid().ToString("N")))
  & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "build_policy_kernel_manifest.ps1") -PolicyPath $PolicyPath -OutPath $temp | Out-Null
  $current = Read-JsonFile -Path $temp
  Remove-Item -LiteralPath $temp -Force -ErrorAction SilentlyContinue
}

$baseMap = Convert-FilesToMap -Files $baseline.files
$currentMap = Convert-FilesToMap -Files $current.files
$changed = New-Object System.Collections.Generic.List[string]
$missing = New-Object System.Collections.Generic.List[string]
$new = New-Object System.Collections.Generic.List[string]

foreach ($path in $baseMap.Keys) {
  if (-not $currentMap.ContainsKey($path)) {
    $missing.Add($path) | Out-Null
    continue
  }
  $baseFile = $baseMap[$path]
  $currentFile = $currentMap[$path]
  if ([bool]$baseFile.exists -and -not [bool]$currentFile.exists) {
    $missing.Add($path) | Out-Null
    continue
  }
  if ([bool]$baseFile.exists -and [bool]$currentFile.exists -and ([string]$baseFile.hash -ne [string]$currentFile.hash)) {
    $changed.Add($path) | Out-Null
  }
}

foreach ($path in $currentMap.Keys) {
  if (-not $baseMap.ContainsKey($path)) {
    $new.Add($path) | Out-Null
  }
}

$stop = ($changed.Count -gt 0 -or $missing.Count -gt 0 -or $new.Count -gt 0)
$result = [ordered]@{
  kernel_result = $(if ($stop) { "STOP_POLICY_KERNEL_CHANGED" } else { "PASS" })
  changed_files = @($changed)
  missing_files = @($missing)
  new_files = @($new)
  recommended_action = $(if ($stop) { "STOP" } else { "CONTINUE" })
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
if ($stop) { exit 2 }
exit 0
