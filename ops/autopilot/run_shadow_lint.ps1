param(
  [string]$ReportDir = "",
  [switch]$AutomationOnly
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

if (-not $ReportDir) {
  $ReportDir = Join-Path (Get-AutopilotArtifactRoot) "shadow_lint\$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $ReportDir | Out-Null

$repoRoot = Get-AutopilotRepoRoot
$changedFiles = @(Get-AutopilotChangedPaths -Cwd $repoRoot)
$checks = [System.Collections.Generic.List[object]]::new()

function Add-Check {
  param([string]$Name, [bool]$Pass, [string]$Detail)
  $checks.Add([ordered]@{ name = $Name; pass = $Pass; detail = $Detail }) | Out-Null
}

Push-Location $repoRoot
try {
  $diffCheck = git diff --check 2>&1
  Add-Check "git diff --check" ($LASTEXITCODE -eq 0) (($diffCheck -join "`n").Trim())

  foreach ($file in $changedFiles) {
    if (-not (Test-Path -LiteralPath $file)) { continue }
    $normalized = $file -replace "\\", "/"
    if ($normalized -like "ops/autopilot/*.ps1") {
      $tokens = $null
      $errors = $null
      [void][System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path $file).Path, [ref]$tokens, [ref]$errors)
      Add-Check "powershell parse: $normalized" ($errors.Count -eq 0) (($errors | ForEach-Object { $_.Message }) -join "; ")
    } elseif ($normalized -like "ops/autopilot/*.js" -or $normalized -like "ops/autopilot/*.mjs" -or $normalized -like "ops/autopilot/browser/*.js" -or $normalized -like "ops/autopilot/browser/*.mjs") {
      $nodeOut = node --check $file 2>&1
      Add-Check "node --check: $normalized" ($LASTEXITCODE -eq 0) (($nodeOut -join "`n").Trim())
    } elseif ($normalized -like "ops/autopilot/*.json" -or $normalized -like "ops/autopilot/fixtures/*.json") {
      try {
        Get-Content -LiteralPath $file -Raw | ConvertFrom-Json | Out-Null
        Add-Check "json parse: $normalized" $true ""
      } catch {
        Add-Check "json parse: $normalized" $false $_.Exception.Message
      }
    } elseif ($normalized -like "ops/autopilot/*.yaml" -or $normalized -like "ops/autopilot/*.yml" -or $normalized -like "ops/autopilot/fixtures/*.yaml" -or $normalized -like "ops/autopilot/fixtures/*.yml") {
      $text = Get-Content -LiteralPath $file -Raw
      $hasTabs = $text -match "`t"
      $hasColon = $text -match "(?m)^\s*[A-Za-z0-9_.-]+:\s*"
      Add-Check "yaml sanity: $normalized" (-not $hasTabs -and $hasColon) "limitations: indentation sanity only"
    }
  }

  if ($AutomationOnly) {
    $productTouched = @($changedFiles | Where-Object {
      $_ -like "frontend/*" -or
      $_ -like "backend/*" -or
      $_ -like "docs/rebuild/*" -or
      $_ -like "plan/*" -or
      $_ -eq "package.json" -or
      $_ -eq "package-lock.json" -or
      $_ -eq "App.tsx"
    })
    Add-Check "automation-only product path scan" ($productTouched.Count -eq 0) ($productTouched -join ", ")
  }
} finally {
  Pop-Location
}

$failed = @($checks | Where-Object { -not $_.pass })
$summary = [ordered]@{
  status = if ($failed.Count -eq 0) { "pass" } else { "fail" }
  changed_files = @($changedFiles)
  checks = @($checks)
  failed = @($failed)
  live_product_tests_executed = $false
  report_dir = $ReportDir
}

$jsonPath = Join-Path $ReportDir "shadow_lint_summary.json"
$mdPath = Join-Path $ReportDir "shadow_lint_summary.md"
$summary | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $jsonPath -Encoding UTF8

$md = @(
  "# Shadow Lint Summary",
  "",
  "Status: $($summary.status)",
  "",
  "## Checks"
)
foreach ($check in $checks) {
  $md += "- $($check.name): $(if ($check.pass) { 'PASS' } else { 'FAIL' })"
}
$md | Set-Content -LiteralPath $mdPath -Encoding UTF8

$summary | ConvertTo-Json -Depth 12
if ($failed.Count -gt 0) { exit 1 }
exit 0
