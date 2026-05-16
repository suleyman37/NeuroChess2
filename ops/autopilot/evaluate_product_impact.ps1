param(
  [Parameter(Mandatory = $true)][string]$InputPath
)

$ErrorActionPreference = "Stop"

function Has-Property {
  param($Object, [string]$Name)
  return ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name)
}

function As-Array {
  param($Value)
  if ($null -eq $Value) { return @() }
  if ($Value -is [string]) {
    if (-not $Value.Trim()) { return @() }
    return @($Value)
  }
  return @($Value)
}

function Text-HasValue {
  param($Value)
  return ([string]$Value).Trim().Length -gt 0
}

function Get-ScoreValue {
  param($Score, [string]$Name)
  if (-not (Has-Property $Score $Name)) { return 0 }
  try {
    $value = [int]$Score.$Name
    if ($value -lt 0) { return 0 }
    if ($value -gt 5) { return 5 }
    return $value
  } catch {
    return 0
  }
}

try {
  if (-not (Test-Path -LiteralPath $InputPath)) { throw "InputPath not found: $InputPath" }
  $review = Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json
  $warnings = [System.Collections.Generic.List[string]]::new()
  $violations = [System.Collections.Generic.List[string]]::new()

  $required = @(
    "schema_version",
    "mission_id",
    "mission_type",
    "friction_targeted",
    "friction_reduced",
    "friction_created",
    "potential_unlock_loop_steps",
    "potential_acceleration_score",
    "unlock_value",
    "revolutionary_value_verdict",
    "fake_progress_risk",
    "why_this_matters",
    "evidence",
    "recommended_next_action"
  )
  foreach ($field in $required) {
    if (-not (Has-Property $review $field)) { $violations.Add("missing required field: $field") | Out-Null }
  }
  if ((Has-Property $review "schema_version") -and $review.schema_version -ne "A16E") {
    $violations.Add("schema_version must be A16E") | Out-Null
  }

  $score = $review.potential_acceleration_score
  $axes = @("real_game_leverage", "active_effort", "feedback_quality", "transfer_probability", "personalization", "engagement_loop", "truthfulness")
  $computedTotal = 0
  foreach ($axis in $axes) { $computedTotal += Get-ScoreValue -Score $score -Name $axis }
  if ((Has-Property $score "total") -and [int]$score.total -ne $computedTotal) {
    $warnings.Add("score total recomputed: $($score.total) -> $computedTotal") | Out-Null
  }

  $frictionTargeted = @(As-Array $review.friction_targeted | ForEach-Object { [string]$_ } | Where-Object { $_ })
  $frictionReduced = @(As-Array $review.friction_reduced | ForEach-Object { [string]$_ } | Where-Object { $_ })
  $loopSteps = @(As-Array $review.potential_unlock_loop_steps | ForEach-Object { [string]$_ } | Where-Object { $_ })
  $evidence = @(As-Array $review.evidence | ForEach-Object { [string]$_ } | Where-Object { $_ })
  $unlockValue = ([string]$review.unlock_value).Trim().ToLowerInvariant()
  $missionType = ([string]$review.mission_type).Trim().ToUpperInvariant()
  $fakeRisk = ([string]$review.fake_progress_risk).Trim().ToLowerInvariant()
  $verdict = ([string]$review.revolutionary_value_verdict).Trim().ToUpperInvariant()

  $isSafetyCritical = $missionType -in @("AUTOMATION_SAFETY", "PRODUCT_ENABLER")
  if ($frictionTargeted.Count -eq 0 -and -not $isSafetyCritical) {
    $warnings.Add("no product friction targeted") | Out-Null
  }
  if ($frictionReduced.Count -eq 0) {
    $warnings.Add("no product friction reduced") | Out-Null
  }

  if ($unlockValue -eq "infra_only") {
    $unlockMission = ""
    if (Has-Property $review "unlocks_product_mission") { $unlockMission = [string]$review.unlocks_product_mission }
    if (-not (Text-HasValue $unlockMission)) {
      $violations.Add("infra_only review must name a specific product mission it unlocks") | Out-Null
    } else {
      $warnings.Add("infra_only accepted because it unlocks: $unlockMission") | Out-Null
    }
  }

  if ($computedTotal -lt 10) {
    $warnings.Add("potential acceleration score below 10") | Out-Null
  }

  if ($fakeRisk -eq "high") {
    $violations.Add("fake_progress_risk is high") | Out-Null
  }

  if ($verdict -match "^YES" -and $evidence.Count -eq 0) {
    $violations.Add("revolutionary value claimed without evidence") | Out-Null
  }

  if ($missionType -match "FRONTEND" -and (Get-ScoreValue -Score $score -Name "engagement_loop") -eq 0 -and ($frictionTargeted.Count -eq 0 -or $loopSteps.Count -eq 0)) {
    $warnings.Add("frontend mission has no engagement loop or user clarity evidence") | Out-Null
  }

  $result = "PASS"
  if ($violations.Count -gt 0) {
    $result = "FAIL"
  } elseif ($computedTotal -lt 10 -or $frictionReduced.Count -eq 0 -or $unlockValue -eq "infra_only") {
    $result = "WARN"
  }

  if ($computedTotal -lt 10 -and $frictionTargeted.Count -eq 0) {
    $result = "STRATEGIC_PULSE_REQUIRED"
  }

  $recommended = [string]$review.recommended_next_action
  if ($violations.Count -gt 0 -and $fakeRisk -eq "high") { $recommended = "STOP" }
  elseif ($result -eq "STRATEGIC_PULSE_REQUIRED") { $recommended = "STRATEGIC_PULSE" }
  elseif ($result -eq "WARN" -and -not $recommended) { $recommended = "RETURN_TO_PRODUCT" }
  elseif (-not $recommended) { $recommended = "CONTINUE" }

  [ordered]@{
    product_gate_result = $result
    total_score = $computedTotal
    frictions_reduced = @($frictionReduced)
    loop_steps_advanced = @($loopSteps)
    warnings = @($warnings)
    violations = @($violations)
    recommended_next_action = $recommended
    unlock_value = $unlockValue
    revolutionary_value_verdict = $verdict
    fake_progress_risk = $fakeRisk
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 20
  if ($result -eq "FAIL") { exit 1 }
  if ($result -eq "STRATEGIC_PULSE_REQUIRED") { exit 2 }
  exit 0
} catch {
  [ordered]@{
    product_gate_result = "FAIL"
    total_score = 0
    frictions_reduced = @()
    loop_steps_advanced = @()
    warnings = @()
    violations = @($_.Exception.Message)
    recommended_next_action = "STOP"
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
