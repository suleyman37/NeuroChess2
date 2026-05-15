param(
  [string]$ScreenshotDir,
  [string]$RunDir,
  [string]$Brief = "",
  [string]$Model = "qwen2.5vl:7b"
)

. "$PSScriptRoot\lib.ps1"

if (-not $RunDir) { $RunDir = New-AutopilotRunDir -Name "vision_critic" }

$screenshots = @()
if ($ScreenshotDir -and (Test-Path $ScreenshotDir)) {
  $screenshots = Get-ChildItem $ScreenshotDir -File -Include *.png,*.jpg,*.jpeg -Recurse
}

$result = [ordered]@{
  verdict = "pass"
  layout_issues = @()
  misleading_copy = @()
  cheap_rpg_risk = $false
  visual_regression_risk = $false
  confidence = 1.0
  critic_unavailable = $false
  model = $Model
}

if ($screenshots.Count -eq 0) {
  Write-AutopilotJson -Path (Join-Path $RunDir "vision_critic.json") -Value $result
  $result | ConvertTo-Json -Depth 12
  exit 0
}

$ollama = Get-OllamaExe
if (-not $ollama) {
  $result.verdict = "soft_fail"
  $result.critic_unavailable = $true
  $result.confidence = 0.1
  $result.layout_issues += "Ollama executable not available for screenshot review."
  Write-AutopilotJson -Path (Join-Path $RunDir "vision_critic.json") -Value $result
  $result | ConvertTo-Json -Depth 12
  exit 0
}

$models = & $ollama list 2>$null
if (-not ($models -match [regex]::Escape($Model))) {
  $result.verdict = "soft_fail"
  $result.critic_unavailable = $true
  $result.confidence = 0.1
  $result.layout_issues += "Vision model '$Model' is not installed."
  Write-AutopilotJson -Path (Join-Path $RunDir "vision_critic.json") -Value $result
  $result | ConvertTo-Json -Depth 12
  exit 0
}

$result.verdict = "soft_fail"
$result.layout_issues += "Vision model is installed but automated multimodal invocation is not enabled in bootstrap."
$result.confidence = 0.3
Write-AutopilotJson -Path (Join-Path $RunDir "vision_critic.json") -Value $result
$result | ConvertTo-Json -Depth 12
exit 0
