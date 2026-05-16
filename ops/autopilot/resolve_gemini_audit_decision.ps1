param(
  [string]$InputPath = "",
  [string]$ValidatedResponseJson = "",
  [string]$GateStatusPath = "",
  [string]$GateStatusJson = ""
)

$ErrorActionPreference = "Stop"

function Read-JsonValue {
  param([string]$Path, [string]$RawJson, [string]$Description)
  if ($RawJson) { return ($RawJson | ConvertFrom-Json) }
  if ($Path) {
    if (-not (Test-Path -LiteralPath $Path)) { throw "$Description not found: $Path" }
    return (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json)
  }
  return $null
}

function Has-Property {
  param($Object, [string]$Name)
  return ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name)
}

function Add-Reason {
  param([System.Collections.Generic.List[string]]$Reasons, [string]$Message)
  $Reasons.Add($Message) | Out-Null
}

function Get-Field {
  param($Object, [string]$Name, $Default = $null)
  if (Has-Property $Object $Name) { return $Object.$Name }
  return $Default
}

function Test-PassLike {
  param($Value)
  if ($null -eq $Value) { return $true }
  $text = ([string]$Value).Trim()
  if ($text -eq "") { return $true }
  $passValues = @(
    "PASS",
    "MATCH",
    "ALLOW",
    "ALLOWED",
    "OK",
    "CONTINUE",
    "NONE",
    "NOT_REQUIRED",
    "NOT_RED",
    "QUARANTINE_OK"
  )
  return ($passValues -contains $text.ToUpperInvariant())
}

function Get-DeterministicFailures {
  param($GateStatus)
  $failures = [System.Collections.Generic.List[string]]::new()
  if (-not $GateStatus) { return @($failures) }

  $gateFields = @(
    "control_plane_result",
    "mission_contract_result",
    "prompt_firewall_result",
    "shadow_plan_result",
    "night_mode_scope_result",
    "red_tier_result"
  )

  foreach ($field in $gateFields) {
    $value = Get-Field -Object $GateStatus -Name $field
    if (-not (Test-PassLike -Value $value)) {
      $failures.Add("$field=$value") | Out-Null
    }
  }

  foreach ($flag in @("control_plane_hard_stop", "deterministic_hard_stop", "forbidden_path_touched", "red_tier_detected_outside_quarantine", "product_code_auto_merge_to_road_attempted")) {
    if ([bool](Get-Field -Object $GateStatus -Name $flag -Default $false)) {
      $failures.Add($flag) | Out-Null
    }
  }

  return @($failures)
}

function Test-BypassAttempt {
  param($Response, $GateStatus)
  $reasons = [System.Collections.Generic.List[string]]::new()
  foreach ($name in @("attempted_safety_bypass", "bypass_safety", "override_deterministic_gates", "gemini_can_override_deterministic_gates", "allow_product_auto_merge_to_road")) {
    if ([bool](Get-Field -Object $Response -Name $name -Default $false)) {
      $reasons.Add("Gemini response attempted safety bypass: $name") | Out-Null
    }
  }
  if ($GateStatus -and [bool](Get-Field -Object $GateStatus -Name "bypass_safety_requested" -Default $false)) {
    $reasons.Add("Gate status reports attempted safety bypass") | Out-Null
  }
  $raw = ($Response | ConvertTo-Json -Depth 20)
  if ($raw -match "(?i)ignore\s+(mission contract|prompt firewall|shadow plan|control plane|night mode)") {
    $reasons.Add("Gemini response text attempts to ignore deterministic gates") | Out-Null
  }
  if ($raw -match "(?i)git add -A|product-code auto-merge|auto-merge product code") {
    $reasons.Add("Gemini response text contains forbidden execution bypass language") | Out-Null
  }
  return @($reasons)
}

function Test-VisualEvidenceReady {
  param($GateStatus)
  if (-not $GateStatus) { return $false }
  $artifactsPresent = [bool](Get-Field -Object $GateStatus -Name "visual_artifacts_present" -Default $false)
  $screenshots = [bool](Get-Field -Object $GateStatus -Name "screenshots_present" -Default $artifactsPresent)
  $contactSheet = [bool](Get-Field -Object $GateStatus -Name "contact_sheet_present" -Default $artifactsPresent)
  $brief = [bool](Get-Field -Object $GateStatus -Name "visual_review_brief_present" -Default $artifactsPresent)
  return ($screenshots -and $contactSheet -and $brief)
}

try {
  $inputObject = Read-JsonValue -Path $InputPath -RawJson $ValidatedResponseJson -Description "Gemini decision input"
  if (-not $inputObject) { throw "Provide -InputPath or -ValidatedResponseJson." }

  $response = $inputObject
  $gateStatus = Read-JsonValue -Path $GateStatusPath -RawJson $GateStatusJson -Description "Gate status"
  if (Has-Property $inputObject "validated_response") {
    $response = $inputObject.validated_response
    if (-not $gateStatus -and (Has-Property $inputObject "gate_status")) {
      $gateStatus = $inputObject.gate_status
    }
  }

  $reasons = [System.Collections.Generic.List[string]]::new()
  $deterministicOverride = $false
  $decision = "STOP_DETERMINISTIC_GATE"
  $nextAction = "stop before execution"
  $verdict = [string](Get-Field -Object $response -Name "verdict" -Default "")

  if (-not [bool](Get-Field -Object $response -Name "valid" -Default $false)) {
    Add-Reason -Reasons $reasons -Message "Gemini response is not validated as valid"
    $deterministicOverride = $true
  }

  $bypassReasons = Test-BypassAttempt -Response $response -GateStatus $gateStatus
  foreach ($reason in $bypassReasons) {
    Add-Reason -Reasons $reasons -Message $reason
    $deterministicOverride = $true
  }

  $gateFailures = Get-DeterministicFailures -GateStatus $gateStatus
  foreach ($failure in $gateFailures) {
    Add-Reason -Reasons $reasons -Message "deterministic gate failed: $failure"
    $deterministicOverride = $true
  }

  if ($verdict -eq "PASS_VISUAL" -and -not (Test-VisualEvidenceReady -GateStatus $gateStatus)) {
    Add-Reason -Reasons $reasons -Message "PASS_VISUAL requires screenshots, contact sheet, and visual review brief"
    $deterministicOverride = $true
  }

  if ($deterministicOverride) {
    $decision = "STOP_DETERMINISTIC_GATE"
    $nextAction = "repair deterministic gate failure before any execution"
  } else {
    switch ($verdict) {
      "APPROVE" {
        $decision = "CONTINUE"
        $nextAction = "continue only under Control Plane authorization"
        Add-Reason -Reasons $reasons -Message "Gemini approved and deterministic gates passed"
      }
      "NARROW" {
        $decision = "REQUEST_PLANNER_NARROWING"
        $nextAction = "ask ChatGPT Planner to narrow or split; do not execute original prompt"
        Add-Reason -Reasons $reasons -Message "Gemini requested narrowing"
      }
      "REJECT" {
        $decision = "STOP_FOR_STRATEGIC_PULSE"
        $nextAction = "stop and run Strategic Pulse before any replacement mission"
        Add-Reason -Reasons $reasons -Message "Gemini rejected the original mission"
      }
      "QUARANTINE" {
        $decision = "QUARANTINE_REQUIRED"
        $nextAction = "route to quarantine policy or stop"
        Add-Reason -Reasons $reasons -Message "Gemini requires quarantine"
      }
      "PASS_VISUAL" {
        $decision = "CONTINUE"
        $nextAction = "mark visual evidence acceptable only if other gates remain pass"
        Add-Reason -Reasons $reasons -Message "Visual Court passed with required artifacts present"
      }
      "WARNING_VISUAL" {
        $decision = "REQUEST_PLANNER_NARROWING"
        $nextAction = "keep branch out of auto-ready; request narrowing or morning review"
        Add-Reason -Reasons $reasons -Message "Visual Court warning prevents direct readiness"
      }
      "BLOCK_VISUAL" {
        $decision = "BLOCK_VISUAL_REWORK"
        $nextAction = "mark branch NEEDS_REWORK; do not merge product code"
        Add-Reason -Reasons $reasons -Message "Visual Court blocked branch readiness"
      }
      "REPORT_ONLY" {
        $decision = "RECORD_LONG_HORIZON_REPORT"
        $nextAction = "record report only; no executable mission follows directly"
        Add-Reason -Reasons $reasons -Message "Gemini long-horizon output is report-only"
      }
      default {
        $decision = "STOP_DETERMINISTIC_GATE"
        $nextAction = "reject unknown Gemini verdict"
        $deterministicOverride = $true
        Add-Reason -Reasons $reasons -Message "unknown Gemini verdict: $verdict"
      }
    }
  }

  [ordered]@{
    decision_result = $decision
    gemini_verdict = $verdict
    deterministic_gate_override = $deterministicOverride
    reasons = @($reasons)
    required_next_action = $nextAction
    live_gemini_called = $false
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 12
  exit 0
} catch {
  [ordered]@{
    decision_result = "STOP_DETERMINISTIC_GATE"
    gemini_verdict = ""
    deterministic_gate_override = $true
    reasons = @($_.Exception.Message)
    required_next_action = "repair resolver input"
    live_gemini_called = $false
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 12
  exit 1
}
