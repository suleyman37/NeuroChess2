param(
  [string]$InputPath = "",
  [string]$MissionResultJson = ""
)

$ErrorActionPreference = "Stop"

function Read-JsonInput {
  param([string]$Path, [string]$RawJson)
  if ($RawJson) { return ($RawJson | ConvertFrom-Json) }
  if ($Path) {
    if (-not (Test-Path -LiteralPath $Path)) { throw "Mission result not found: $Path" }
    return (Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json)
  }
  throw "Provide -InputPath or -MissionResultJson."
}

function Has-Property {
  param($Object, [string]$Name)
  return ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name)
}

function Get-Field {
  param($Object, [string]$Name, $Default = $null)
  if (Has-Property $Object $Name) { return $Object.$Name }
  return $Default
}

function Add-Missing {
  param([System.Collections.Generic.List[string]]$Missing, [string]$Name, [bool]$Present)
  if (-not $Present) { $Missing.Add($Name) | Out-Null }
}

try {
  $result = Read-JsonInput -Path $InputPath -RawJson $MissionResultJson
  $workType = ([string](Get-Field $result "work_type" "")).ToLowerInvariant()
  $deliverableType = if ($workType -match "backend") { "backend" } elseif ($workType -match "frontend|visual") { "frontend" } elseif ($workType -match "docs") { "docs" } else { ([string](Get-Field $result "deliverable_type" "unknown")).ToLowerInvariant() }
  $missing = [System.Collections.Generic.List[string]]::new()
  $reasons = [System.Collections.Generic.List[string]]::new()

  $missionMatch = ([string](Get-Field $result "mission_contract_result" "")).ToUpperInvariant() -eq "MATCH"
  $shadowMatch = ([string](Get-Field $result "shadow_plan_result" "")).ToUpperInvariant() -eq "MATCH"
  $forbiddenClean = -not [bool](Get-Field $result "forbidden_path_touched" $false)
  $evidencePath = [string](Get-Field $result "external_evidence_pack_path" "")

  Add-Missing $missing "mission_contract_match" $missionMatch
  Add-Missing $missing "shadow_plan_match" $shadowMatch
  Add-Missing $missing "no_forbidden_path" $forbiddenClean
  Add-Missing $missing "external_evidence_pack_path" ($evidencePath.Length -gt 0)

  if ($deliverableType -eq "backend") {
    Add-Missing $missing "branch_exists" ([bool](Get-Field $result "branch_exists" $false))
    Add-Missing $missing "commit_exists" ([bool](Get-Field $result "commit_exists" $false))
    Add-Missing $missing "targeted_tests_run" ([bool](Get-Field $result "targeted_tests_run" $false))
    if ([bool](Get-Field $result "read_only" $false)) {
      Add-Missing $missing "anti_mutation_evidence" ([bool](Get-Field $result "anti_mutation_evidence" $false))
    }
  } elseif ($deliverableType -eq "frontend") {
    Add-Missing $missing "branch_exists" ([bool](Get-Field $result "branch_exists" $false))
    Add-Missing $missing "commit_exists" ([bool](Get-Field $result "commit_exists" $false))
    Add-Missing $missing "screenshots_present" ([bool](Get-Field $result "screenshots_present" $false))
    Add-Missing $missing "contact_sheet_present" ([bool](Get-Field $result "contact_sheet_present" $false))
    Add-Missing $missing "visual_review_brief_present" ([bool](Get-Field $result "visual_review_brief_present" $false))
    Add-Missing $missing "no_forbidden_ui_claims" (-not [bool](Get-Field $result "forbidden_ui_claims" $false))
  } elseif ($deliverableType -eq "docs") {
    $impact = ([string](Get-Field $result "product_impact_review" "")).ToUpperInvariant()
    $unblocks = [bool](Get-Field $result "unblocks_specific_product_mission" $false)
    $enabler = ($impact -eq "PRODUCT_ENABLER" -or $impact -eq "SAFETY_CRITICAL") -and $unblocks
    $score = if ($enabler) { "ENABLER_DELIVERABLE" } else { "NOT_DELIVERABLE" }
    if ($enabler) { $reasons.Add("Docs-only work unblocks a specific product mission.") | Out-Null } else { $reasons.Add("Docs-only work is not E2E by default.") | Out-Null }
    [ordered]@{
      score_result = $score
      verdict = $score
      deliverable_type = "docs"
      required_evidence_met = $enabler
      missing_evidence = @()
      reasons = @($reasons)
      live_chatgpt_called = $false
      live_gemini_called = $false
      product_mission_executed = $false
    } | ConvertTo-Json -Depth 10
    exit 0
  } else {
    Add-Missing $missing "known_deliverable_type" $false
  }

  $requiredMet = ($missing.Count -eq 0)
  $scoreResult = if ($requiredMet) { "E2E_DELIVERABLE_PASS" } elseif ($missing.Count -le 2) { "E2E_DELIVERABLE_PARTIAL" } else { "E2E_DELIVERABLE_FAIL" }
  if ($requiredMet) { $reasons.Add("Required deterministic evidence is present.") | Out-Null } else { $reasons.Add("Missing required evidence: $($missing -join ', ')") | Out-Null }

  [ordered]@{
    score_result = $scoreResult
    verdict = $scoreResult
    deliverable_type = $deliverableType
    required_evidence_met = $requiredMet
    missing_evidence = @($missing)
    reasons = @($reasons)
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
  } | ConvertTo-Json -Depth 10
  exit 0
} catch {
  [ordered]@{
    score_result = "E2E_DELIVERABLE_FAIL"
    verdict = "E2E_DELIVERABLE_FAIL"
    deliverable_type = ""
    required_evidence_met = $false
    missing_evidence = @("input_error")
    reasons = @($_.Exception.Message)
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
