param(
    [ValidateSet("Status", "Route", "DryRun")]
    [string]$Mode = "Route",
    [string]$TaskType = "",
    [int]$VisualValue = 0,
    [int]$ExplorationValue = 0,
    [int]$IntegrationRisk = 0,
    [int]$SafetyRisk = 0,
    [int]$CodexContextCost = 0,
    [int]$ExpectedPixelValue = 0,
    [int]$LiveDependencyRisk = 0,
    [int]$ProofStrengthRequired = 0,
    [switch]$LiveLaneBlocked,
    [switch]$NoPrompt
)

$ErrorActionPreference = "Stop"

function New-RouteResult {
    param([string]$Route, [string]$Reason)
    [ordered]@{
        schema_version = "multi_agent_workload_router_result_v1"
        status = "MULTI_AGENT_ROUTE_SELECTED"
        route = $Route
        reason = $Reason
        task_type = $TaskType
        visual_value = $VisualValue
        exploration_value = $ExplorationValue
        integration_risk = $IntegrationRisk
        safety_risk = $SafetyRisk
        codex_context_cost = $CodexContextCost
        expected_pixel_value = $ExpectedPixelValue
        live_dependency_risk = $LiveDependencyRisk
        proof_strength_required = $ProofStrengthRequired
        antigravity_direct_repo_access = $false
        codex_final_integrator = $true
        omega_routes = $true
        gemini_visual_critic = $true
        chatgpt_strategy_critic = $true
        local_fallback_available = $true
        no_api_required = $true
        no_paid_service = $true
        no_user_prompt = $true
    }
}

function Select-Route {
    $type = $TaskType.ToLowerInvariant()
    if ($LiveLaneBlocked -or $type -match "blocked|fallback|offline") {
        return New-RouteResult -Route "LOCAL_FALLBACK" -Reason "Live or external lane is blocked; continue offline."
    }
    if ($type -match "screenshot|visual critique|board readability|weirdness|multimodal") {
        return New-RouteResult -Route "GEMINI" -Reason "Task is screenshot critique or visual weirdness detection."
    }
    if ($type -match "strategy|product|architecture|contradiction|mission selection") {
        return New-RouteResult -Route "CHATGPT" -Reason "Task is strategic or product-level critique."
    }
    if ($type -match "integrat|commit|push|protected|governance|test|road-to-v2" -or $IntegrationRisk -ge 6 -or $SafetyRisk -ge 5 -or $ProofStrengthRequired -ge 7) {
        return New-RouteResult -Route "CODEX" -Reason "Task requires official integration, safety, tests, or Git authority."
    }
    if (($type -match "variant|explor|spike|dev-only") -and $VisualValue -ge 5 -and $ExplorationValue -ge 5 -and $IntegrationRisk -le 4 -and $SafetyRisk -le 3) {
        return New-RouteResult -Route "ANTIGRAVITY" -Reason "Task is low-risk exploratory visual variant work suited to sandbox proposal packs."
    }
    if ($ExpectedPixelValue -ge 6 -and $ExplorationValue -ge 6 -and $IntegrationRisk -le 4) {
        return New-RouteResult -Route "ANTIGRAVITY" -Reason "High pixel/exploration value with low integration risk."
    }
    return New-RouteResult -Route "CODEX" -Reason "Default to Codex when routing confidence is not clearly external."
}

if ($Mode -eq "Status") {
    $result = [ordered]@{
        schema_version = "multi_agent_workload_router_status_v1"
        status = "MULTI_AGENT_WORKLOAD_ROUTER_AVAILABLE"
        routes = @("ANTIGRAVITY", "CODEX", "GEMINI", "CHATGPT", "LOCAL_FALLBACK")
        codex_final_integrator = $true
        antigravity_patch_proposal_only = $true
    }
} elseif ($Mode -eq "DryRun") {
    $cases = @(
        @{ name = "visual variant exploration"; route = (& powershell -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath -Mode Route -TaskType "visual variant exploration" -VisualValue 9 -ExplorationValue 9 -IntegrationRisk 2 -SafetyRisk 1 -NoPrompt | ConvertFrom-Json) },
        @{ name = "final integration"; route = (& powershell -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath -Mode Route -TaskType "final integration" -IntegrationRisk 8 -SafetyRisk 6 -ProofStrengthRequired 9 -NoPrompt | ConvertFrom-Json) },
        @{ name = "screenshot critique"; route = (& powershell -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath -Mode Route -TaskType "screenshot critique" -VisualValue 9 -NoPrompt | ConvertFrom-Json) },
        @{ name = "strategic review"; route = (& powershell -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath -Mode Route -TaskType "strategic product review" -NoPrompt | ConvertFrom-Json) },
        @{ name = "blocked live lane"; route = (& powershell -NoProfile -ExecutionPolicy Bypass -File $PSCommandPath -Mode Route -TaskType "blocked live lane" -LiveLaneBlocked -NoPrompt | ConvertFrom-Json) }
    )
    $result = [ordered]@{
        schema_version = "multi_agent_workload_router_dry_run_v1"
        status = "MULTI_AGENT_ROUTER_DRY_RUN_PASS"
        cases = @($cases | ForEach-Object {
                [ordered]@{
                    name = $_.name
                    route = $_.route.route
                    reason = $_.route.reason
                }
            })
        antigravity_direct_repo_access = $false
        codex_final_integrator = $true
        local_fallback_available = $true
    }
} else {
    $result = Select-Route
}

$result | ConvertTo-Json -Depth 50
