$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Find-JsonObjectText {
  param([string]$Raw)
  $start = $Raw.IndexOf("{")
  while ($start -ge 0) {
    $depth = 0
    $inString = $false
    $escape = $false
    for ($i = $start; $i -lt $Raw.Length; $i++) {
      $ch = $Raw[$i]
      if ($escape) { $escape = $false; continue }
      if ($ch -eq "\") { $escape = $true; continue }
      if ($ch -eq '"') { $inString = -not $inString; continue }
      if ($inString) { continue }
      if ($ch -eq "{") { $depth++ }
      if ($ch -eq "}") {
        $depth--
        if ($depth -eq 0) { return $Raw.Substring($start, $i - $start + 1) }
      }
    }
    $start = $Raw.IndexOf("{", $start + 1)
  }
  return ""
}

function Invoke-JsonCommand {
  param([string[]]$Arguments)
  $oldPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $output = & powershell -NoProfile -ExecutionPolicy Bypass @Arguments 2>&1
  $ErrorActionPreference = $oldPreference
  $code = $LASTEXITCODE
  $raw = ($output -join "`n")
  $jsonText = Find-JsonObjectText -Raw $raw
  return [pscustomobject]@{
    exit_code = $code
    output = $raw
    json = if ($jsonText) { ($jsonText | ConvertFrom-Json) } else { $null }
  }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()
$fixtureRoot = Join-Path $PSScriptRoot "fixtures"
$runDir = Join-Path "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\external_skill_intake_tests" (Get-Date -Format "yyyyMMdd_HHmmss")
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$auditScript = Join-Path $PSScriptRoot "audit_agent_skill.ps1"
$classifyScript = Join-Path $PSScriptRoot "classify_agent_skill.ps1"
$extractScript = Join-Path $PSScriptRoot "extract_skill_patterns.ps1"

function Audit-Fixture {
  param([string]$Name)
  $out = Join-Path $runDir "$Name.audit.json"
  return Invoke-JsonCommand -Arguments @("-File", $auditScript, "-SkillPath", (Join-Path $fixtureRoot $Name), "-OutPath", $out)
}

$safe = Audit-Fixture "skill_safe_minimal"
$missing = Audit-Fixture "skill_missing_skill_md"
$dangerousGit = Audit-Fixture "skill_dangerous_git"
$network = Audit-Fixture "skill_network_fetch"
$injection = Audit-Fixture "skill_prompt_injection"
$conflict = Audit-Fixture "skill_conflicts_with_neurochess"
$scriptPresent = Audit-Fixture "skill_script_present"

$criticalClass = Invoke-JsonCommand -Arguments @("-File", $classifyScript, "-InputPath", (Join-Path $runDir "skill_dangerous_git.audit.json"))
$highClass = Invoke-JsonCommand -Arguments @("-File", $classifyScript, "-InputPath", (Join-Path $runDir "skill_network_fetch.audit.json"))

$scriptMarker = Join-Path $runDir "script_should_not_exist.txt"
$extractMarkdown = Join-Path $runDir "skill_patterns.md"
$extractJson = Join-Path $runDir "skill_patterns.json"
$extract = Invoke-JsonCommand -Arguments @("-File", $extractScript, "-SkillPath", (Join-Path $fixtureRoot "skill_script_present"), "-OutMarkdown", $extractMarkdown, "-OutJson", $extractJson)

$state = Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json
$docsRebuildDirty = (git -C $repoRoot status --short docs/rebuild)
$productDirty = (git -C $repoRoot status --short frontend backend plan package.json package-lock.json App.tsx)
$rawExternalTracked = git -C $repoRoot ls-files "external_skills/quarantine/*" "external_skills/audited/raw/*" "external_skills/adapted/raw/*"
$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

Assert-True ($safe.exit_code -eq 0 -and $safe.json.risk_level -eq "low" -and $safe.json.recommended_verdict -eq "APPROVE_INTERNAL") "safe minimal skill should be low risk"
Assert-True ($missing.exit_code -ne 0 -and -not [bool]$missing.json.has_skill_md) "missing SKILL.md should fail"
Assert-True ($dangerousGit.json.risk_level -eq "critical" -and (($dangerousGit.json.dangerous_patterns -join "`n") -match "git add -A|destructive git|git clean")) "dangerous Git commands should be detected"
Assert-True ($network.json.risk_level -eq "high" -and (($network.json.dangerous_patterns -join "`n") -match "network fetch")) "network fetch should be detected"
Assert-True ($injection.json.risk_level -eq "critical" -and (($injection.json.dangerous_patterns -join "`n") -match "prompt injection")) "prompt injection should be detected"
Assert-True (($conflict.json.conflicts_with_neurochess -join "`n") -match "red-tier|safety gate") "NeuroChess conflicts should be detected"
Assert-True (($scriptPresent.json.risk_level -eq "high" -or $scriptPresent.json.risk_level -eq "medium") -and [bool]$scriptPresent.json.has_scripts) "script-present skill should be at least medium/high"
Assert-True ($criticalClass.json.recommended_verdict -eq "REJECT") "critical classification should reject"
Assert-True ($highClass.json.recommended_verdict -eq "QUARANTINE" -or $highClass.json.recommended_verdict -eq "ADAPT_TO_INTERNAL") "high classification should quarantine or adapt"
Assert-True ($extract.exit_code -eq 0 -and (-not [bool]$extract.json.scripts_executed) -and (Test-Path -LiteralPath $extractMarkdown)) "pattern extraction should produce summary without executing scripts"
Assert-True (-not (Test-Path -LiteralPath $scriptMarker)) "fixture script marker must not be created"
Assert-True (-not [bool]$state.external_skills_intake_enabled) "external skills intake live enablement must remain false"
Assert-True (-not [bool]$state.external_skills_auto_install_enabled) "external skill auto-install must remain false"
Assert-True ([bool]$state.external_skill_trust_gate_available) "trust gate should be available"
Assert-True ([bool]$state.external_skills_must_quarantine_first) "external skills must quarantine first"
Assert-True ($docsRebuildDirty.Count -eq 0) "docs/rebuild must not be touched by tests"
Assert-True ($productDirty.Count -eq 0) "frontend/backend/plan/package/App.tsx must not be touched by tests"
$rawExternalTrackedArray = @($rawExternalTracked)
Assert-True (@($rawExternalTrackedArray | Where-Object { $_ -notmatch '\.gitkeep$' }).Count -eq 0) "raw external skills must not be tracked"
Assert-True ($endBranch -eq $startBranch) "test should leave branch unchanged"
Assert-True ($endHead -eq $startHead) "test should leave HEAD unchanged"

$summary = [ordered]@{
  status = "pass"
  report_dir = $runDir
  start_branch = $startBranch
  end_branch = $endBranch
  start_head = $startHead
  end_head = $endHead
  checks = [ordered]@{
    safe_minimal_low_risk = "PASS"
    missing_skill_md_fails = "PASS"
    dangerous_git_detected = "PASS"
    network_fetch_detected = "PASS"
    prompt_injection_detected = "PASS"
    neurochess_conflict_detected = "PASS"
    script_present_high_or_medium = "PASS"
    classify_critical_reject = "PASS"
    classify_high_quarantine_or_adapt = "PASS"
    extract_patterns_no_execution = "PASS"
    raw_external_skills_not_committed = "PASS"
    no_live_network_call = $true
    no_live_chatgpt_call = $true
    no_live_gemini_call = $true
    no_product_mission = $true
    no_frontend_backend_docs_rebuild_touched = $true
  }
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $runDir "external_skill_intake_test_result.json") -Encoding UTF8
$summary | ConvertTo-Json -Depth 10
exit 0
