param(
  [Parameter(Mandatory = $true)][string]$LedgerPath,
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"

function As-Array {
  param($Value)
  if ($null -eq $Value) { return @() }
  if ($Value -is [string]) {
    if (-not $Value.Trim()) { return @() }
    return @($Value)
  }
  return @($Value)
}

try {
  if (-not (Test-Path -LiteralPath $LedgerPath)) { throw "LedgerPath not found: $LedgerPath" }
  if (-not $OutDir) {
    $OutDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\prompt_ledger_analysis" (Get-Date -Format "yyyyMMdd_HHmmss")
  }
  New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

  $entries = @()
  foreach ($line in (Get-Content -LiteralPath $LedgerPath)) {
    if (-not $line.Trim()) { continue }
    $entries += ($line | ConvertFrom-Json)
  }
  $total = $entries.Count
  $scores = @($entries | ForEach-Object { [int]$_.prompt_execution_score })
  $average = if ($scores.Count -gt 0) { [math]::Round((($scores | Measure-Object -Average).Average), 2) } else { 0 }

  $failureGroups = @($entries | Where-Object { [string]$_.stop_reason } | Group-Object stop_reason | Sort-Object Count -Descending | ForEach-Object { [ordered]@{ code = $_.Name; count = $_.Count } })
  $repairCount = @($entries | Where-Object { [bool]$_.repair_used }).Count
  $contractMismatchCount = @($entries | Where-Object { [string]$_.mission_contract_result -match "MISMATCH|FAIL|STOP" }).Count
  $lowProductCount = @($entries | Where-Object { [string]$_.product_gate_result -match "FAIL|LOW|NO|STRATEGIC_PULSE_REQUIRED" }).Count
  $formatGroups = @($entries | Group-Object prompt_format | Sort-Object Count -Descending | ForEach-Object { [ordered]@{ format = $_.Name; count = $_.Count; average_score = [math]::Round((($_.Group | ForEach-Object { [int]$_.prompt_execution_score } | Measure-Object -Average).Average), 2) } })

  $recommendation = "Keep measuring prompt outcomes."
  if ($contractMismatchCount -gt 0) { $recommendation = "Improve contract alignment before execution." }
  elseif ($repairCount -gt 0) { $recommendation = "Tighten prompt format to avoid repair." }
  elseif ($lowProductCount -gt 0) { $recommendation = "Require stronger friction/product value declaration." }

  $summary = [ordered]@{
    total_prompts = $total
    average_score = $average
    most_common_failure_codes = @($failureGroups)
    prompts_requiring_repair = $repairCount
    prompts_causing_contract_mismatch = $contractMismatchCount
    prompts_with_low_product_value = $lowProductCount
    best_performing_prompt_formats = @($formatGroups | Sort-Object average_score -Descending)
    recommended_next_prompt_style_improvement = $recommendation
    json_summary_path = (Join-Path $OutDir "prompt_ledger_analysis.json")
    markdown_summary_path = (Join-Path $OutDir "prompt_ledger_analysis.md")
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  }

  $summary | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $summary.json_summary_path -Encoding UTF8
  $md = @(
    "# Prompt Ledger Analysis",
    "",
    "- Total prompts: $total",
    "- Average score: $average",
    "- Prompts requiring repair: $repairCount",
    "- Contract mismatches: $contractMismatchCount",
    "- Low product value: $lowProductCount",
    "- Recommendation: $recommendation"
  )
  $md | Set-Content -LiteralPath $summary.markdown_summary_path -Encoding UTF8
  $summary | ConvertTo-Json -Depth 20
  exit 0
} catch {
  [ordered]@{
    total_prompts = 0
    average_score = 0
    most_common_failure_codes = @()
    prompts_requiring_repair = 0
    prompts_causing_contract_mismatch = 0
    prompts_with_low_product_value = 0
    best_performing_prompt_formats = @()
    recommended_next_prompt_style_improvement = "Fix malformed ledger or input path."
    error = $_.Exception.Message
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
