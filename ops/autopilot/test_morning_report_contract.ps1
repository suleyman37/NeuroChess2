$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$SchemaPath = Join-Path $RepoRoot "ops\autopilot\morning_report_schema.json"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

$schema = Get-Content -LiteralPath $SchemaPath -Raw | ConvertFrom-Json
$required = @(
    "runtime",
    "iterations",
    "pixel_deltas",
    "useful_pixel_deltas",
    "weak_deltas",
    "screenshots_path",
    "mission_doctor_summary",
    "failure_ledger_summary",
    "protocol_memory_update",
    "score_before_after",
    "night_readiness_v2_result",
    "safety_scan",
    "final_git_status",
    "recommended_next_step",
    "go_no_go"
)

foreach ($field in $required) {
    Assert-True (@($schema.required) -contains $field) "schema missing required field $field"
}

$goNoGoEnum = @($schema.properties.go_no_go.enum)
foreach ($label in @("GO_FOR_REVIEW", "GO_FOR_SECOND_REHEARSAL", "NO_GO_SAFETY", "NO_GO_WEAK_OUTPUT", "NO_GO_TEST_FAILURE")) {
    Assert-True ($goNoGoEnum -contains $label) "missing go/no-go enum $label"
}

$sample = [ordered]@{
    runtime = [ordered]@{ started_at = "2026-05-19T00:00:00Z"; ended_at = "2026-05-19T01:00:00Z"; runtime_minutes = 60 }
    iterations = @()
    pixel_deltas = 6
    useful_pixel_deltas = 5
    weak_deltas = @()
    screenshots_path = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\full_night_real\sample"
    mission_doctor_summary = "pass"
    failure_ledger_summary = "none"
    protocol_memory_update = "compressed"
    score_before_after = [ordered]@{ before = 19.5; after = 19.5 }
    night_readiness_v2_result = "NIGHT_READY"
    safety_scan = [ordered]@{ violations = @() }
    final_git_status = "clean"
    recommended_next_step = "review"
    go_no_go = "GO_FOR_REVIEW"
}

$missingFromSample = @($required | Where-Object { $sample.Keys -notcontains $_ })
Assert-True ($missingFromSample.Count -eq 0) "sample report missing required fields"
Assert-True (($sample | ConvertTo-Json -Depth 20) -notmatch "private|token|secret|ntfy topic") "sample includes sensitive wording"

[ordered]@{
    status = "pass"
    tests = 22
    morning_report_contract = "ready"
    required_fields = $required.Count
} | ConvertTo-Json -Depth 8
