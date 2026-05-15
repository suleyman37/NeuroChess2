param(
  [string]$RepoUrl = "https://github.com/suleyman37/NeuroChess2.git",
  [string]$Branch = "road-to-V2",
  [switch]$PullModels,
  [switch]$AllowLanOllama
)

$ErrorActionPreference = "Continue"

$devRoot = Join-Path $env:USERPROFILE "Documents\Dev"
$workerRepo = Join-Path $devRoot "NeuroChess2_worker"
$artifactRoot = Join-Path $devRoot "NeuroChess_QA_Artifacts\worker_setup"
$reportPath = Join-Path $artifactRoot "setup_report.txt"
$report = New-Object System.Collections.Generic.List[string]

function Add-ReportLine {
  param([string]$Line)
  $script:report.Add(("$(Get-Date -Format o) $Line")) | Out-Null
  Write-Host $Line
}

function Ensure-WingetPackage {
  param(
    [string]$CommandName,
    [string]$PackageId
  )

  if (Get-Command $CommandName -ErrorAction SilentlyContinue) {
    Add-ReportLine "OK: $CommandName already available."
    return
  }

  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    Add-ReportLine "WARN: winget unavailable; cannot install $PackageId automatically."
    return
  }

  Add-ReportLine "Installing $PackageId via winget..."
  winget install --id $PackageId --exact --silent --accept-package-agreements --accept-source-agreements
  if ($LASTEXITCODE -eq 0) {
    Add-ReportLine "OK: winget install completed for $PackageId."
  } else {
    Add-ReportLine "WARN: winget install returned exit code $LASTEXITCODE for $PackageId."
  }
}

New-Item -ItemType Directory -Force -Path $devRoot | Out-Null
New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null

Add-ReportLine "Starting NeuroChess GPU critic worker bootstrap."
Add-ReportLine "Worker repo target: $workerRepo"
Add-ReportLine "Branch: $Branch"
Add-ReportLine "Security: this worker must not commit or push product branches."

Ensure-WingetPackage -CommandName "git" -PackageId "Git.Git"
Ensure-WingetPackage -CommandName "node" -PackageId "OpenJS.NodeJS.LTS"
Ensure-WingetPackage -CommandName "python" -PackageId "Python.Python.3.12"
Ensure-WingetPackage -CommandName "ollama" -PackageId "Ollama.Ollama"

if (Test-Path $workerRepo) {
  Add-ReportLine "Repo exists; fetching latest refs."
  git -C $workerRepo fetch origin
} else {
  Add-ReportLine "Cloning repo for worker read-only use."
  git clone $RepoUrl $workerRepo
}

if (Test-Path $workerRepo) {
  git -C $workerRepo checkout $Branch
  git -C $workerRepo pull --ff-only origin $Branch
  git -C $workerRepo remote set-url --push origin "DISABLED_GPU_WORKER_NO_PUSH"
  Add-ReportLine "Repo checkout ready. Push URL disabled for worker safety."
}

if (Test-Path (Join-Path $workerRepo "frontend\package.json")) {
  Add-ReportLine "Installing frontend dependencies."
  cmd /c npm.cmd --prefix "$workerRepo\frontend" install
  Add-ReportLine "npm install exit code: $LASTEXITCODE"
}

$venvPython = Join-Path $workerRepo ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPython)) {
  Add-ReportLine "Creating Python venv."
  if (Get-Command py -ErrorAction SilentlyContinue) {
    py -m venv (Join-Path $workerRepo ".venv")
  } else {
    python -m venv (Join-Path $workerRepo ".venv")
  }
  Add-ReportLine "venv creation exit code: $LASTEXITCODE"
} else {
  Add-ReportLine "Python venv already exists."
}

$requirements = Join-Path $workerRepo "requirements.txt"
if ((Test-Path $venvPython) -and (Test-Path $requirements)) {
  Add-ReportLine "Installing Python requirements."
  & $venvPython -m pip install -r $requirements
  Add-ReportLine "pip install exit code: $LASTEXITCODE"
} elseif (-not (Test-Path $requirements)) {
  Add-ReportLine "No root requirements.txt found; skipping pip install."
}

if (Get-Command ollama -ErrorAction SilentlyContinue) {
  $ollamaVersion = (& ollama --version 2>&1) -join "`n"
  Add-ReportLine "Ollama available: $ollamaVersion"

  if ($AllowLanOllama) {
    Add-ReportLine "AllowLanOllama requested. Opening TCP 11434 to LocalSubnet only."
    New-NetFirewallRule -DisplayName "NeuroChess Ollama LAN 11434" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 11434 -RemoteAddress LocalSubnet -ErrorAction SilentlyContinue | Out-Null
    Add-ReportLine "Firewall rule attempted. Confirm Windows profile and Ollama host binding manually."
  } else {
    Add-ReportLine "Firewall unchanged. Keep Ollama LAN-only; do not expose it publicly."
  }

  if ($PullModels) {
    $models = @("qwen2.5-coder:14b", "qwen2.5-coder:7b", "llama3.1:8b", "qwen2.5vl:7b", "llava:7b")
    foreach ($model in $models) {
      Add-ReportLine "Pulling Ollama model candidate: $model"
      ollama pull $model
      Add-ReportLine "ollama pull $model exit code: $LASTEXITCODE"
    }
  } else {
    Add-ReportLine "Model pulls skipped. Re-run with -PullModels to fetch critic candidates."
  }
} else {
  Add-ReportLine "WARN: Ollama command unavailable after install attempt."
}

Add-ReportLine "Done. Next on PC1: register_worker_endpoint.ps1, then test_remote_worker.ps1."
Set-Content -LiteralPath $reportPath -Value $report -Encoding UTF8
Write-Host "Report written to $reportPath"
