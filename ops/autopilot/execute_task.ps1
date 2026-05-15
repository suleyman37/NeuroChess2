param(
  [Parameter(Mandatory=$true)][string]$TaskJson,
  [Parameter(Mandatory=$true)][string]$Worktree,
  [Parameter(Mandatory=$true)][string]$RunDir
)

. "$PSScriptRoot\lib.ps1"

$task = $TaskJson | ConvertFrom-Json
$result = [ordered]@{
  task_id = $task.id
  status = "unknown"
  executor = "none"
  notes = @()
}

if ($task.id -eq "A0_HARNESS_DRYRUN" -or $task.type -eq "autopilot_dryrun") {
  $result.status = "pass"
  $result.executor = "deterministic_dryrun"
  $result.notes += "Dry run only: worktree creation, git hygiene, checks, and reporting are exercised."
  Write-AutopilotJson -Path (Join-Path $RunDir "execute_result.json") -Value $result
  $result | ConvertTo-Json -Depth 8
  exit 0
}

$promptPath = $task.prompt_file_or_inline
if ($promptPath -and (Test-Path (Join-Path (Get-AutopilotRepoRoot) $promptPath))) {
  $prompt = Get-Content -Raw (Join-Path (Get-AutopilotRepoRoot) $promptPath)
} else {
  $prompt = [string]$promptPath
}

if (-not $prompt) {
  $result.status = "fail"
  $result.notes += "No prompt was provided."
  Write-AutopilotJson -Path (Join-Path $RunDir "execute_result.json") -Value $result
  $result | ConvertTo-Json -Depth 8
  exit 1
}

$codex = Get-Command codex.cmd -ErrorAction SilentlyContinue
if (-not $codex) {
  $codex = Get-Command codex -ErrorAction SilentlyContinue
}
if (-not $codex) {
  $result.status = "fail"
  $result.notes += "Codex CLI is not installed."
  Write-AutopilotJson -Path (Join-Path $RunDir "execute_result.json") -Value $result
  $result | ConvertTo-Json -Depth 8
  exit 1
}

$promptFile = Join-Path $RunDir "task_prompt.md"
$prompt | Set-Content -Encoding utf8 -Path $promptFile
$log = Join-Path $RunDir "codex_exec.log"

Push-Location $Worktree
try {
  cmd /c codex exec --cd "$Worktree" --sandbox workspace-write --ask-for-approval on-request --json -- "$prompt" 2>&1 |
    Tee-Object -FilePath $log
  $code = $LASTEXITCODE
} finally {
  Pop-Location
}

$result.executor = "codex_cli"
$result.status = if ($code -eq 0) { "pass" } else { "fail" }
$result.notes += "Codex CLI exit code: $code"
Write-AutopilotJson -Path (Join-Path $RunDir "execute_result.json") -Value $result
$result | ConvertTo-Json -Depth 8
exit $code
