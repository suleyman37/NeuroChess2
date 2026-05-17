param(
  [string]$InputPath = "",
  [string]$ResultJson = "",
  [string]$ReportRoot = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\rolling_loop_dry_runs"
)

$ErrorActionPreference = "Stop"

function Read-Result {
  if ($ResultJson) { return ($ResultJson | ConvertFrom-Json) }
  if ($InputPath) {
    if (-not (Test-Path -LiteralPath $InputPath)) { throw "InputPath not found: $InputPath" }
    return (Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json)
  }
  throw "Provide -InputPath or -ResultJson."
}

function Get-Value {
  param($Object, [string]$Name, $Default = "")
  if ($null -eq $Object) { return $Default }
  $property = $Object.PSObject.Properties[$Name]
  if ($property) { return $property.Value }
  return $Default
}

try {
  $result = Read-Result
  $scenarioName = [string](Get-Value $result "scenario_name" "unknown")
  $stamp = Get-Date -Format "yyyyMMdd_HHmmss"
  $safeScenario = ($scenarioName -replace "[^A-Za-z0-9_.-]", "_")
  $runDir = Join-Path $ReportRoot ("A18_rolling_loop_{0}_{1}" -f $safeScenario, $stamp)
  New-Item -ItemType Directory -Force -Path $runDir | Out-Null

  $jsonReportPath = Join-Path $runDir "rolling_loop_dryrun_report.json"
  $mdReportPath = Join-Path $runDir "rolling_loop_dryrun_report.md"
  $result | Add-Member -Force -NotePropertyName "report_dir" -NotePropertyValue $runDir
  $result | Add-Member -Force -NotePropertyName "report_path" -NotePropertyValue $jsonReportPath
  $result | Add-Member -Force -NotePropertyName "markdown_report_path" -NotePropertyValue $mdReportPath

  $result | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $jsonReportPath -Encoding UTF8

  $accepted = @(Get-Value $result "missions_accepted" @()).Count
  $rejected = @(Get-Value $result "missions_rejected" @()).Count
  $lines = [System.Collections.Generic.List[string]]::new()
  $lines.Add("# Rolling Loop Controller Dry Run Report") | Out-Null
  $lines.Add("") | Out-Null
  $lines.Add("Session: $($result.session_id)") | Out-Null
  $lines.Add("Scenario: $scenarioName") | Out-Null
  $lines.Add("Initial phase: $($result.initial_phase)") | Out-Null
  $lines.Add("Final phase: $($result.final_phase)") | Out-Null
  $lines.Add("Final verdict: $($result.final_verdict)") | Out-Null
  $lines.Add("Stop reason: $($result.stop_reason)") | Out-Null
  $lines.Add("Missions proposed: $($result.missions_proposed)") | Out-Null
  $lines.Add("Missions accepted: $accepted") | Out-Null
  $lines.Add("Missions rejected: $rejected") | Out-Null
  $lines.Add("Live ChatGPT called: no") | Out-Null
  $lines.Add("Live Gemini called: no") | Out-Null
  $lines.Add("Product mission executed: no") | Out-Null
  $lines.Add("") | Out-Null
  $lines.Add("What would happen next in live mode: $($result.what_would_happen_next)") | Out-Null
  $lines.Add("") | Out-Null
  $lines.Add("JSON report: $jsonReportPath") | Out-Null
  $lines | Set-Content -LiteralPath $mdReportPath -Encoding UTF8

  $result | ConvertTo-Json -Depth 80
  exit 0
} catch {
  [ordered]@{
    status = "fail"
    error = $_.Exception.Message
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 20
  exit 1
}
