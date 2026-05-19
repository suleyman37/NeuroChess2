$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$PolicyPath = Join-Path $RepoRoot "ops\autopilot\full_night_branch_policy.yaml"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

$policy = Get-Content -LiteralPath $PolicyPath -Raw
$validBranch = "auto/a20ay-full-night-real-pixel-run-20260519-230000"
$invalidBranch = "road-to-V2"
$pattern = '^auto/a20ay-full-night-real-pixel-run-[0-9]{8}(-[0-9]{6})?$'

Assert-True ($validBranch -match $pattern) "valid branch rejected"
Assert-True (-not ($invalidBranch -match $pattern)) "invalid branch accepted"
Assert-True ($policy -match "dedicated_branch_required:\s*true") "dedicated branch rule missing"
Assert-True ($policy -match "git_add_a") "git add -A ban missing"
Assert-True ($policy -match "ops/autopilot/runtime/\*\*") "runtime forbidden missing"
Assert-True ($policy -match "\*\*/\*\.png") "screenshot pattern missing"
Assert-True ($policy -match "push_road_to_v2") "road push ban missing"

[ordered]@{ status = "pass"; tests = 7; branch_quarantine = "ready" } | ConvertTo-Json -Depth 6
