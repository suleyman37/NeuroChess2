param(
  [string]$Cwd,
  [string]$RunDir,
  [string]$TaskJson,
  [string]$Model = "gpt-oss:20b"
)

. "$PSScriptRoot\lib.ps1"

if (-not $Cwd) { $Cwd = Get-AutopilotRepoRoot }
if (-not $RunDir) { $RunDir = New-AutopilotRunDir -Name "text_critic" }

$result = [ordered]@{
  verdict = "pass"
  reasons = @()
  forbidden_change_detected = $false
  scope_violation = $false
  confidence = 0.1
  suggested_next_action = "continue_with_deterministic_checks"
  critic_unavailable = $false
  model = $Model
}

$ollama = Get-OllamaExe
if (-not $ollama) {
  $result.critic_unavailable = $true
  $result.reasons += "Ollama executable not available."
  Write-AutopilotJson -Path (Join-Path $RunDir "text_critic.json") -Value $result
  $result | ConvertTo-Json -Depth 12
  exit 0
}

$models = & $ollama list 2>$null
if (-not ($models -match [regex]::Escape($Model))) {
  $result.critic_unavailable = $true
  $result.reasons += "Model '$Model' is not installed; deterministic checks remain authoritative for docs/tooling."
  Write-AutopilotJson -Path (Join-Path $RunDir "text_critic.json") -Value $result
  $result | ConvertTo-Json -Depth 12
  exit 0
}

$diffParts = @()
$diffParts += git -C $Cwd diff --stat
$diffParts += git -C $Cwd diff --name-only
$diffParts += git -C $Cwd diff
$diff = $diffParts -join "`n"
$prompt = @"
You are a local NeuroChess repository critic. Return strict JSON only:
{
  "verdict": "pass|soft_fail|hard_fail",
  "reasons": [],
  "forbidden_change_detected": false,
  "scope_violation": false,
  "confidence": 0.0,
  "suggested_next_action": "continue|quarantine|stop"
}

Task:
$TaskJson

Diff:
$diff
"@

$promptFile = Join-Path $RunDir "text_critic_prompt.txt"
$prompt | Set-Content -Encoding utf8 -Path $promptFile
$raw = & $ollama run $Model $prompt 2>&1
$rawPath = Join-Path $RunDir "text_critic_raw.txt"
$raw | Set-Content -Encoding utf8 -Path $rawPath

try {
  $parsed = ($raw -join "`n") | ConvertFrom-Json
  Write-AutopilotJson -Path (Join-Path $RunDir "text_critic.json") -Value $parsed
  $parsed | ConvertTo-Json -Depth 12
  exit $(if ($parsed.verdict -eq "hard_fail") { 1 } else { 0 })
} catch {
  $result.verdict = "soft_fail"
  $result.reasons += "Model output was not valid JSON. See $rawPath"
  $result.suggested_next_action = "quarantine_if_policy_requires_critic"
  Write-AutopilotJson -Path (Join-Path $RunDir "text_critic.json") -Value $result
  $result | ConvertTo-Json -Depth 12
  exit 0
}
