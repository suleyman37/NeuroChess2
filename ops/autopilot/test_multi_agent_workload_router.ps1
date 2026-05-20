$ErrorActionPreference = "Stop"

$script = Join-Path $PSScriptRoot "multi_agent_workload_router.ps1"

function Convert-JsonOutput {
    param([object[]]$Output)
    $text = ($Output | Out-String).Trim()
    $start = $text.IndexOf("{")
    if ($start -lt 0) { throw "JSON output missing: $text" }
    return ($text.Substring($start) | ConvertFrom-Json)
}

function Invoke-Router {
    param([string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $script @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "router failed: $($output | Out-String)" }
    Convert-JsonOutput -Output $output
}

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw $Message }
}

$status = Invoke-Router -Arguments @("-Mode", "Status", "-NoPrompt")
Assert-True ($status.status -eq "MULTI_AGENT_WORKLOAD_ROUTER_AVAILABLE") "router status unavailable"
Assert-True ([bool]$status.codex_final_integrator) "Codex final integrator rule missing"
Assert-True ([bool]$status.antigravity_patch_proposal_only) "Antigravity proposal-only rule missing"

$visual = Invoke-Router -Arguments @("-Mode", "Route", "-TaskType", "visual variant exploration", "-VisualValue", "9", "-ExplorationValue", "9", "-IntegrationRisk", "2", "-SafetyRisk", "1", "-NoPrompt")
Assert-True ($visual.route -eq "ANTIGRAVITY") "visual exploration should route to Antigravity"
Assert-True (-not [bool]$visual.antigravity_direct_repo_access) "Antigravity direct repo access must be false"

$integration = Invoke-Router -Arguments @("-Mode", "Route", "-TaskType", "final integration", "-IntegrationRisk", "9", "-SafetyRisk", "7", "-ProofStrengthRequired", "9", "-NoPrompt")
Assert-True ($integration.route -eq "CODEX") "final integration should route to Codex"

$screenshot = Invoke-Router -Arguments @("-Mode", "Route", "-TaskType", "screenshot critique", "-VisualValue", "10", "-NoPrompt")
Assert-True ($screenshot.route -eq "GEMINI") "screenshot critique should route to Gemini"

$strategy = Invoke-Router -Arguments @("-Mode", "Route", "-TaskType", "strategic product review", "-NoPrompt")
Assert-True ($strategy.route -eq "CHATGPT") "strategic review should route to ChatGPT"

$fallback = Invoke-Router -Arguments @("-Mode", "Route", "-TaskType", "blocked live lane", "-LiveLaneBlocked", "-NoPrompt")
Assert-True ($fallback.route -eq "LOCAL_FALLBACK") "blocked lane should route to local fallback"

$dry = Invoke-Router -Arguments @("-Mode", "DryRun", "-NoPrompt")
$routes = @($dry.cases | ForEach-Object { $_.route })
foreach ($expected in @("ANTIGRAVITY", "CODEX", "GEMINI", "CHATGPT", "LOCAL_FALLBACK")) {
    Assert-True ($routes -contains $expected) "dry run missing route $expected"
}

[ordered]@{
    status = "pass"
    tests = 8
    visual_variant_to_antigravity = $true
    final_integration_to_codex = $true
    screenshot_critique_to_gemini = $true
    strategic_review_to_chatgpt = $true
    blocked_lane_to_local_fallback = $true
    codex_final_integrator = $true
} | ConvertTo-Json -Depth 10
