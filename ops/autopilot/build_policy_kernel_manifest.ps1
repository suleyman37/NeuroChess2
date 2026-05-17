param(
  [string]$PolicyPath = (Join-Path $PSScriptRoot "long_run_safety_policy.yaml"),
  [string]$OutPath
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Read-PolicyKernelFiles {
  param([string]$Path)
  $files = New-Object System.Collections.Generic.List[string]
  $inKernel = $false
  $inFiles = $false
  foreach ($line in Get-Content -LiteralPath $Path) {
    if ($line -match '^\s*policy_kernel:\s*$') {
      $inKernel = $true
      $inFiles = $false
      continue
    }
    if ($inKernel -and $line -match '^\s{2}files:\s*$') {
      $inFiles = $true
      continue
    }
    if ($inFiles -and $line -match '^\s{4}-\s+(.+?)\s*$') {
      $files.Add(($Matches[1].Trim().Trim('"').Trim("'"))) | Out-Null
      continue
    }
    if ($inFiles -and $line -match '^\S') {
      break
    }
  }
  return @($files)
}

$repoRoot = Get-RepoRoot
$policyFullPath = if ([System.IO.Path]::IsPathRooted($PolicyPath)) { $PolicyPath } else { Join-Path $repoRoot $PolicyPath }
$policyFullPath = (Resolve-Path -LiteralPath $policyFullPath).Path
$entries = New-Object System.Collections.Generic.List[object]

foreach ($relativePath in Read-PolicyKernelFiles -Path $policyFullPath) {
  $fullPath = Join-Path $repoRoot $relativePath
  $exists = Test-Path -LiteralPath $fullPath -PathType Leaf
  if ($exists) {
    $item = Get-Item -LiteralPath $fullPath
    $hash = (Get-FileHash -LiteralPath $fullPath -Algorithm SHA256).Hash
    $size = [int64]$item.Length
    $modified = $item.LastWriteTimeUtc.ToString("o")
  } else {
    $hash = ""
    $size = 0
    $modified = $null
  }
  $entries.Add([ordered]@{
    path = ($relativePath -replace "\\", "/")
    exists = [bool]$exists
    hash = $hash
    size = $size
    modified_utc = $modified
  }) | Out-Null
}

$policyRelativePath = $policyFullPath.Substring($repoRoot.Length).TrimStart([char[]]@('\', '/')) -replace "\\", "/"

$manifest = [ordered]@{
  schema_version = "A20A_policy_kernel_manifest_v1"
  created_at = (Get-Date).ToUniversalTime().ToString("o")
  policy_path = $policyRelativePath
  files = $entries.ToArray()
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$json = $manifest | ConvertTo-Json -Depth 10
if ($OutPath) {
  $outFullPath = if ([System.IO.Path]::IsPathRooted($OutPath)) { $OutPath } else { Join-Path $repoRoot $OutPath }
  $outDir = Split-Path -Parent $outFullPath
  if ($outDir) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
  Set-Content -LiteralPath $outFullPath -Value $json -Encoding UTF8
}

$json
exit 0
