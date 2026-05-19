$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20ao_loop_test_" + [guid]::NewGuid().ToString("N"))
$StatePath = Join-Path $RepoRoot "ops\autopilot\runtime\neurorelay_loop_test_state.json"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-Loop {
    param([string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\run_neurorelay_loop.ps1") `
        -MissionId A20AO_TEST `
        -ArtifactPath $TempRoot `
        -StatePath $StatePath `
        @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "unexpected exit code $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    Assert-True ($start -ge 0) "loop did not emit JSON"
    $text.Substring($start) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
    Remove-Item -LiteralPath $StatePath -Force -ErrorAction SilentlyContinue

    $dry = Invoke-Loop -Arguments @("-Mode", "DryRun", "-NoLiveWeb")
    Assert-True ($dry.status -eq "NEURORELAY_DRY_RUN_PASS") "dry run did not pass"
    Assert-True ($dry.completed_iterations -eq 1) "dry run should run one iteration"
    Assert-True ($dry.gpt_web_required -eq $false) "GPT Web required"
    Assert-True ($dry.gemini_required -eq $false) "Gemini required"
    Assert-True ($dry.user_intervention_required -eq $false) "user intervention required"
    Assert-True ($dry.workload_shift_metrics.codex_contract_word_count_avg -lt 900) "contract too large"

    $rehearsal = Invoke-Loop -Arguments @("-Mode", "Rehearsal", "-MaxIterations", "3", "-NoLiveWeb")
    Assert-True ($rehearsal.status -eq "NEURORELAY_REHEARSAL_PASS") "rehearsal did not pass"
    Assert-True ($rehearsal.completed_iterations -eq 3) "rehearsal count wrong"
    Assert-True ((@($rehearsal.next_planned_objectives | Select-Object -Unique).Count) -gt 1) "objectives did not progress"
    Assert-True ($rehearsal.workload_shift_metrics.local_fallback_packets_count -eq 3) "local fallback packet count wrong"
    Assert-True ($rehearsal.workload_shift_metrics.external_decision_packets_count -eq 0) "external packets should be zero in NoLiveWeb"
    Assert-True ($rehearsal.no_giant_prompt -eq $true) "giant prompt not prevented"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\run_neurorelay_loop.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host") "NeuroRelay loop contains prompt"
    Assert-True ($source -match "MaxIterations") "loop missing iteration bound"
    Assert-True ($source -match "MaxRuntimeMinutes") "loop missing runtime bound"

    [ordered]@{
        status = "pass"
        tests = 15
        dry_run_pass = $true
        rehearsal_pass = $true
        gpt_web_required = $false
        gemini_required = $false
        no_user_intervention = $true
        fallback_zero_external = $true
    } | ConvertTo-Json -Depth 10
} finally {
    Remove-Item -LiteralPath $StatePath -Force -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
