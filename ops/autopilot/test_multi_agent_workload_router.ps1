$ErrorActionPreference = "Stop"

$script = Join-Path $PSScriptRoot "multi_agent_workload_router.ps1"
$tempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("neurochess_multi_agent_router_test_{0}" -f [guid]::NewGuid().ToString("N"))

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

try {
    New-Item -ItemType Directory -Force -Path $tempRoot | Out-Null

    $status = Invoke-Router -Arguments @("-Mode", "Status", "-NoPrompt")
    Assert-True ($status.status -eq "MULTI_AGENT_OPERATING_MODEL_LOCKED") "router status should lock operating model"
    Assert-True ([bool]$status.codex_final_integrator) "Codex final integrator rule missing"
    Assert-True ([bool]$status.antigravity_patch_proposal_only) "Antigravity proposal-only rule missing"
    Assert-True ([bool]$status.gemini_visual_critic_only) "Gemini visual critic rule missing"
    Assert-True ([bool]$status.chatgpt_strategy_critic_only) "ChatGPT strategy critic rule missing"
    Assert-True ([bool]$status.local_fallback_authoritative) "local fallback authority missing"

    $matrix = Invoke-Router -Arguments @("-Mode", "TaskMatrix", "-NoPrompt")
    Assert-True ($matrix.status -eq "TASK_ROUTING_MATRIX_READY") "task matrix status missing"
    Assert-True (@($matrix.categories).Count -ge 16) "task matrix must include at least 16 categories"
    $matrixCategories = @($matrix.categories | ForEach-Object { $_.category })
    foreach ($required in @(
            "DEV-only visual variant exploration",
            "Final integration into official repo",
            "Backend/API/DB work",
            "Package/dependency changes",
            "Night mode objective selection"
        )) {
        Assert-True ($matrixCategories -contains $required) "task matrix missing $required"
    }

    $visual = Invoke-Router -Arguments @("-Mode", "Route", "-TaskType", "visual variant exploration", "-VisualValue", "9", "-ExplorationValue", "9", "-IntegrationRisk", "2", "-SafetyRisk", "1", "-ExpectedPixelValue", "8", "-ProofStrengthRequired", "8", "-NoPrompt")
    Assert-True ($visual.route -eq "ANTIGRAVITY") "visual exploration should route to Antigravity"
    Assert-True (-not [bool]$visual.antigravity_direct_repo_access) "Antigravity direct repo access must be false"
    Assert-True (@($visual.hard_rules_applied) -contains "LOW_RISK_VISUAL_EXPLORATION_ANTIGRAVITY_PREFERRED") "Antigravity visual hard rule missing"

    $integration = Invoke-Router -Arguments @("-Mode", "Route", "-TaskType", "final integration", "-IntegrationRisk", "9", "-SafetyRisk", "7", "-ProofStrengthRequired", "9", "-NoPrompt")
    Assert-True ($integration.route -eq "CODEX") "final integration should route to Codex"

    $backend = Invoke-Router -Arguments @("-Mode", "Route", "-TaskType", "backend API DB work", "-IntegrationRisk", "5", "-SafetyRisk", "5", "-NoPrompt")
    Assert-True ($backend.route -eq "CODEX") "backend/API/DB work should route to Codex"
    Assert-True (($backend.reason -match "External execution is forbidden") -or (@($backend.hard_rules_applied) -contains "PROTECTED_OR_PRODUCT_INTEGRATION_TASK")) "backend hard rule missing"

    $safety = Invoke-Router -Arguments @("-Mode", "Route", "-TaskType", "low risk looking visual spike but safety high", "-VisualValue", "9", "-ExplorationValue", "9", "-IntegrationRisk", "2", "-SafetyRisk", "6", "-ExpectedPixelValue", "8", "-NoPrompt")
    Assert-True ($safety.route -eq "CODEX") "safety risk over 0.4 should forbid external execution"
    Assert-True (@($safety.hard_rules_applied) -contains "SAFETY_RISK_OVER_EXTERNAL_LIMIT") "safety hard rule missing"

    $screenshot = Invoke-Router -Arguments @("-Mode", "Route", "-TaskType", "screenshot critique", "-VisualValue", "10", "-NoPrompt")
    Assert-True ($screenshot.route -eq "GEMINI") "screenshot critique should route to Gemini"

    $strategy = Invoke-Router -Arguments @("-Mode", "Route", "-TaskType", "strategic product review", "-NoPrompt")
    Assert-True ($strategy.route -eq "CHATGPT") "strategic review should route to ChatGPT"

    $fallback = Invoke-Router -Arguments @("-Mode", "Route", "-TaskType", "blocked live lane", "-LiveLaneBlocked", "-NoPrompt")
    Assert-True ($fallback.route -eq "LOCAL_FALLBACK") "blocked lane should route to local fallback"

    $auction = Invoke-Router -Arguments @("-Mode", "Auction", "-MissionId", "A20BI", "-NoPrompt")
    Assert-True ($auction.status -eq "FIRST_ANTIGRAVITY_WORK_ORDER_SELECTED") "auction should select first work order"
    Assert-True ([int]$auction.candidates_evaluated -ge 12) "auction must evaluate at least 12 task archetypes"
    Assert-True ($auction.selected_task -match "critical_moment_sigil|memory_cabinet") "auction should pick a low-risk high-value visual spike"
    Assert-True ($auction.winner.route -eq "ANTIGRAVITY") "auction winner should route to Antigravity"
    Assert-True ([double]$auction.winner.metrics.integration_risk -lt 0.4) "auction winner integration risk too high"
    Assert-True ([double]$auction.winner.metrics.safety_risk -le 0.4) "auction winner safety risk too high"

    $pack = Invoke-Router -Arguments @("-Mode", "WriteWorkOrderPack", "-MissionId", "A20BI", "-ArtifactPath", $tempRoot, "-NoPrompt")
    Assert-True ($pack.status -eq "ANTIGRAVITY_FIRST_WORK_ORDER_PACK_WRITTEN") "work order pack should be written"
    foreach ($file in @("work_order.md", "allowed_paths.txt", "forbidden_paths.txt", "patch_proposal_schema.json", "acceptance_criteria.md", "visual_quality_rules.md", "safety_rules.md", "expected_output_pack.md", "auction_result.json")) {
        Assert-True (Test-Path -LiteralPath (Join-Path $tempRoot $file) -PathType Leaf) "work order pack missing $file"
    }

    $dry = Invoke-Router -Arguments @("-Mode", "DryRun", "-NoPrompt")
    Assert-True ($dry.status -eq "MULTI_AGENT_ROUTER_DRY_RUN_PASS") "dry run should pass"
    Assert-True ([int]$dry.task_archetypes_evaluated -ge 16) "dry run should evaluate at least 16 task archetypes"
    $routes = @($dry.cases | ForEach-Object { $_.route })
    foreach ($expected in @("ANTIGRAVITY", "CODEX", "GEMINI", "CHATGPT", "LOCAL_FALLBACK")) {
        Assert-True ($routes -contains $expected) "dry run missing route $expected"
    }

    $source = Get-Content -LiteralPath $script -Raw
    Assert-True ($source -notmatch "git add -A") "router must not use broad staging"
    Assert-True ($source -notmatch "git push") "router must not push"

    [ordered]@{
        status = "pass"
        tests = 22
        role_matrix_locked = $true
        task_matrix_categories = @($matrix.categories).Count
        dry_run_archetypes = [int]$dry.task_archetypes_evaluated
        selected_work_order = $auction.selected_task
        visual_variant_to_antigravity = $true
        final_integration_to_codex = $true
        screenshot_critique_to_gemini = $true
        strategic_review_to_chatgpt = $true
        blocked_lane_to_local_fallback = $true
        codex_final_integrator = $true
    } | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $tempRoot) {
        Remove-Item -LiteralPath $tempRoot -Recurse -Force
    }
}
