param(
  [string]$TournamentPath
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Resolve-PathFromRepo {
  param([string]$Path)
  if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
  return (Join-Path (Get-RepoRoot) $Path)
}

if (-not $TournamentPath) { throw "TournamentPath is required" }
$tournament = Get-Content -LiteralPath (Resolve-PathFromRepo -Path $TournamentPath) -Raw | ConvertFrom-Json
$scores = @($tournament.candidate_scores)
$margin = 10
if ($tournament.thresholds -and $tournament.thresholds.clear_winner_margin) { $margin = [int]$tournament.thresholds.clear_winner_margin }

$ranking = @($scores | Sort-Object `
  @{ Expression = { [int]$_.hard_gates_pass }; Descending = $true }, `
  @{ Expression = { [int]$_.design_score + [int]$_.taste_proxy_score - [int]$_.generic_saas_drift + [int]$_.learning_loop_support_score }; Descending = $true })

$valid = @($ranking | Where-Object {
  $_.verdict -eq "AUTO_PASS_DESIGN" -and
  [bool]$_.hard_gates_pass -and
  [int]$_.design_score -ge 80 -and
  [int]$_.taste_proxy_score -ge 75 -and
  [int]$_.generic_saas_drift -le 25
})

$reasons = New-Object System.Collections.Generic.List[string]
$winnerId = $null

if ($valid.Count -eq 0) {
  $genericBlocks = @($scores | Where-Object { $_.verdict -eq "AUTO_BLOCK_GENERIC_UI" -or [int]$_.generic_saas_drift -ge 60 })
  if ($genericBlocks.Count -eq $scores.Count -and $scores.Count -gt 0) {
    $resultName = "BLOCK_GENERIC_UI"
    $reasons.Add("all_candidates_generic_or_blocked") | Out-Null
  } else {
    $resultName = "NO_WINNER"
    $reasons.Add("no_candidate_passed_hard_gates") | Out-Null
  }
} else {
  $top = $valid[0]
  $winnerId = [string]$top.candidate_id
  if ($valid.Count -eq 1) {
    $resultName = "WINNER_SELECTED"
    $reasons.Add("single_valid_candidate") | Out-Null
  } else {
    $second = $valid[1]
    $topTotal = [int]$top.design_score + [int]$top.taste_proxy_score - [int]$top.generic_saas_drift + [int]$top.learning_loop_support_score
    $secondTotal = [int]$second.design_score + [int]$second.taste_proxy_score - [int]$second.generic_saas_drift + [int]$second.learning_loop_support_score
    if (($topTotal - $secondTotal) -ge $margin) {
      $resultName = "WINNER_SELECTED"
      $reasons.Add("clear_winner_margin_met") | Out-Null
    } elseif ([int]$top.learning_loop_support_score -gt [int]$second.learning_loop_support_score) {
      $resultName = "WINNER_SELECTED"
      $reasons.Add("close_score_learning_loop_tiebreak") | Out-Null
    } else {
      $resultName = "NEEDS_HUMAN_REVIEW_AFTER_RUN"
      $winnerId = $null
      $reasons.Add("no_safe_autonomous_tiebreak") | Out-Null
    }
  }
}

$result = [ordered]@{
  tournament_result = $resultName
  winner_id = $winnerId
  ranking = @($ranking | ForEach-Object { $_.candidate_id })
  reasons = @($reasons)
  runtime_user_input_required = $false
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
if ($resultName -eq "BLOCK_GENERIC_UI" -or $resultName -eq "NO_WINNER") { exit 2 }
exit 0
