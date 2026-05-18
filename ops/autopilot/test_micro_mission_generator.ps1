$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20an_micro_generator_test_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-JsonCommand {
    param([scriptblock]$Command, [int[]]$AcceptExitCodes = @(0))
    $output = & $Command 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($AcceptExitCodes -contains $exit) "unexpected exit code $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    Assert-True ($start -ge 0) "command did not emit JSON"
    $text.Substring($start) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
    $outPath = Join-Path $TempRoot "micro.json"
    $promptPath = Join-Path $TempRoot "micro.md"
    $result = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\generate_micro_mission.ps1") `
            -MissionId A20AN_TEST `
            -OutPath $outPath `
            -PromptOutPath $promptPath `
            -NoLiveWeb
    }
    Assert-True ($result.status -eq "MICRO_MISSION_GENERATED") "micro mission not generated"
    Assert-True ($result.objective.id -eq "VISUAL_CONSTITUTION_CANDIDATE_V0") "highest-priority objective not selected"
    Assert-True ($result.pixel_mandate_required -eq $true) "visual mission missing pixel mandate"
    Assert-True ($result.no_user_intervention -eq $true) "user intervention not forbidden"
    Assert-True (($result.validation_commands -contains "git diff --check")) "validation commands missing diff check"
    Assert-True (($result.forbidden_paths -contains "ops/autopilot/local/**")) "local forbidden path missing"
    Assert-True ((Test-Path -LiteralPath $promptPath -PathType Leaf)) "prompt output not written"
    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\generate_micro_mission.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host") "generator contains interactive prompt"
    Assert-True ($source -notmatch "EvidencePath|OutputPath|ArtifactPath") "generator leaks low-level path prompts"

    $missing = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\generate_micro_mission.ps1") `
            -ReservoirPath (Join-Path $TempRoot "missing.yaml") `
            -OutPath (Join-Path $TempRoot "missing.json")
    } -AcceptExitCodes @(2)
    Assert-True ($missing.status -eq "MICRO_MISSION_GENERATION_FAILED") "missing reservoir did not fail clearly"

    [ordered]@{
        status = "pass"
        tests = 9
        generated_micro_mission = $true
        selected_visual_objective = $true
        no_user_intervention = $true
        no_prompt_leak = $true
        missing_reservoir_fails_cleanly = $true
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
