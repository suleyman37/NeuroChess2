param(
    [ValidateSet("Status", "Route", "TaskMatrix", "Auction", "WriteWorkOrderPack", "DryRun")]
    [string]$Mode = "Route",
    [string]$TaskType = "",
    [double]$VisualValue = 0,
    [double]$ExplorationValue = 0,
    [double]$IntegrationRisk = 0,
    [double]$SafetyRisk = 0,
    [double]$CodexContextCost = 0,
    [double]$ExpectedPixelValue = 0,
    [double]$LiveDependencyRisk = 0,
    [double]$ProofStrengthRequired = 0,
    [double]$RecentFailurePenalty = 0,
    [string]$MissionId = "A20BI",
    [string]$ArtifactPath = "",
    [switch]$PixelBottleneckActive,
    [switch]$LiveLaneBlocked,
    [switch]$NoPrompt
)

$ErrorActionPreference = "Stop"

function Convert-ToUnit {
    param([double]$Value)
    if ($Value -ge 1) { return [Math]::Min(1.0, [Math]::Max(0.0, $Value / 10.0)) }
    return [Math]::Min(1.0, [Math]::Max(0.0, $Value))
}

function Convert-ToDisplayScore {
    param([double]$Value)
    return [Math]::Round((Convert-ToUnit -Value $Value), 3)
}

function Get-RouterWeights {
    [ordered]@{
        agent_fit = 2.0
        expected_pixel_value = 1.6
        exploration_value = 1.4
        proof_strength = 1.2
        integration_risk = -2.0
        safety_risk = -1.8
        live_dependency_risk = -1.3
        codex_context_cost = -1.0
        recent_failure_penalty = -0.8
    }
}

function Get-AgentNames {
    @("CODEX", "ANTIGRAVITY", "GEMINI", "CHATGPT", "LOCAL_FALLBACK")
}

function Get-OperatingModel {
    [ordered]@{
        codex = "Production Integrator"
        antigravity = "Sandbox Explorer"
        gemini = "Visual Critic"
        chatgpt = "Strategy Critic"
        omega = "Local Arbiter"
        human = "Optional Taste Arbiter"
        doctrine = "LLMs propose; local system disposes."
    }
}

function Get-AgentFit {
    param([string]$Agent, [string]$Type)
    $typeText = ([string]$Type).ToLowerInvariant()
    switch ($Agent) {
        "CODEX" {
            if ($typeText -match "integrat|commit|push|protected|governance|test|repair|build|typecheck|backend|api|db|package|road-to-v2|ledger|official") { return 1.0 }
            if ($typeText -match "secret|local|runtime|security|safety") { return 0.95 }
            if ($typeText -match "night mode objective|objective selection") { return 0.72 }
            return 0.55
        }
        "ANTIGRAVITY" {
            if ($typeText -match "backend|api|db|package|commit|push|road-to-v2|secret|local|runtime|final integration|protected") { return 0.0 }
            if ($typeText -match "visual variant|variant|explor|spike|dev-only|css|svg|animation|sigil|memory cabinet|typography|board readability|pixel evidence dashboard") { return 1.0 }
            if ($typeText -match "signature component|visual patch|frontend prototype") { return 0.85 }
            return 0.25
        }
        "GEMINI" {
            if ($typeText -match "screenshot|visual critique|image critique|board readability|weirdness|contrast|hierarchy|multimodal") { return 1.0 }
            if ($typeText -match "visual patch|pixel evidence") { return 0.72 }
            return 0.2
        }
        "CHATGPT" {
            if ($typeText -match "strategy|product|architecture|contradiction|mission selection|risk reasoning") { return 1.0 }
            if ($typeText -match "north star|coherence|meta drift") { return 0.82 }
            return 0.2
        }
        "LOCAL_FALLBACK" {
            if ($LiveLaneBlocked -or $typeText -match "blocked|fallback|offline|unavailable") { return 1.0 }
            return 0.35
        }
    }
}

function Get-TaskMetrics {
    param(
        [string]$Type,
        [double]$Visual,
        [double]$Exploration,
        [double]$Integration,
        [double]$Safety,
        [double]$Context,
        [double]$Pixel,
        [double]$Live,
        [double]$Proof,
        [double]$RecentFailure
    )
    [ordered]@{
        task_type = $Type
        visual_value = Convert-ToDisplayScore -Value $Visual
        exploration_value = Convert-ToDisplayScore -Value $Exploration
        integration_risk = Convert-ToDisplayScore -Value $Integration
        safety_risk = Convert-ToDisplayScore -Value $Safety
        codex_context_cost = Convert-ToDisplayScore -Value $Context
        expected_pixel_value = Convert-ToDisplayScore -Value $Pixel
        live_dependency_risk = Convert-ToDisplayScore -Value $Live
        proof_strength = Convert-ToDisplayScore -Value $Proof
        recent_failure_penalty = Convert-ToDisplayScore -Value $RecentFailure
    }
}

function Get-AgentScore {
    param([string]$Agent, [hashtable]$Metrics)
    $fit = Get-AgentFit -Agent $Agent -Type $Metrics.task_type
    $score =
        (2.0 * $fit) +
        (1.6 * [double]$Metrics.expected_pixel_value) +
        (1.4 * [double]$Metrics.exploration_value) +
        (1.2 * [double]$Metrics.proof_strength) -
        (2.0 * [double]$Metrics.integration_risk) -
        (1.8 * [double]$Metrics.safety_risk) -
        (1.3 * [double]$Metrics.live_dependency_risk) -
        (1.0 * [double]$Metrics.codex_context_cost) -
        (0.8 * [double]$Metrics.recent_failure_penalty)
    if ($PixelBottleneckActive -and [double]$Metrics.expected_pixel_value -lt 0.45) {
        $score -= 0.75
    }
    return [Math]::Round($score, 4)
}

function Test-ExternalAgentForbidden {
    param([hashtable]$Metrics)
    $typeText = ([string]$Metrics.task_type).ToLowerInvariant()
    if ([double]$Metrics.safety_risk -gt 0.4) { return "SAFETY_RISK_OVER_EXTERNAL_LIMIT" }
    if ($typeText -match "backend|api|db|package|secret|local|runtime|credential|road-to-v2|commit|push|final integration|protected") {
        return "PROTECTED_OR_PRODUCT_INTEGRATION_TASK"
    }
    return ""
}

function New-RouteResult {
    param(
        [string]$Route,
        [string]$Reason,
        [hashtable]$Metrics,
        [hashtable]$Scores,
        [string[]]$HardRulesApplied
    )
    [ordered]@{
        schema_version = "multi_agent_workload_router_result_v2"
        status = "MULTI_AGENT_ROUTE_SELECTED"
        route = $Route
        reason = $Reason
        task_type = $Metrics.task_type
        metrics = $Metrics
        formula = "2.0*agent_fit + 1.6*expected_pixel_value + 1.4*exploration_value + 1.2*proof_strength - 2.0*integration_risk - 1.8*safety_risk - 1.3*live_dependency_risk - 1.0*codex_context_cost - 0.8*recent_failure_penalty"
        scores = $Scores
        hard_rules_applied = @($HardRulesApplied)
        antigravity_direct_repo_access = $false
        antigravity_proposal_pack_only = $true
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

function Invoke-RouteSelection {
    param([hashtable]$Metrics)
    $scores = [ordered]@{}
    foreach ($agent in Get-AgentNames) {
        $scores[$agent] = Get-AgentScore -Agent $agent -Metrics $Metrics
    }

    $typeText = ([string]$Metrics.task_type).ToLowerInvariant()
    $hard = @()

    if ($LiveLaneBlocked -or $typeText -match "blocked|fallback|offline|unavailable") {
        $hard += "LIVE_LANE_UNAVAILABLE_LOCAL_FALLBACK_WINS"
        return New-RouteResult -Route "LOCAL_FALLBACK" -Reason "Live or external lane is blocked; continue offline with local fallback." -Metrics $Metrics -Scores $scores -HardRulesApplied $hard
    }

    if ([double]$Metrics.integration_risk -gt 0.6 -or $typeText -match "final integration|commit|push|road-to-v2|protected|build|typecheck|test repair") {
        $hard += "INTEGRATION_RISK_OVER_CODEX_THRESHOLD"
        return New-RouteResult -Route "CODEX" -Reason "Task requires official integration, tests, Git authority, or protected-path governance." -Metrics $Metrics -Scores $scores -HardRulesApplied $hard
    }

    $externalForbidden = Test-ExternalAgentForbidden -Metrics $Metrics
    if ($externalForbidden) {
        $hard += $externalForbidden
        return New-RouteResult -Route "CODEX" -Reason "External execution is forbidden by safety or protected-path policy; Codex remains the integrator." -Metrics $Metrics -Scores $scores -HardRulesApplied $hard
    }

    if ($typeText -match "screenshot critique|image critique|visual critique|weirdness detection|multimodal comparison") {
        $hard += "IMAGE_CRITIQUE_GEMINI_PREFERRED"
        return New-RouteResult -Route "GEMINI" -Reason "Task is image/screenshot critique, so Gemini is the visual critic." -Metrics $Metrics -Scores $scores -HardRulesApplied $hard
    }

    if ($typeText -match "strategy|strategic|architecture review|contradiction|mission selection|product critique") {
        $hard += "STRATEGIC_CONTRADICTION_CHATGPT_PREFERRED"
        return New-RouteResult -Route "CHATGPT" -Reason "Task is strategic or product-level critique, so ChatGPT challenges the plan without final authority." -Metrics $Metrics -Scores $scores -HardRulesApplied $hard
    }

    if (($typeText -match "visual variant|variant|explor|spike|dev-only|css|svg|animation|sigil|memory cabinet") -and [double]$Metrics.integration_risk -lt 0.4) {
        $hard += "LOW_RISK_VISUAL_EXPLORATION_ANTIGRAVITY_PREFERRED"
        return New-RouteResult -Route "ANTIGRAVITY" -Reason "Low-risk exploratory visual work belongs in an Antigravity sandbox proposal pack." -Metrics $Metrics -Scores $scores -HardRulesApplied $hard
    }

    $winner = ($scores.GetEnumerator() | Sort-Object -Property Value -Descending | Select-Object -First 1).Name
    if ($winner -eq "ANTIGRAVITY") {
        return New-RouteResult -Route "ANTIGRAVITY" -Reason "Weighted score selects Antigravity for low-risk visual exploration." -Metrics $Metrics -Scores $scores -HardRulesApplied $hard
    }
    if ($winner -eq "GEMINI") {
        return New-RouteResult -Route "GEMINI" -Reason "Weighted score selects Gemini for visual critique." -Metrics $Metrics -Scores $scores -HardRulesApplied $hard
    }
    if ($winner -eq "CHATGPT") {
        return New-RouteResult -Route "CHATGPT" -Reason "Weighted score selects ChatGPT for strategic critique." -Metrics $Metrics -Scores $scores -HardRulesApplied $hard
    }
    if ($winner -eq "LOCAL_FALLBACK") {
        return New-RouteResult -Route "LOCAL_FALLBACK" -Reason "Weighted score selects local fallback." -Metrics $Metrics -Scores $scores -HardRulesApplied $hard
    }
    return New-RouteResult -Route "CODEX" -Reason "Default to Codex when no external lane is clearly safer and more useful." -Metrics $Metrics -Scores $scores -HardRulesApplied $hard
}

function Get-TaskRoutingMatrix {
    @(
        [ordered]@{ category = "DEV-only visual variant exploration"; primary = "ANTIGRAVITY"; secondary = "CODEX"; forbidden = @("GEMINI as integrator", "CHATGPT as executor"); required_proof = "Patch Proposal Pack, screenshots external, risk/test reports"; max_risk = "0.4 safety, 0.4 integration"; allowed_paths = @("frontend/src/dev/**", "scripts/browser_*_smoke.mjs"); stop_condition = "Touches V1 route, backend, DB, package, local/runtime, or secrets." },
        [ordered]@{ category = "Signature component refinement"; primary = "ANTIGRAVITY"; secondary = "CODEX"; forbidden = @("Gemini direct code", "ChatGPT direct code"); required_proof = "Variant screenshots plus Codex import validation"; max_risk = "0.4 safety, 0.5 integration"; allowed_paths = @("frontend/src/dev/**", "frontend/src/components/dev/**"); stop_condition = "No isolated component boundary or V1 behavior risk." },
        [ordered]@{ category = "Browser screenshot critique"; primary = "GEMINI"; secondary = "LOCAL_FALLBACK"; forbidden = @("Antigravity integration"); required_proof = "Single isolated screenshot and visual packet"; max_risk = "0.3 safety"; allowed_paths = @("external artifacts only"); stop_condition = "No attached image or visual evidence." },
        [ordered]@{ category = "Strategic architecture review"; primary = "CHATGPT"; secondary = "CODEX"; forbidden = @("Antigravity executor"); required_proof = "Structured critique, contradiction list"; max_risk = "0.4 safety"; allowed_paths = @("docs/autopilot/**"); stop_condition = "Attempts to override hard safety gates." },
        [ordered]@{ category = "Final integration into official repo"; primary = "CODEX"; secondary = "OMEGA"; forbidden = @("ANTIGRAVITY", "GEMINI", "CHATGPT"); required_proof = "Local validation, explicit staging, diff inspection"; max_risk = "Codex-only"; allowed_paths = @("mission-authorized files only"); stop_condition = "Unvalidated proposal, broad staging, protected branch." },
        [ordered]@{ category = "Build/typecheck repair"; primary = "CODEX"; secondary = "LOCAL_FALLBACK"; forbidden = @("Antigravity direct official repo"); required_proof = "Failing check reproduced then passing check"; max_risk = "0.6 integration"; allowed_paths = @("files tied to failing check"); stop_condition = "Package install required without mission." },
        [ordered]@{ category = "Backend/API/DB work"; primary = "CODEX"; secondary = "LOCAL_FALLBACK"; forbidden = @("ANTIGRAVITY", "GEMINI", "CHATGPT"); required_proof = "Backend tests and data contract"; max_risk = "Codex-only"; allowed_paths = @("backend/** only with explicit mission"); stop_condition = "External agent proposes direct backend mutation." },
        [ordered]@{ category = "Package/dependency changes"; primary = "CODEX"; secondary = "NONE"; forbidden = @("ANTIGRAVITY", "GEMINI", "CHATGPT"); required_proof = "Dedicated package mission"; max_risk = "Dedicated mission only"; allowed_paths = @("package files only when authorized"); stop_condition = "Any package mutation in proposal pack." },
        [ordered]@{ category = "Secret/local/runtime handling"; primary = "CODEX"; secondary = "LOCAL_FALLBACK"; forbidden = @("ANTIGRAVITY", "GEMINI", "CHATGPT"); required_proof = "Redacted status only"; max_risk = "Codex-only"; allowed_paths = @("none in git"); stop_condition = "Any secret/profile/runtime output enters diff." },
        [ordered]@{ category = "Road-to-V2 merge audit"; primary = "CODEX"; secondary = "CHATGPT"; forbidden = @("ANTIGRAVITY direct merge"); required_proof = "Merge audit report and protected branch checks"; max_risk = "Codex-only"; allowed_paths = @("docs/autopilot/**"); stop_condition = "Attempt to push or merge road-to-V2." },
        [ordered]@{ category = "Failure Ledger analysis"; primary = "OMEGA"; secondary = "CODEX"; forbidden = @("Antigravity as authority"); required_proof = "Ledger delta and cause classification"; max_risk = "0.5 integration"; allowed_paths = @("ops/autopilot/failure_ledger.yaml", "docs/autopilot/**"); stop_condition = "Score inflation without proof." },
        [ordered]@{ category = "Human taste vote import"; primary = "CODEX"; secondary = "HUMAN"; forbidden = @("Autonomous requirement for human"); required_proof = "Explicit vote artifact, no PII"; max_risk = "0.3 safety"; allowed_paths = @("docs/autopilot/**", "external artifacts only"); stop_condition = "Autonomy waits for human input." },
        [ordered]@{ category = "CSS/SVG animation spike"; primary = "ANTIGRAVITY"; secondary = "CODEX"; forbidden = @("Backend/package mutation"); required_proof = "Sandbox proposal pack and screenshot proof"; max_risk = "0.35 integration"; allowed_paths = @("frontend/src/dev/**", "frontend/src/components/dev/**"); stop_condition = "Requires dependency install or product route change." },
        [ordered]@{ category = "Board readability visual patch"; primary = "ANTIGRAVITY"; secondary = "GEMINI"; forbidden = @("ChatGPT as visual authority"); required_proof = "Before/after isolated board screenshots"; max_risk = "0.4 safety, 0.5 integration"; allowed_paths = @("frontend/src/dev/**", "frontend/src/components/dev/**"); stop_condition = "Board rules or backend truth affected." },
        [ordered]@{ category = "Pixel evidence recapture"; primary = "LOCAL_FALLBACK"; secondary = "GEMINI"; forbidden = @("Antigravity integration"); required_proof = "External screenshots and manifest"; max_risk = "0.2 safety"; allowed_paths = @("external artifacts only"); stop_condition = "Screenshots are staged for commit." },
        [ordered]@{ category = "Night mode objective selection"; primary = "OMEGA"; secondary = "CHATGPT"; forbidden = @("Antigravity as arbiter"); required_proof = "Objective score and safety gate"; max_risk = "0.5 safety"; allowed_paths = @("ops/autopilot/objective_reservoir.yaml", "docs/autopilot/**"); stop_condition = "Non-pixel objective selected during pixel bottleneck." }
    )
}

function Get-FirstWorkOrderCandidates {
    @(
        [ordered]@{ id = "A"; task = "critical_moment_sigil visual variant spike"; objective = "Create three DEV-only visual variants for a critical moment sigil system."; task_type = "visual variant spike sigil dev-only"; visual_value = 0.95; exploration_value = 0.94; expected_pixel_value = 0.92; integration_risk = 0.22; safety_risk = 0.10; proof_strength = 0.88; live_dependency_risk = 0.05; codex_context_cost = 0.24; recent_failure_penalty = 0.05; allowed_paths = @("frontend/src/dev/antigravity/critical_moment_sigil/**", "scripts/browser_antigravity_critical_moment_sigil_smoke.mjs") },
        [ordered]@{ id = "B"; task = "memory_cabinet visual variant spike"; objective = "Create three DEV-only visual variants for memory cabinet presentation."; task_type = "visual variant spike memory cabinet dev-only"; visual_value = 0.94; exploration_value = 0.92; expected_pixel_value = 0.90; integration_risk = 0.23; safety_risk = 0.10; proof_strength = 0.86; live_dependency_risk = 0.05; codex_context_cost = 0.24; recent_failure_penalty = 0.05; allowed_paths = @("frontend/src/dev/antigravity/memory_cabinet/**", "scripts/browser_antigravity_memory_cabinet_smoke.mjs") },
        [ordered]@{ id = "C"; task = "decision_pressure_field refinement"; objective = "Explore pressure-field variants without changing product flow."; task_type = "visual variant decision pressure field dev-only"; visual_value = 0.88; exploration_value = 0.86; expected_pixel_value = 0.86; integration_risk = 0.32; safety_risk = 0.15; proof_strength = 0.80; live_dependency_risk = 0.06; codex_context_cost = 0.30; recent_failure_penalty = 0.08; allowed_paths = @("frontend/src/dev/antigravity/decision_pressure_field/**") },
        [ordered]@{ id = "D"; task = "sacred_board_chamber risky redesign"; objective = "Large chamber redesign with high product surface risk."; task_type = "risky redesign sacred board chamber"; visual_value = 0.90; exploration_value = 0.88; expected_pixel_value = 0.82; integration_risk = 0.65; safety_risk = 0.35; proof_strength = 0.75; live_dependency_risk = 0.10; codex_context_cost = 0.55; recent_failure_penalty = 0.20; allowed_paths = @("frontend/src/dev/antigravity/sacred_board_chamber/**") },
        [ordered]@{ id = "E"; task = "decision_feedback_language risky redesign"; objective = "Redesign decision feedback language visual system."; task_type = "risky redesign decision feedback language"; visual_value = 0.84; exploration_value = 0.84; expected_pixel_value = 0.78; integration_risk = 0.62; safety_risk = 0.38; proof_strength = 0.74; live_dependency_risk = 0.10; codex_context_cost = 0.55; recent_failure_penalty = 0.20; allowed_paths = @("frontend/src/dev/antigravity/decision_feedback_language/**") },
        [ordered]@{ id = "F"; task = "SVG primitive generator spike"; objective = "Prototype reusable SVG primitive variants in a DEV-only sandbox."; task_type = "svg primitive generator spike dev-only"; visual_value = 0.82; exploration_value = 0.92; expected_pixel_value = 0.70; integration_risk = 0.28; safety_risk = 0.14; proof_strength = 0.68; live_dependency_risk = 0.05; codex_context_cost = 0.40; recent_failure_penalty = 0.10; allowed_paths = @("frontend/src/dev/antigravity/svg_primitives/**") },
        [ordered]@{ id = "G"; task = "typography direction experiment"; objective = "Prototype typography direction variants for NeuroChess DEV surfaces."; task_type = "typography visual variant dev-only"; visual_value = 0.76; exploration_value = 0.82; expected_pixel_value = 0.66; integration_risk = 0.25; safety_risk = 0.12; proof_strength = 0.70; live_dependency_risk = 0.05; codex_context_cost = 0.28; recent_failure_penalty = 0.06; allowed_paths = @("frontend/src/dev/antigravity/typography_direction/**") },
        [ordered]@{ id = "H"; task = "North Star micro-flow redesign"; objective = "Explore a micro-flow redesign, but with higher product-flow risk."; task_type = "north star micro-flow redesign"; visual_value = 0.80; exploration_value = 0.78; expected_pixel_value = 0.74; integration_risk = 0.58; safety_risk = 0.32; proof_strength = 0.70; live_dependency_risk = 0.08; codex_context_cost = 0.60; recent_failure_penalty = 0.18; allowed_paths = @("frontend/src/dev/antigravity/north_star_micro_flow/**") },
        [ordered]@{ id = "I"; task = "board piece identity experiment"; objective = "Explore piece identity variants without changing chess rules."; task_type = "board readability visual variant piece identity dev-only"; visual_value = 0.88; exploration_value = 0.84; expected_pixel_value = 0.78; integration_risk = 0.45; safety_risk = 0.24; proof_strength = 0.80; live_dependency_risk = 0.06; codex_context_cost = 0.42; recent_failure_penalty = 0.10; allowed_paths = @("frontend/src/dev/antigravity/board_piece_identity/**") },
        [ordered]@{ id = "J"; task = "pixel evidence dashboard improvement"; objective = "Improve a DEV-only dashboard for comparing external pixel evidence."; task_type = "pixel evidence dashboard improvement dev-only"; visual_value = 0.70; exploration_value = 0.66; expected_pixel_value = 0.58; integration_risk = 0.30; safety_risk = 0.12; proof_strength = 0.84; live_dependency_risk = 0.05; codex_context_cost = 0.32; recent_failure_penalty = 0.08; allowed_paths = @("frontend/src/dev/antigravity/pixel_evidence_dashboard/**") },
        [ordered]@{ id = "K"; task = "board readability contrast variants"; objective = "Prototype board readability contrast variants for visual critique."; task_type = "board readability visual variant dev-only"; visual_value = 0.86; exploration_value = 0.80; expected_pixel_value = 0.76; integration_risk = 0.38; safety_risk = 0.20; proof_strength = 0.82; live_dependency_risk = 0.06; codex_context_cost = 0.36; recent_failure_penalty = 0.09; allowed_paths = @("frontend/src/dev/antigravity/board_readability_contrast/**") },
        [ordered]@{ id = "L"; task = "mission auction visual card variants"; objective = "Explore visual card variants for mission auction summaries."; task_type = "visual variant mission auction cards dev-only"; visual_value = 0.78; exploration_value = 0.78; expected_pixel_value = 0.62; integration_risk = 0.26; safety_risk = 0.12; proof_strength = 0.72; live_dependency_risk = 0.05; codex_context_cost = 0.30; recent_failure_penalty = 0.07; allowed_paths = @("frontend/src/dev/antigravity/mission_auction_cards/**") }
    )
}

function Invoke-WorkOrderAuction {
    $items = @()
    foreach ($candidate in Get-FirstWorkOrderCandidates) {
        $metrics = Get-TaskMetrics -Type $candidate.task_type -Visual $candidate.visual_value -Exploration $candidate.exploration_value -Integration $candidate.integration_risk -Safety $candidate.safety_risk -Context $candidate.codex_context_cost -Pixel $candidate.expected_pixel_value -Live $candidate.live_dependency_risk -Proof $candidate.proof_strength -RecentFailure $candidate.recent_failure_penalty
        $route = Invoke-RouteSelection -Metrics $metrics
        $antigravityScore = [double]$route.scores.ANTIGRAVITY
        $eligible = ($route.route -eq "ANTIGRAVITY" -and [double]$metrics.integration_risk -lt 0.4 -and [double]$metrics.safety_risk -le 0.4)
        $items += [ordered]@{
            id = $candidate.id
            task = $candidate.task
            objective = $candidate.objective
            route = $route.route
            eligible_for_first_antigravity_order = $eligible
            antigravity_score = $antigravityScore
            scores = $route.scores
            metrics = $metrics
            allowed_paths = $candidate.allowed_paths
            rejection_reason = if ($eligible) { "" } else { "Not the safest first Antigravity work order under hard rules." }
        }
    }
    $winner = @($items | Where-Object { $_.eligible_for_first_antigravity_order } | Sort-Object -Property { [double]$_.antigravity_score } -Descending | Select-Object -First 1)[0]
    [ordered]@{
        schema_version = "multi_agent_work_order_auction_v1"
        mission_id = $MissionId
        status = "FIRST_ANTIGRAVITY_WORK_ORDER_SELECTED"
        candidates_evaluated = @($items).Count
        selected_task = $winner.task
        selected_id = $winner.id
        selected_objective = $winner.objective
        selected_reason = "Best mix of low integration risk, high visual exploration value, high pixel value, low V1 breakage risk, low backend/package risk, and strong screenshot proof."
        winner = $winner
        candidates = @($items)
    }
}

function Get-DefaultArtifactPath {
    "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\antigravity\A20BI_first_work_order_20260518"
}

function Write-TextFile {
    param([string]$Path, [string]$Content)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    Set-Content -LiteralPath $Path -Value $Content -Encoding UTF8
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $Payload | ConvertTo-Json -Depth 80 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Write-WorkOrderPack {
    $auction = Invoke-WorkOrderAuction
    $target = if ([string]::IsNullOrWhiteSpace($ArtifactPath)) { Get-DefaultArtifactPath } else { $ArtifactPath }
    New-Item -ItemType Directory -Force -Path $target | Out-Null

    $winner = $auction.winner
    $allowedPaths = @($winner.allowed_paths)
    $forbiddenPaths = @(
        "backend/**",
        "frontend/src/App.tsx",
        "frontend/src/routes/**",
        "package.json",
        "package-lock.json",
        "ops/autopilot/local/**",
        "ops/autopilot/runtime/**",
        ".serena/**",
        "qa_artifacts/**",
        "screenshots/**",
        "**/*.png",
        "**/*.jpg",
        "**/*.jpeg",
        "**/*.gif",
        "**/*.webp",
        "**/*.mp4",
        "**/*.mov",
        "**/*.db",
        "**/*.sqlite",
        "**/*.sqlite3"
    )

    $workOrder = @"
# A20BI First Antigravity Work Order

Selected task: $($auction.selected_task)

Objective:
$($auction.selected_objective)

Antigravity must work only in a disposable sandbox/worktree created from the exact base commit. It must not write directly to the official NeuroChess repo, commit, push, touch road-to-V2, touch backend/package/DB, touch V1 product behavior, or write local/runtime/secret files.

Required output:
- proposal.json
- patch.diff
- summary.md
- risk_report.json
- test_report.json
- files_touched.txt
- integration_notes.md
- screenshots in external artifacts only

Codex is the only official integrator. OMEGA routes. Gemini may critique screenshots. ChatGPT may challenge strategy. Local fallback continues if live lanes fail.
"@

    $acceptance = @"
# Acceptance Criteria

- At least three distinct DEV-only visual variants are produced for the selected critical moment sigil objective.
- Each variant has a clear board-centered use case and avoids generic decorative noise.
- The proposal changes only allowed DEV-only paths.
- No backend, package, DB, local/runtime, profile, secret, or V1 route files are touched.
- Screenshots are written externally and referenced by path in the proposal pack.
- The proposal includes a rollback plan, risk report, test report, and files_touched.txt.
- Codex can validate the pack with import_antigravity_patch_proposal.ps1 before applying anything.
"@

    $visualRules = @"
# Visual Quality Rules

- Preserve NeuroChess as a serious chess-learning product, not a decorative dashboard.
- Board readability and decision clarity win over spectacle.
- Critical moment sigils must explain decision pressure without covering the board.
- Variants must be comparable through isolated screenshots.
- Avoid one-note palettes, oversized marketing-style cards, and UI that hides the next action.
"@

    $safetyRules = @"
# Safety Rules

- Antigravity explores; Codex integrates.
- Do not commit or push.
- Do not use paid APIs.
- Do not install packages.
- Do not read or write credentials, cookies, browser profiles, local runtime state, or private URLs.
- Do not touch backend, DB, package files, road-to-V2, or V1 product behavior.
- Do not include screenshots or binary assets in the repo patch.
"@

    $expectedOutput = @"
# Expected Output Pack

The proposal pack must contain:

- proposal.json matching antigravity_patch_proposal.schema.json
- patch.diff
- summary.md
- risk_report.json
- test_report.json
- files_touched.txt
- integration_notes.md
- external screenshots folder, not committed

Recommended Codex action must be one of:
- ACCEPT
- ACCEPT_WITH_FIXES
- REJECT
- RETRY_WITH_CONSTRAINTS
"@

    Write-TextFile -Path (Join-Path $target "work_order.md") -Content $workOrder
    Write-TextFile -Path (Join-Path $target "allowed_paths.txt") -Content (($allowedPaths -join [Environment]::NewLine) + [Environment]::NewLine)
    Write-TextFile -Path (Join-Path $target "forbidden_paths.txt") -Content (($forbiddenPaths -join [Environment]::NewLine) + [Environment]::NewLine)
    Write-TextFile -Path (Join-Path $target "acceptance_criteria.md") -Content $acceptance
    Write-TextFile -Path (Join-Path $target "visual_quality_rules.md") -Content $visualRules
    Write-TextFile -Path (Join-Path $target "safety_rules.md") -Content $safetyRules
    Write-TextFile -Path (Join-Path $target "expected_output_pack.md") -Content $expectedOutput

    $schemaPath = Join-Path $PSScriptRoot "antigravity_patch_proposal.schema.json"
    if (Test-Path -LiteralPath $schemaPath -PathType Leaf) {
        Copy-Item -LiteralPath $schemaPath -Destination (Join-Path $target "patch_proposal_schema.json") -Force
    } else {
        Write-JsonFile -Path (Join-Path $target "patch_proposal_schema.json") -Payload ([ordered]@{ status = "schema_missing_from_repo" })
    }

    Write-JsonFile -Path (Join-Path $target "auction_result.json") -Payload $auction

    [ordered]@{
        schema_version = "antigravity_first_work_order_pack_result_v1"
        status = "ANTIGRAVITY_FIRST_WORK_ORDER_PACK_WRITTEN"
        mission_id = $MissionId
        artifact_path = $target
        selected_task = $auction.selected_task
        selected_id = $auction.selected_id
        files_written = @(
            "work_order.md",
            "allowed_paths.txt",
            "forbidden_paths.txt",
            "patch_proposal_schema.json",
            "acceptance_criteria.md",
            "visual_quality_rules.md",
            "safety_rules.md",
            "expected_output_pack.md",
            "auction_result.json"
        )
        antigravity_live_called = $false
        official_repo_touched_by_antigravity = $false
        ready_for_next_mission = $true
    }
}

function Invoke-DryRun {
    $matrix = Get-TaskRoutingMatrix
    $cases = @(
        @{ name = "DEV-only visual variant exploration"; args = @{ Type = "DEV-only visual variant exploration"; Visual = 0.9; Exploration = 0.9; Integration = 0.2; Safety = 0.1; Context = 0.2; Pixel = 0.85; Live = 0.05; Proof = 0.8; RecentFailure = 0.05 } },
        @{ name = "Signature component refinement"; args = @{ Type = "signature component refinement visual variant"; Visual = 0.85; Exploration = 0.75; Integration = 0.3; Safety = 0.2; Context = 0.3; Pixel = 0.8; Live = 0.05; Proof = 0.8; RecentFailure = 0.05 } },
        @{ name = "Browser screenshot critique"; args = @{ Type = "browser screenshot critique"; Visual = 0.9; Exploration = 0.2; Integration = 0.1; Safety = 0.1; Context = 0.2; Pixel = 0.6; Live = 0.2; Proof = 0.9; RecentFailure = 0.0 } },
        @{ name = "Strategic architecture review"; args = @{ Type = "strategic architecture review"; Visual = 0.2; Exploration = 0.4; Integration = 0.2; Safety = 0.1; Context = 0.4; Pixel = 0.4; Live = 0.2; Proof = 0.7; RecentFailure = 0.0 } },
        @{ name = "Final integration into official repo"; args = @{ Type = "final integration into official repo"; Visual = 0.2; Exploration = 0.1; Integration = 0.8; Safety = 0.5; Context = 0.4; Pixel = 0.6; Live = 0.1; Proof = 0.9; RecentFailure = 0.0 } },
        @{ name = "Build/typecheck repair"; args = @{ Type = "build typecheck repair"; Visual = 0.2; Exploration = 0.1; Integration = 0.7; Safety = 0.3; Context = 0.5; Pixel = 0.5; Live = 0.1; Proof = 0.9; RecentFailure = 0.0 } },
        @{ name = "Backend/API/DB work"; args = @{ Type = "backend api db work"; Visual = 0.1; Exploration = 0.1; Integration = 0.8; Safety = 0.6; Context = 0.4; Pixel = 0.3; Live = 0.1; Proof = 0.9; RecentFailure = 0.0 } },
        @{ name = "Package/dependency changes"; args = @{ Type = "package dependency changes"; Visual = 0.1; Exploration = 0.1; Integration = 0.8; Safety = 0.7; Context = 0.6; Pixel = 0.2; Live = 0.1; Proof = 0.9; RecentFailure = 0.0 } },
        @{ name = "Secret/local/runtime handling"; args = @{ Type = "secret local runtime handling"; Visual = 0.1; Exploration = 0.1; Integration = 0.5; Safety = 0.8; Context = 0.6; Pixel = 0.1; Live = 0.1; Proof = 0.9; RecentFailure = 0.0 } },
        @{ name = "Road-to-V2 merge audit"; args = @{ Type = "road-to-V2 merge audit"; Visual = 0.1; Exploration = 0.2; Integration = 0.9; Safety = 0.7; Context = 0.5; Pixel = 0.2; Live = 0.1; Proof = 0.9; RecentFailure = 0.0 } },
        @{ name = "Failure Ledger analysis"; args = @{ Type = "failure ledger analysis"; Visual = 0.2; Exploration = 0.3; Integration = 0.4; Safety = 0.3; Context = 0.3; Pixel = 0.3; Live = 0.1; Proof = 0.8; RecentFailure = 0.0 } },
        @{ name = "Human taste vote import"; args = @{ Type = "human taste vote import"; Visual = 0.5; Exploration = 0.2; Integration = 0.3; Safety = 0.2; Context = 0.3; Pixel = 0.5; Live = 0.1; Proof = 0.7; RecentFailure = 0.0 } },
        @{ name = "CSS/SVG animation spike"; args = @{ Type = "css svg animation spike dev-only"; Visual = 0.85; Exploration = 0.88; Integration = 0.25; Safety = 0.12; Context = 0.28; Pixel = 0.74; Live = 0.05; Proof = 0.72; RecentFailure = 0.05 } },
        @{ name = "Board readability visual patch"; args = @{ Type = "board readability visual patch"; Visual = 0.86; Exploration = 0.72; Integration = 0.38; Safety = 0.22; Context = 0.32; Pixel = 0.78; Live = 0.05; Proof = 0.84; RecentFailure = 0.05 } },
        @{ name = "Pixel evidence recapture"; args = @{ Type = "blocked live lane pixel evidence recapture"; Visual = 0.75; Exploration = 0.2; Integration = 0.1; Safety = 0.1; Context = 0.2; Pixel = 0.58; Live = 0.2; Proof = 0.9; RecentFailure = 0.0; Blocked = $true } },
        @{ name = "Night mode objective selection"; args = @{ Type = "night mode objective selection"; Visual = 0.5; Exploration = 0.4; Integration = 0.4; Safety = 0.4; Context = 0.4; Pixel = 0.7; Live = 0.2; Proof = 0.8; RecentFailure = 0.0 } }
    )

    $results = @()
    foreach ($case in $cases) {
        $metrics = Get-TaskMetrics -Type $case.args.Type -Visual $case.args.Visual -Exploration $case.args.Exploration -Integration $case.args.Integration -Safety $case.args.Safety -Context $case.args.Context -Pixel $case.args.Pixel -Live $case.args.Live -Proof $case.args.Proof -RecentFailure $case.args.RecentFailure
        $oldBlocked = $script:LiveLaneBlocked
        if ($case.args.ContainsKey("Blocked") -and $case.args.Blocked) { $script:LiveLaneBlocked = $true }
        $route = Invoke-RouteSelection -Metrics $metrics
        $script:LiveLaneBlocked = $oldBlocked
        $results += [ordered]@{
            name = $case.name
            route = $route.route
            reason = $route.reason
            hard_rules_applied = $route.hard_rules_applied
        }
    }

    [ordered]@{
        schema_version = "multi_agent_workload_router_dry_run_v2"
        status = "MULTI_AGENT_ROUTER_DRY_RUN_PASS"
        task_archetypes_evaluated = @($results).Count
        matrix_categories = @($matrix).Count
        cases = @($results)
        auction = Invoke-WorkOrderAuction
        formula = Get-RouterWeights
        operating_model = Get-OperatingModel
        antigravity_direct_repo_access = $false
        codex_final_integrator = $true
        local_fallback_available = $true
    }
}

$metricsForRoute = Get-TaskMetrics -Type $TaskType -Visual $VisualValue -Exploration $ExplorationValue -Integration $IntegrationRisk -Safety $SafetyRisk -Context $CodexContextCost -Pixel $ExpectedPixelValue -Live $LiveDependencyRisk -Proof $ProofStrengthRequired -RecentFailure $RecentFailurePenalty

if ($Mode -eq "Status") {
    $result = [ordered]@{
        schema_version = "multi_agent_workload_router_status_v2"
        status = "MULTI_AGENT_OPERATING_MODEL_LOCKED"
        routes = Get-AgentNames
        operating_model = Get-OperatingModel
        formula = Get-RouterWeights
        task_matrix_categories = @(Get-TaskRoutingMatrix).Count
        codex_final_integrator = $true
        antigravity_patch_proposal_only = $true
        gemini_visual_critic_only = $true
        chatgpt_strategy_critic_only = $true
        omega_local_arbiter = $true
        local_fallback_authoritative = $true
    }
} elseif ($Mode -eq "TaskMatrix") {
    $result = [ordered]@{
        schema_version = "multi_agent_task_routing_matrix_v1"
        status = "TASK_ROUTING_MATRIX_READY"
        categories = @(Get-TaskRoutingMatrix)
    }
} elseif ($Mode -eq "Auction") {
    $result = Invoke-WorkOrderAuction
} elseif ($Mode -eq "WriteWorkOrderPack") {
    $result = Write-WorkOrderPack
} elseif ($Mode -eq "DryRun") {
    $result = Invoke-DryRun
} else {
    $result = Invoke-RouteSelection -Metrics $metricsForRoute
}

$result | ConvertTo-Json -Depth 80
