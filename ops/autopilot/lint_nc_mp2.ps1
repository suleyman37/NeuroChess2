param(
  [string]$RawText = "",
  [string]$InputPath = ""
)

$ErrorActionPreference = "Stop"

function Invoke-Normalizer {
  $script = Join-Path $PSScriptRoot "normalize_nc_mp2.ps1"
  if ($RawText) {
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $script -RawText $RawText 2>&1
  } elseif ($InputPath) {
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $script -InputPath $InputPath 2>&1
  } else {
    throw "Provide -RawText or -InputPath."
  }
  $raw = ($output -join "`n")
  return [ordered]@{ exit_code = $LASTEXITCODE; json = ($raw | ConvertFrom-Json); raw = $raw }
}

function Test-PathLike {
  param([string[]]$Paths, [string]$Pattern)
  foreach ($path in $Paths) {
    if ($path -like $Pattern) { return $true }
  }
  return $false
}

try {
  $normalizedResult = Invoke-Normalizer
  $violations = [System.Collections.Generic.List[string]]::new()
  $warnings = [System.Collections.Generic.List[string]]::new()

  if (-not [bool]$normalizedResult.json.normalized) {
    foreach ($errorItem in @($normalizedResult.json.errors)) { $violations.Add([string]$errorItem) | Out-Null }
    $payload = [ordered]@{ lint_result = "FAIL"; violations = @($violations); warnings = @($warnings); normalized = $null }
    $payload.live_chatgpt_called = $false
    $payload.product_mission_executed = $false
    $payload.codex_execution = $false
    $payload.commit = $false
    $payload.push = $false
    $payload | ConvertTo-Json -Depth 20
    exit 1
  }

  $fields = $normalizedResult.json.fields
  $allowedTiers = @("green", "blue", "amber", "red", "checkpoint")
  $allowedTypes = @("docs-only", "autopilot-docs-only", "safe-contract-doc-only", "backend-readonly-only", "frontend-readonly-only", "test-only", "smoke-only", "cleanup-only", "strategic-pulse", "checkpoint")
  if ($allowedTiers -notcontains [string]$fields.tier) { $violations.Add("unsupported tier: $($fields.tier)") | Out-Null }
  if ($allowedTypes -notcontains [string]$fields.type) { $violations.Add("unsupported type: $($fields.type)") | Out-Null }

  foreach ($numberField in @("max_files", "max_diff")) {
    try {
      if ([int]$fields.$numberField -lt 1) { $violations.Add("$numberField must be positive") | Out-Null }
    } catch {
      $violations.Add("$numberField must be numeric") | Out-Null
    }
  }

  if (@($fields.checks).Count -eq 0) { $violations.Add("checks must not be empty") | Out-Null }
  if (@($fields.stop).Count -eq 0) { $violations.Add("stop must not be empty") | Out-Null }
  if (-not [string]$fields.commit) { $violations.Add("commit policy missing") | Out-Null }

  $scanText = @(
    [string]$fields.id,
    [string]$fields.goal,
    [string]$fields.type,
    [string]$fields.intent,
    (@($fields.allow) -join " "),
    (@($fields.deny) -join " ")
  ) -join "`n"

  foreach ($pattern in @("improve", "polish", "optimize", "refactor", "finalize", "stabilize", "as needed", "if necessary", "clean up everything", "handle everything", "continue the roadmap", "make it better", "fix all")) {
    if ($scanText -match "(?i)$([regex]::Escape($pattern))") {
      $violations.Add("broad wording appears: $pattern") | Out-Null
    }
  }

  $allow = @($fields.allow | ForEach-Object { [string]$_ })
  $hasBackend = Test-PathLike -Paths $allow -Pattern "backend/*"
  $hasFrontend = Test-PathLike -Paths $allow -Pattern "frontend/*"
  if ($hasBackend -and $hasFrontend) {
    $violations.Add("mixed frontend/backend work is not allowed in NC-MP/2 compact missions") | Out-Null
  }

  if ([string]$fields.type -match "docs-only|autopilot-docs-only|safe-contract-doc-only") {
    foreach ($path in $allow) {
      if ($path -like "backend/*" -or $path -like "frontend/*" -or $path -eq "package.json" -or $path -eq "package-lock.json" -or $path -eq "App.tsx") {
        $violations.Add("docs-only prompt touches code/package path: $path") | Out-Null
      }
    }
  }

  if ([string]$fields.type -eq "backend-readonly-only") {
    $ephemeralText = @([string]$fields.branch, [string]$fields.intent, (@($fields.stop) -join " ")) -join "`n"
    if ($ephemeralText -notmatch "(?i)ephemeral|branch") {
      $violations.Add("backend-readonly requires ephemeral branch requirement") | Out-Null
    }
  }

  if ([string]$fields.type -eq "frontend-readonly-only") {
    $frontendText = @([string]$fields.branch, [string]$fields.intent, (@($fields.checks) -join " "), (@($fields.stop) -join " ")) -join "`n"
    if ($frontendText -notmatch "(?i)screenshot|contact") {
      $violations.Add("frontend-readonly requires screenshot/contact evidence") | Out-Null
    }
    if ($frontendText -notmatch "(?i)visual") {
      $violations.Add("frontend-readonly requires visual review evidence") | Out-Null
    }
  }

  $redTerms = @("Practice", "due_at", "Daily Plan", "training_items", "practice_attempts", "scoring", "XP", "rank", "Transfer")
  $quarantineScopeText = @(
    [string]$fields.tier,
    [string]$fields.type,
    [string]$fields.commit,
    [string]$fields.branch,
    [string]$fields.intent
  ) -join "`n"
  $isRedOrQuarantine = ([string]$fields.tier -eq "red") -or ($quarantineScopeText -match "(?i)quarantine")
  if (-not $isRedOrQuarantine) {
    foreach ($term in $redTerms) {
      if ($scanText -match "(?i)(?<![A-Za-z0-9_])$([regex]::Escape($term))(?![A-Za-z0-9_])") {
        $violations.Add("red-tier term appears outside red/quarantine scope: $term") | Out-Null
      }
    }
  }

  $payload = [ordered]@{
    lint_result = if ($violations.Count -eq 0) { "PASS" } else { "FAIL" }
    violations = @($violations)
    warnings = @($warnings)
    normalized = $normalizedResult.json.fields
    mission_hash_input = $normalizedResult.json.mission_hash_input
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  }
  $payload | ConvertTo-Json -Depth 20
  if ($violations.Count -eq 0) { exit 0 }
  exit 1
} catch {
  [ordered]@{
    lint_result = "FAIL"
    violations = @($_.Exception.Message)
    warnings = @()
    normalized = $null
    live_chatgpt_called = $false
    product_mission_executed = $false
    codex_execution = $false
    commit = $false
    push = $false
  } | ConvertTo-Json -Depth 10
  exit 1
}
