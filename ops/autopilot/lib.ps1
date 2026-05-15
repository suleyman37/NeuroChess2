$ErrorActionPreference = "Stop"

function Get-AutopilotRepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Get-AutopilotArtifactRoot {
  if ($env:NEUROCHESS_AUTOPILOT_ARTIFACT_ROOT) {
    return $env:NEUROCHESS_AUTOPILOT_ARTIFACT_ROOT
  }
  return "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot"
}

function Get-AutopilotWorktreeRoot {
  if ($env:NEUROCHESS_AUTOPILOT_WORKTREE_ROOT) {
    return $env:NEUROCHESS_AUTOPILOT_WORKTREE_ROOT
  }
  return "C:\Users\suley\Documents\Dev\NeuroChess2_worktrees"
}

function New-AutopilotRunDir {
  param([string]$Name = "run")
  $root = Get-AutopilotArtifactRoot
  New-Item -ItemType Directory -Force -Path $root | Out-Null
  $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $safeName = $Name -replace "[^A-Za-z0-9_.-]", "_"
  $path = Join-Path $root "$safeName`_$stamp"
  New-Item -ItemType Directory -Force -Path $path | Out-Null
  return $path
}

function Write-AutopilotJson {
  param(
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter(Mandatory=$true)]$Value
  )
  $parent = Split-Path -Parent $Path
  if ($parent) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  $Value | ConvertTo-Json -Depth 20 | Set-Content -Encoding utf8 -Path $Path
}

function Invoke-AutopilotLogged {
  param(
    [Parameter(Mandatory=$true)][string]$Command,
    [Parameter(Mandatory=$true)][string]$Cwd,
    [Parameter(Mandatory=$true)][string]$LogPath
  )
  $parent = Split-Path -Parent $LogPath
  if ($parent) {
    New-Item -ItemType Directory -Force -Path $parent | Out-Null
  }
  "### $Command" | Out-File -Encoding utf8 -FilePath $LogPath
  Push-Location $Cwd
  try {
    cmd /c $Command 2>&1 | Tee-Object -Append -FilePath $LogPath
    return $LASTEXITCODE
  } finally {
    Pop-Location
  }
}

function Get-OllamaExe {
  if ($env:OLLAMA_EXE -and (Test-Path $env:OLLAMA_EXE)) {
    return $env:OLLAMA_EXE
  }
  $candidates = @(
    "$env:LOCALAPPDATA\Programs\Ollama\ollama.exe",
    "$env:ProgramFiles\Ollama\ollama.exe",
    "$env:LOCALAPPDATA\Ollama\ollama.exe"
  )
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) {
      return $candidate
    }
  }
  $cmd = Get-Command ollama -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }
  return $null
}

function Get-AutopilotRuntimeStatePath {
  return (Join-Path (Get-AutopilotArtifactRoot) "runtime_state.json")
}

function Read-AutopilotRuntimeState {
  $path = Get-AutopilotRuntimeStatePath
  if (Test-Path $path) {
    try {
      return Get-Content -Raw $path | ConvertFrom-Json
    } catch {
      return [pscustomobject]@{ completed = @(); failures = @(); degraded = $false }
    }
  }
  return [pscustomobject]@{ completed = @(); failures = @(); degraded = $false }
}

function Save-AutopilotRuntimeState {
  param($State)
  Write-AutopilotJson -Path (Get-AutopilotRuntimeStatePath) -Value $State
}

function Add-AutopilotCompletedTask {
  param([string]$TaskId)
  $state = Read-AutopilotRuntimeState
  $completed = @($state.completed)
  if ($completed -notcontains $TaskId) {
    $completed += $TaskId
  }
  $state | Add-Member -Force -NotePropertyName completed -NotePropertyValue $completed
  Save-AutopilotRuntimeState $state
}

function Test-AutopilotForbiddenPath {
  param([string]$Path)
  $normalized = ($Path -replace "\\", "/").Trim()
  if ($normalized -eq ".serena/project.yml") { return $true }
  if ($normalized -like ".venv/*") { return $true }
  if ($normalized -like "qa_artifacts/*") { return $true }
  if ($normalized -eq "backend/neurochess/data/openings_book.json") { return $true }
  return $false
}

function Get-AutopilotChangedPaths {
  param([string]$Cwd)
  Push-Location $Cwd
  try {
    $paths = @()
    $status = git status --porcelain=v1
    foreach ($line in $status) {
      if (-not $line) { continue }
      $path = $line.Substring(3).Trim()
      if ($path -match " -> ") {
        $path = ($path -split " -> ")[-1]
      }
      $paths += ($path -replace "\\", "/")
    }
    return $paths
  } finally {
    Pop-Location
  }
}

function Assert-NoForbiddenChangedPath {
  param([string]$Cwd)
  $bad = @(Get-AutopilotChangedPaths -Cwd $Cwd | Where-Object { Test-AutopilotForbiddenPath $_ })
  if ($bad.Count -gt 0) {
    throw "Forbidden changed path(s): $($bad -join ', ')"
  }
}

function Write-AutopilotGitPrecheck {
  param(
    [Parameter(Mandatory=$true)][string]$Cwd,
    [Parameter(Mandatory=$true)][string]$OutFile
  )
  $commands = @(
    "git status --short --branch",
    "git rev-parse --short HEAD",
    "git rev-parse --short origin/road-to-V2",
    "git log --oneline -8",
    "git diff --stat",
    "git diff --name-only",
    "git diff --cached --stat",
    "git diff --cached --name-only",
    "git diff --check"
  )
  $content = New-Object System.Collections.Generic.List[string]
  Push-Location $Cwd
  try {
    foreach ($command in $commands) {
      $content.Add("### $command")
      $output = Invoke-Expression $command 2>&1
      if ($output) {
        foreach ($line in $output) { $content.Add([string]$line) }
      }
      $content.Add("")
    }
  } finally {
    Pop-Location
  }
  $parent = Split-Path -Parent $OutFile
  if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  $content | Set-Content -Encoding utf8 -Path $OutFile
}
