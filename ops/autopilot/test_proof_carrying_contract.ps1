$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20au_contract_test_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-JsonScript {
    param([string]$ScriptPath, [string[]]$Arguments)
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File $ScriptPath @Arguments 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "unexpected exit code $exit from $ScriptPath`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
    $bottleneck = Invoke-JsonScript -ScriptPath (Join-Path $RepoRoot "ops\autopilot\bottleneck_detector.ps1") -Arguments @("-OutPath", (Join-Path $TempRoot "bottleneck.json"))
    $utility = Invoke-JsonScript -ScriptPath (Join-Path $RepoRoot "ops\autopilot\mission_utility_engine.ps1") -Arguments @("-BottleneckPath", (Join-Path $TempRoot "bottleneck.json"), "-OutPath", (Join-Path $TempRoot "utility.json"))
    Assert-True (-not [string]::IsNullOrWhiteSpace([string]$utility.winner.id)) "utility winner missing"

    $contract = Invoke-JsonScript -ScriptPath (Join-Path $RepoRoot "ops\autopilot\build_proof_carrying_contract.ps1") -Arguments @(
        "-MissionId", "A20AU_TEST",
        "-UtilityPath", (Join-Path $TempRoot "utility.json"),
        "-OutPath", (Join-Path $TempRoot "contract.json"),
        "-ContractOutPath", (Join-Path $TempRoot "contract.md")
    )
    Assert-True ($contract.status -eq "PROOF_CARRYING_CONTRACT_READY") "contract not ready"
    Assert-True ($contract.contract_word_count -lt 900) "contract too large"
    Assert-True (@($contract.expected_proof).Count -gt 0) "proof missing"
    Assert-True (($contract.forbidden_paths -contains "backend/**")) "backend forbidden missing"
    Assert-True (($contract.test_commands -join " ") -match "browser_omega_pixel_lab_smoke") "browser proof missing"
    Assert-True (Test-Path -LiteralPath (Join-Path $TempRoot "contract.md") -PathType Leaf) "contract md missing"
    Assert-True ($contract.giant_prompt_prevented -eq $true) "giant prompt not prevented"

    [ordered]@{
        status = "pass"
        tests = 8
        objective_id = $contract.objective_id
        word_count = $contract.contract_word_count
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
