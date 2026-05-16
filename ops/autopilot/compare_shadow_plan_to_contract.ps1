param(
  [Parameter(Mandatory = $true)][string]$ShadowPlanPath,
  [string]$ContractPath = "",
  [string]$NcMp2NormalizedPath = "",
  [string]$ReportDir = ""
)

$ErrorActionPreference = "Stop"

if (-not $ReportDir) {
  $ReportDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\shadow_plan_comparisons" (Get-Date -Format "yyyyMMdd_HHmmss")
}
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

function As-Array {
  param($Value)
  if ($null -eq $Value) { return @() }
  if ($Value -is [string]) {
    if (-not $Value.Trim()) { return @() }
    return @($Value)
  }
  return @($Value)
}

function Normalize-Text {
  param($Value, [switch]$Lower)
  if ($null -eq $Value) { return "" }
  $text = ([string]$Value -replace "\s+", " ").Trim()
  if ($Lower) { $text = $text.ToLowerInvariant() }
  return $text
}

function Normalize-Path {
  param($Value)
  return ((Normalize-Text $Value) -replace "\\", "/")
}

function Normalize-PathList {
  param($Value)
  return @(As-Array $Value | ForEach-Object { Normalize-Path $_ } | Where-Object { $_ } | Sort-Object -Unique)
}

function Normalize-Check {
  param($Value)
  $text = (Normalize-Text $Value).ToLowerInvariant() -replace "\\", "/"
  if ($text -eq "diffcheck" -or $text -match '(^| )git diff --check($| )') { return "git diff --check" }
  if ($text -match 'tools/plan_guard\.py') { return "tools/plan_guard.py" }
  return $text
}

function Normalize-CheckList {
  param($Value)
  $items = @()
  foreach ($entry in @(As-Array $Value)) {
    foreach ($part in ([string]$entry -split "(?:`r`n|`n|`r|;|,)")) {
      $normalized = Normalize-Check $part
      if ($normalized) { $items += $normalized }
    }
  }
  return @($items | Sort-Object -Unique)
}

function Test-PathLike {
  param([string]$Path, [string]$Pattern)
  return ((Normalize-Path $Path) -like (Normalize-Path $Pattern))
}

function Test-AnyPathLike {
  param([string]$Path, [string[]]$Patterns)
  foreach ($pattern in $Patterns) {
    if (Test-PathLike $Path $pattern) { return $true }
  }
  return $false
}

function Get-ContractFields {
  param($Contract)
  return [ordered]@{
    mission_id = Normalize-Text $Contract.mission_id
    risk_tier = Normalize-Text $Contract.risk_tier -Lower
    work_type = Normalize-Text $Contract.work_type -Lower
    expected_changed_files = @(Normalize-PathList $Contract.expected_changed_files)
    allowed_paths = @(Normalize-PathList $Contract.allowed_paths)
    forbidden_paths = @(Normalize-PathList $Contract.forbidden_paths)
    max_files = [int]$Contract.max_files
    max_diff_lines = [int]$Contract.max_diff_lines
    required_checks = @(Normalize-CheckList $Contract.required_checks)
    expected_artifacts = @(As-Array $Contract.expected_artifacts | ForEach-Object { Normalize-Text $_ } | Where-Object { $_ } | Sort-Object -Unique)
  }
}

function Get-NcMp2Fields {
  param($Nc)
  $fields = if ($Nc.PSObject.Properties.Name -contains "fields") { $Nc.fields } else { $Nc }
  return [ordered]@{
    mission_id = Normalize-Text $fields.id
    risk_tier = Normalize-Text $fields.tier -Lower
    work_type = Normalize-Text $fields.type -Lower
    expected_changed_files = @(Normalize-PathList $fields.allow)
    allowed_paths = @(Normalize-PathList $fields.allow)
    forbidden_paths = @(Normalize-PathList $fields.deny)
    max_files = [int]$fields.max_files
    max_diff_lines = [int]$fields.max_diff
    required_checks = @(Normalize-CheckList $fields.checks)
    expected_artifacts = @()
  }
}

try {
  if (-not $ContractPath -and -not $NcMp2NormalizedPath) { throw "Provide -ContractPath or -NcMp2NormalizedPath." }

  $validateOutput = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $PSScriptRoot "validate_shadow_plan.ps1") -InputPath $ShadowPlanPath 2>&1
  $validateCode = $LASTEXITCODE
  $validateRaw = ($validateOutput -join "`n")
  $validate = $validateRaw | ConvertFrom-Json

  $mismatches = [System.Collections.Generic.List[string]]::new()
  $matched = [System.Collections.Generic.List[string]]::new()
  if ($validateCode -ne 0) {
    foreach ($violation in @($validate.violations)) { $mismatches.Add("shadow plan validation failed: $violation") | Out-Null }
  }

  $plan = $validate.normalized_plan
  $contractSources = @()
  if ($ContractPath) {
    $contractSources += [ordered]@{ name = "mission_contract"; fields = (Get-ContractFields (Get-Content -LiteralPath $ContractPath -Raw | ConvertFrom-Json)) }
  }
  if ($NcMp2NormalizedPath) {
    $contractSources += [ordered]@{ name = "nc_mp2"; fields = (Get-NcMp2Fields (Get-Content -LiteralPath $NcMp2NormalizedPath -Raw | ConvertFrom-Json)) }
  }

  $writePaths = @($plan.planned_create_paths + $plan.planned_modify_paths + $plan.planned_delete_paths)
  foreach ($source in $contractSources) {
    $c = $source.fields
    if ($plan.risk_tier -ne $c.risk_tier) { $mismatches.Add("$($source.name): risk_tier mismatch $($plan.risk_tier) != $($c.risk_tier)") | Out-Null } else { $matched.Add("$($source.name):risk_tier") | Out-Null }
    if ($plan.work_type -ne $c.work_type) { $mismatches.Add("$($source.name): work_type mismatch $($plan.work_type) != $($c.work_type)") | Out-Null } else { $matched.Add("$($source.name):work_type") | Out-Null }

    if ($writePaths.Count -gt $c.max_files) { $mismatches.Add("$($source.name): planned writes exceed max_files") | Out-Null } else { $matched.Add("$($source.name):max_files") | Out-Null }
    if ([int]$plan.expected_diff_lines.max -gt $c.max_diff_lines) { $mismatches.Add("$($source.name): planned diff budget exceeds contract") | Out-Null } else { $matched.Add("$($source.name):max_diff_lines") | Out-Null }

    foreach ($path in $writePaths) {
      if ($c.expected_changed_files.Count -gt 0 -and $c.expected_changed_files -notcontains $path) {
        $mismatches.Add("$($source.name): planned write outside expected_changed_files: $path") | Out-Null
      }
      if ($c.allowed_paths.Count -gt 0 -and -not (Test-AnyPathLike -Path $path -Patterns $c.allowed_paths)) {
        $mismatches.Add("$($source.name): planned write outside allowed_paths: $path") | Out-Null
      }
      if (Test-AnyPathLike -Path $path -Patterns $c.forbidden_paths) {
        $mismatches.Add("$($source.name): planned write hits forbidden path: $path") | Out-Null
      }
    }
    foreach ($path in @($plan.planned_read_paths)) {
      if (Test-AnyPathLike -Path $path -Patterns $c.forbidden_paths) {
        $mismatches.Add("$($source.name): planned read hits forbidden path: $path") | Out-Null
      }
    }
    if ($writePaths.Count -gt 0 -and @($mismatches | Where-Object { $_ -match [regex]::Escape($source.name) -and $_ -match "planned write" }).Count -eq 0) {
      $matched.Add("$($source.name):planned_write_paths") | Out-Null
    }

    foreach ($check in @($c.required_checks)) {
      if (@($plan.planned_checks) -notcontains $check) {
        $mismatches.Add("$($source.name): planned checks omit required check: $check") | Out-Null
      }
    }
    if (@($c.required_checks).Count -gt 0 -and @($c.required_checks | Where-Object { @($plan.planned_checks) -notcontains $_ }).Count -eq 0) {
      $matched.Add("$($source.name):required_checks") | Out-Null
    }

    foreach ($artifact in @($c.expected_artifacts)) {
      if (@($plan.planned_artifacts) -notcontains $artifact) {
        $mismatches.Add("$($source.name): planned artifacts omit expected artifact: $artifact") | Out-Null
      }
    }
    if (@($c.expected_artifacts).Count -eq 0 -or @($c.expected_artifacts | Where-Object { @($plan.planned_artifacts) -notcontains $_ }).Count -eq 0) {
      $matched.Add("$($source.name):expected_artifacts") | Out-Null
    }

    if ($c.work_type -match "docs-only" -and @($writePaths | Where-Object { $_ -like "backend/*" -or $_ -like "frontend/*" }).Count -gt 0) {
      $mismatches.Add("$($source.name): backend/frontend work planned while contract is docs-only") | Out-Null
    }
    if (($c.work_type -eq "backend-readonly-only" -or $c.work_type -eq "frontend-readonly-only") -and $plan.planned_branch.strategy -ne "ephemeral") {
      $mismatches.Add("$($source.name): planned branch strategy conflicts with mission type") | Out-Null
    }
  }

  $redText = @($plan.goal, (@($plan.planned_read_paths + $writePaths) -join " ")) -join "`n"
  foreach ($term in @("Practice", "due_at", "Daily Plan", "training_items", "practice_attempts", "scoring", "XP", "rank", "Transfer")) {
    if ($redText -match "(?i)(?<![A-Za-z0-9_])$([regex]::Escape($term))(?![A-Za-z0-9_])" -and $plan.planned_branch.strategy -ne "quarantine") {
      $mismatches.Add("red-tier work appears without quarantine policy: $term") | Out-Null
    }
  }

  $comparison = if ($mismatches.Count -eq 0) { "MATCH" } else { "STOP_BEFORE_WORK" }
  $recommended = if ($mismatches.Count -eq 0) { "CONTINUE" } elseif (@($mismatches | Where-Object { $_ -match "work_type|planned write|backend/frontend" }).Count -gt 0) { "SPLIT_MISSION" } else { "REPAIR_PROMPT" }
  if ($comparison -ne "MATCH" -and @($mismatches | Where-Object { $_ -match "red-tier|forbidden" }).Count -gt 0) { $recommended = "STOP" }

  $result = [ordered]@{
    comparison_result = $comparison
    matched_fields = @($matched | Sort-Object -Unique)
    mismatches = @($mismatches | Sort-Object -Unique)
    recommended_next_action = $recommended
    report_path = (Join-Path $ReportDir "shadow_plan_contract_comparison.json")
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  }
  $result | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $result.report_path -Encoding UTF8
  $result | ConvertTo-Json -Depth 30
  if ($comparison -eq "MATCH") { exit 0 }
  exit 2
} catch {
  [ordered]@{
    comparison_result = "STOP_FOR_SUPERVISOR"
    matched_fields = @()
    mismatches = @($_.Exception.Message)
    recommended_next_action = "STOP"
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
