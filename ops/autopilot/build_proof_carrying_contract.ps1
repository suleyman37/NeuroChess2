param(
    [string]$MissionId = "A20AU",
    [string]$UtilityPath = "",
    [string]$ObjectiveId = "",
    [string]$OutPath = "",
    [string]$ContractOutPath = "",
    [int]$MaxWords = 900
)

$ErrorActionPreference = "Stop"

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 50 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Write-TextFile {
    param([string]$Path, [string]$Text)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Text | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Count-Words {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return 0 }
    return @($Text -split '\s+' | Where-Object { $_ }).Count
}

function New-FallbackWinner {
    param([string]$Id)
    [pscustomobject]@{
        id = $Id
        expected_value = "Create visible DEV-only OMEGA Pixel Lab proof and route the next pixel mission."
        family = "SIGNATURE_COMPONENTS"
        risk_tier = "low"
        allowed_paths = @("frontend/src/dev/omega-pixel-lab/**", "frontend/src/App.tsx", "scripts/**", "docs/autopilot/**", "ops/autopilot/**")
        forbidden_paths = @("backend/**", "package.json", "package-lock.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
        expected_artifacts = @("omega_pixel_lab_smoke_report.json", "screenshot/**", "selected_contract.md")
        success_criteria = @("visible_dev_route", "pixel_pilot_screenshot_external", "browser_smoke_pass", "no_product_integration")
    }
}

$winner = $null
if (-not [string]::IsNullOrWhiteSpace($UtilityPath) -and (Test-Path -LiteralPath $UtilityPath -PathType Leaf)) {
    $utility = Get-Content -LiteralPath $UtilityPath -Raw | ConvertFrom-Json
    $winner = $utility.winner
}
if (-not $winner) {
    if ([string]::IsNullOrWhiteSpace($ObjectiveId)) { $ObjectiveId = "A20AU_VARIANT_REFINEMENT_FOR_PROVISIONAL_WINNERS" }
    $winner = New-FallbackWinner -Id $ObjectiveId
}

$expectedProof = @(
    "DEV-only /app?omegaPixelLab=1 route or selected pixel route visible.",
    "At least one visual pilot artifact rendered, not text-only.",
    "External screenshot evidence captured outside the repo.",
    "Browser smoke verifies bottleneck, selected objective, and pilot artifact.",
    "Mission Doctor or OMEGA grading records conservative score delta."
)
if (@($expectedProof).Count -eq 0) { throw "PROOF_REQUIRED" }

$tests = @(
    "git diff --check",
    "cd frontend; npm run build",
    "cd frontend; npx tsc --noEmit",
    "node scripts/browser_omega_pixel_lab_smoke.mjs",
    "powershell -ExecutionPolicy Bypass -File ops/autopilot/test_omega_autopilot.ps1",
    "python tools/plan_guard.py"
)

$contract = [ordered]@{
    schema_version = "proof_carrying_contract_v1"
    mission_id = $MissionId
    objective_id = [string]$winner.id
    objective = [string]$winner.expected_value
    expected_proof = $expectedProof
    allowed_paths = @($winner.allowed_paths)
    forbidden_paths = @($winner.forbidden_paths)
    max_files = 8
    max_diff_lines = 1200
    test_commands = $tests
    stop_conditions = @(
        "Stop if frontend product flow changes.",
        "Stop if screenshot evidence cannot be written outside the repo.",
        "Stop if contract exceeds 900 words after compression.",
        "Stop if backend, package, DB, local/runtime, screenshots, or secrets would be staged."
    )
    evidence_artifacts = @(
        "bottleneck_detection_result.json",
        "utility_ranking_result.json",
        "omega_pixel_lab_smoke_report.json",
        "screenshot/omega_pixel_lab.png",
        "score_update.json"
    )
    score_delta_rules = [ordered]@{
        overall_max_after_a20au = 19.15
        no_19_5_without_limited_pixel_rehearsal = $true
        visual_production_requires_screenshot = $true
        no_human_validation_without_human_data = $true
    }
    safety_rules = @(
        "No road push or merge.",
        "No A21 or Night Mode launch.",
        "No backend, package, DB, paid platform, PII, private URL, or secret changes.",
        "No user intervention, CAPTCHA, 2FA, consent, or human verification automation.",
        "Frontend changes must remain DEV-only."
    )
    final_verdicts = @(
        "OMEGA_KERNEL_READY_LIMITED_NIGHT_REHEARSAL_NEXT",
        "OMEGA_KERNEL_PARTIAL_PIXEL_LAB_WEAK",
        "OMEGA_KERNEL_PARTIAL_NIGHT_NOT_READY",
        "OMEGA_KERNEL_FAILED_NO_PIXEL_PROOF",
        "OMEGA_KERNEL_FAILED"
    )
}

$markdown = @"
# OMEGA Proof-Carrying Contract

Mission: $($contract.mission_id)
Objective: $($contract.objective_id)

## Objective
$($contract.objective)

## Expected Proof
$($contract.expected_proof | ForEach-Object { "- $_" } | Out-String)
## Allowed Paths
$($contract.allowed_paths | ForEach-Object { "- $_" } | Out-String)
## Forbidden Paths
$($contract.forbidden_paths | ForEach-Object { "- $_" } | Out-String)
## Validation
$($contract.test_commands | ForEach-Object { "- $_" } | Out-String)
## Stop Conditions
$($contract.stop_conditions | ForEach-Object { "- $_" } | Out-String)
## Safety
$($contract.safety_rules | ForEach-Object { "- $_" } | Out-String)
"@

$wordCount = Count-Words -Text $markdown
if ($wordCount -gt $MaxWords) {
    $markdown = @"
# OMEGA Proof-Carrying Contract

Mission: $($contract.mission_id)
Objective: $($contract.objective_id)
Proof: DEV-only route, visible pixel artifact, external screenshot, smoke report, conservative score delta.
Allowed: $(@($contract.allowed_paths) -join ", ")
Forbidden: $(@($contract.forbidden_paths) -join ", ")
Validation: git diff --check; frontend build; tsc; browser smoke; OMEGA tests; plan guard.
Stop: product flow change, repo screenshots, secrets, backend/package/DB touch, user/live-web dependency, or contract over budget.
"@
    $wordCount = Count-Words -Text $markdown
}
if ($wordCount -gt $MaxWords) { throw "CONTRACT_TOO_LARGE" }

$contract.contract_word_count = $wordCount
$contract.status = "PROOF_CARRYING_CONTRACT_READY"
$contract.giant_prompt_prevented = $true

Write-JsonFile -Path $OutPath -Payload $contract
Write-TextFile -Path $ContractOutPath -Text $markdown
$contract | ConvertTo-Json -Depth 50
exit 0
