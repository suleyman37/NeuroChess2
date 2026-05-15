param(
  [string]$MissionId = "SUPERVISOR_DRY_RUN",
  [string]$PreviousMicroPrompt = "",
  [string]$CodexReport = "",
  [string]$OutRoot = ""
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
if (-not $OutRoot) {
  $preferred = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\evidence"
  try {
    New-Item -ItemType Directory -Force -Path $preferred | Out-Null
    $OutRoot = $preferred
  } catch {
    $OutRoot = Join-Path $repoRoot "ops\autopilot\evidence\generated"
  }
}

$pack = Join-Path $OutRoot ("{0}_{1}" -f (Get-Date -Format "yyyyMMdd_HHmmss"), $MissionId)
New-Item -ItemType Directory -Force -Path $pack | Out-Null

$nonce = "NC_" + ([guid]::NewGuid().ToString("N"))
Set-Content -LiteralPath (Join-Path $pack "mission_id.txt") -Value $MissionId -Encoding UTF8
Set-Content -LiteralPath (Join-Path $pack "nonce.txt") -Value $nonce -Encoding UTF8
Set-Content -LiteralPath (Join-Path $pack "previous_micro_prompt.md") -Value $PreviousMicroPrompt -Encoding UTF8

if ($CodexReport -and (Test-Path $CodexReport)) {
  Copy-Item -LiteralPath $CodexReport -Destination (Join-Path $pack "codex_report.md") -Force
} else {
  Set-Content -LiteralPath (Join-Path $pack "codex_report.md") -Value "No Codex report supplied." -Encoding UTF8
}

git -C $repoRoot status --short --branch | Set-Content -LiteralPath (Join-Path $pack "git_status.txt") -Encoding UTF8
git -C $repoRoot diff --stat | Set-Content -LiteralPath (Join-Path $pack "diff_stat.txt") -Encoding UTF8
git -C $repoRoot diff --name-only | Set-Content -LiteralPath (Join-Path $pack "changed_files.txt") -Encoding UTF8
git -C $repoRoot diff | Set-Content -LiteralPath (Join-Path $pack "patch.diff") -Encoding UTF8

$checks = @"
# Checks Summary

No live checks were run by build_evidence_pack.ps1.
This evidence pack is safe for supervisor dry-run and protocol validation.
"@
Set-Content -LiteralPath (Join-Path $pack "checks_summary.md") -Value $checks -Encoding UTF8
Set-Content -LiteralPath (Join-Path $pack "alarm_report.md") -Value "No alarm report supplied." -Encoding UTF8

$projectState = @"
# Project State

- Repo: $repoRoot
- Branch: $(git -C $repoRoot branch --show-current)
- HEAD: $(git -C $repoRoot rev-parse --short HEAD)
- Origin road-to-V2: $(git -C $repoRoot rev-parse --short origin/road-to-V2)
- Supervisor bridge mode: dry-run by default
- Product mission execution: forbidden in this pack
"@
Set-Content -LiteralPath (Join-Path $pack "project_state.md") -Value $projectState -Encoding UTF8

$question = @"
Use nonce: $nonce

Review the evidence pack and return exactly one NC_SUPERVISOR_RESPONSE.
For dry-run protocol tests, choose a small safe micro-prompt or STOP.
"@
Set-Content -LiteralPath (Join-Path $pack "question_for_chatgpt.md") -Value $question -Encoding UTF8

$result = [ordered]@{
  status = "pass"
  evidence_pack = $pack
  nonce = $nonce
  external = ($pack -notlike "$repoRoot*")
}

$result | ConvertTo-Json -Depth 8
