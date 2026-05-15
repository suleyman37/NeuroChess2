param(
  [string]$Profile = "docs_only",
  [string]$Cwd,
  [string]$RunDir,
  [switch]$PreflightOnly
)

. "$PSScriptRoot\lib.ps1"

if (-not $Cwd) { $Cwd = Get-AutopilotRepoRoot }
if (-not $RunDir) { $RunDir = New-AutopilotRunDir -Name "checks_$Profile" }

$results = [ordered]@{
  profile = $Profile
  cwd = $Cwd
  run_dir = $RunDir
  checks = @()
  verdict = "pass"
}

function Add-CheckResult {
  param([string]$Name, [int]$ExitCode, [string]$Log)
  $script:results.checks += [ordered]@{ name = $Name; exit_code = $ExitCode; log = $Log }
  if ($ExitCode -ne 0) { $script:results.verdict = "fail" }
}

Write-AutopilotGitPrecheck -Cwd $Cwd -OutFile (Join-Path $RunDir "git_precheck.txt")

if ($PreflightOnly) {
  Write-AutopilotJson -Path (Join-Path $RunDir "checks.json") -Value $results
  $results | ConvertTo-Json -Depth 12
  exit 0
}

try {
  Assert-NoForbiddenChangedPath -Cwd $Cwd
} catch {
  $results.checks += [ordered]@{ name = "forbidden_path_guard"; exit_code = 1; log = [string]$_ }
  $results.verdict = "fail"
}

$log = Join-Path $RunDir "git_diff_check.log"
$code = Invoke-AutopilotLogged -Command "git diff --check" -Cwd $Cwd -LogPath $log
Add-CheckResult -Name "git diff --check" -ExitCode $code -Log $log

if ($Profile -eq "path_guard") {
  Write-AutopilotJson -Path (Join-Path $RunDir "checks.json") -Value $results
  $results | ConvertTo-Json -Depth 12
  exit $(if ($results.verdict -eq "pass") { 0 } else { 1 })
}

$changed = Get-AutopilotChangedPaths -Cwd $Cwd
$touchesDocsRebuild = $changed | Where-Object { $_ -like "docs/rebuild/*" }

if ($Profile -eq "docs_only" -and $touchesDocsRebuild) {
  $python = if ($env:NEUROCHESS_PYTHON) { $env:NEUROCHESS_PYTHON } else { ".venv\Scripts\python.exe" }
  $planGuardLog = Join-Path $RunDir "plan_guard.log"
  if (Test-Path (Join-Path $Cwd $python)) {
    $code = Invoke-AutopilotLogged -Command "$python tools\plan_guard.py" -Cwd $Cwd -LogPath $planGuardLog
  } else {
    $code = Invoke-AutopilotLogged -Command "python tools\plan_guard.py" -Cwd $Cwd -LogPath $planGuardLog
  }
  Add-CheckResult -Name "plan_guard" -ExitCode $code -Log $planGuardLog
}

if ($Profile -eq "frontend_readonly") {
  Add-CheckResult -Name "frontend build" -ExitCode (Invoke-AutopilotLogged -Command "npm.cmd --prefix frontend run build" -Cwd $Cwd -LogPath (Join-Path $RunDir "frontend_build.log")) -Log (Join-Path $RunDir "frontend_build.log")
  Add-CheckResult -Name "frontend tsc" -ExitCode (Invoke-AutopilotLogged -Command "npx.cmd --prefix frontend tsc --noEmit" -Cwd $Cwd -LogPath (Join-Path $RunDir "frontend_tsc.log")) -Log (Join-Path $RunDir "frontend_tsc.log")
}

if ($Profile -eq "backend_readonly" -or $Profile -eq "full_sensitive") {
  $python = if ($env:NEUROCHESS_PYTHON) { $env:NEUROCHESS_PYTHON } else { ".venv\Scripts\python.exe" }
  Add-CheckResult -Name "backend tests" -ExitCode (Invoke-AutopilotLogged -Command "$python -m unittest discover backend/tests" -Cwd $Cwd -LogPath (Join-Path $RunDir "backend_tests.log")) -Log (Join-Path $RunDir "backend_tests.log")
}

Write-AutopilotJson -Path (Join-Path $RunDir "checks.json") -Value $results
$results | ConvertTo-Json -Depth 12
exit $(if ($results.verdict -eq "pass") { 0 } else { 1 })
