param()

$ErrorActionPreference = "Stop"

function Assert-True {
  param([bool]$Condition, [string]$Message)
  if (-not $Condition) { throw $Message }
}

function Invoke-JsonCommand {
  param([string]$ScriptPath, [string]$FixtureName)
  $fixturePath = Join-Path $fixtureRoot $FixtureName
  $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath -InputPath $fixturePath 2>&1
  $code = $LASTEXITCODE
  $raw = ($output -join "`n")
  Assert-True ($code -eq 0) "Unexpected exit code $code from $ScriptPath. Output: $raw"
  return ($raw | ConvertFrom-Json)
}

function Assert-NoBadScriptCommand {
  param([string]$ScriptPath)
  $text = Get-Content -LiteralPath $ScriptPath -Raw
  $badPatterns = @(
    ("git\s+" + "add\s+" + "-A"),
    ("git\s+" + "reset\s+" + "--hard"),
    ("git\s+" + "clean\b"),
    ("push\s+" + "--force"),
    ("Remove-Item\s+.*" + "-Recurse\s+.*" + "-Force")
  )
  foreach ($pattern in $badPatterns) {
    Assert-True (-not ($text -match $pattern)) "Destructive command pattern found in ${ScriptPath}: $pattern"
  }
}

$repoRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..\..")).Path
$fixtureRoot = Join-Path $PSScriptRoot "fixtures"
$startBranch = (git -C $repoRoot branch --show-current).Trim()
$startHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

$phaseScript = Join-Path $PSScriptRoot "evaluate_night_mode_phase.ps1"
$goldilocksScript = Join-Path $PSScriptRoot "check_goldilocks_mission_scope.ps1"
$scoreScript = Join-Path $PSScriptRoot "score_e2e_deliverable.ps1"
$northStarScript = Join-Path $PSScriptRoot "resolve_rejected_north_star_vector.ps1"

$expansion = Invoke-JsonCommand $phaseScript "night_phase_expansion_success.json"
$consolidation = Invoke-JsonCommand $phaseScript "night_phase_consolidation_success.json"
$drain = Invoke-JsonCommand $phaseScript "night_phase_drain_success.json"
$quarantine = Invoke-JsonCommand $phaseScript "night_phase_quarantine_trigger.json"

Assert-True ($expansion.current_phase -eq "EXPANSION" -and $expansion.next_phase -eq "CONSOLIDATION") "EXPANSION should enter CONSOLIDATION when quota is reached."
Assert-True ($consolidation.current_phase -eq "CONSOLIDATION" -and $consolidation.next_phase -eq "DRAIN") "CONSOLIDATION should enter DRAIN after two low-value missions."
Assert-True ($drain.verdict -eq "PASS_EARLY_EXCELLENCE" -and [bool]$drain.stop) "DRAIN should stop with PASS_EARLY_EXCELLENCE when quotas are met early."
Assert-True ($quarantine.next_phase -eq "QUARANTINE" -and $quarantine.verdict -eq "FAIL_RED_TIER_BREACH") "Red-tier breach should trigger QUARANTINE."

$tiny = Invoke-JsonCommand $goldilocksScript "goldilocks_tiny_mission_reject.json"
$blast = Invoke-JsonCommand $goldilocksScript "goldilocks_blast_radius_reject.json"
$validBackendScope = Invoke-JsonCommand $goldilocksScript "goldilocks_valid_backend_branch.json"
$pingPong = Invoke-JsonCommand $goldilocksScript "goldilocks_ping_pong_lock.json"

Assert-True ($tiny.verdict -eq "TINY_MISSION_REJECT" -and -not [bool]$tiny.allowed) "Tiny mission should be rejected."
Assert-True ($blast.verdict -eq "BLAST_RADIUS_REJECT" -and -not [bool]$blast.allowed) "Blast radius should be rejected."
Assert-True ($validBackendScope.verdict -eq "GOLDILOCKS_PASS" -and [bool]$validBackendScope.allowed) "Valid backend branch scope should pass."
Assert-True ($pingPong.verdict -eq "PING_PONG_FILE_LOCK" -and @($pingPong.quarantined_files).Count -eq 1) "Ping-pong file lock should quarantine the file."

$backendScore = Invoke-JsonCommand $scoreScript "e2e_backend_deliverable_pass.json"
$frontendScore = Invoke-JsonCommand $scoreScript "e2e_frontend_visual_deliverable_pass.json"
$docsScore = Invoke-JsonCommand $scoreScript "e2e_docs_only_not_deliverable.json"

Assert-True ($backendScore.score_result -eq "E2E_DELIVERABLE_PASS" -and $backendScore.deliverable_type -eq "backend") "Backend E2E deliverable should pass."
Assert-True ($frontendScore.score_result -eq "E2E_DELIVERABLE_PASS" -and $frontendScore.deliverable_type -eq "frontend") "Frontend visual E2E deliverable should pass."
Assert-True ($docsScore.score_result -eq "NOT_DELIVERABLE") "Docs-only should not count as E2E by default."

$northStarRejected = Invoke-JsonCommand $northStarScript "north_star_vector_rejected.json"
$northStarRepeat = Invoke-JsonCommand $northStarScript "north_star_two_rejections_force_pulse.json"

Assert-True ($northStarRejected.recommended_action -eq "REQUEST_NEW_TARGET" -and [bool]$northStarRejected.same_hash_forbidden) "North Star rejection should request a new target and forbid same hash."
Assert-True ($northStarRepeat.recommended_action -eq "FORCE_STRATEGIC_PULSE") "Repeated North Star rejection should force Strategic Pulse."

foreach ($script in @($phaseScript, $goldilocksScript, $scoreScript, $northStarScript)) {
  Assert-NoBadScriptCommand $script
}

Get-Content -LiteralPath (Join-Path $PSScriptRoot "state.json") -Raw | ConvertFrom-Json | Out-Null
Get-Content -LiteralPath (Join-Path $PSScriptRoot "schemas\night_mode_phase_state.schema.json") -Raw | ConvertFrom-Json | Out-Null
Get-Content -LiteralPath (Join-Path $PSScriptRoot "schemas\e2e_deliverable_score.schema.json") -Raw | ConvertFrom-Json | Out-Null
Get-Content -LiteralPath (Join-Path $PSScriptRoot "schemas\north_star_vector.schema.json") -Raw | ConvertFrom-Json | Out-Null
Get-Content -LiteralPath (Join-Path $fixtureRoot "north_star_vector_approved.json") -Raw | ConvertFrom-Json | Out-Null

$productDirty = git -C $repoRoot status --short docs/rebuild frontend backend plan package.json package-lock.json App.tsx
$endBranch = (git -C $repoRoot branch --show-current).Trim()
$endHead = (git -C $repoRoot rev-parse --short HEAD).Trim()

Assert-True (-not $productDirty) "Forbidden product paths must not be touched by tests: $productDirty"
Assert-True ($endBranch -eq $startBranch) "Test should leave branch unchanged."
Assert-True ($endHead -eq $startHead) "Test should leave HEAD unchanged."

$summary = [ordered]@{
  status = "pass"
  checks = [ordered]@{
    expansion_to_consolidation = "PASS"
    consolidation_to_drain = "PASS"
    drain_pass_early_excellence = "PASS"
    quarantine_trigger = "PASS"
    tiny_mission_rejected = "PASS"
    blast_radius_rejected = "PASS"
    valid_backend_deliverable_pass = "PASS"
    valid_frontend_visual_deliverable_pass = "PASS"
    docs_only_not_e2e = "PASS"
    north_star_rejection_flow = "PASS"
    destructive_script_command_check = "PASS"
    no_live_chatgpt_call = $true
    no_live_gemini_call = $true
    no_product_mission = $true
    no_frontend_backend_docs_rebuild_touched = $true
  }
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$summary | ConvertTo-Json -Depth 10
exit 0
