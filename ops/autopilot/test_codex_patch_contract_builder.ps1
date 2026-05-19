$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20ao_contract_test_" + [guid]::NewGuid().ToString("N"))

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-JsonCommand {
    param([scriptblock]$Command)
    $output = & $Command 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "unexpected exit code $exit`: $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $start = $text.IndexOf("{")
    Assert-True ($start -ge 0) "command did not emit JSON"
    $text.Substring($start) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot | Out-Null
    $auctionPath = Join-Path $TempRoot "auction.json"
    [ordered]@{
        status = "MISSION_AUCTION_WINNER_SELECTED"
        winner = [ordered]@{
            id = "VISUAL_CONSTITUTION_CANDIDATE_V0"
            recommended_action = "Create the next bounded visual constitution contract."
            candidate_mission = [ordered]@{
                id = "VISUAL_CONSTITUTION_CANDIDATE_V0"
                objective = "Create a compact visual constitution candidate contract."
                allowed_paths = @("docs/design/**", "docs/autopilot/**", "ops/autopilot/**")
                forbidden_paths = @("backend/**", "frontend/**", "package.json", "ops/autopilot/local/**", "ops/autopilot/runtime/**")
                success_criteria = @("constitution_candidate_defined", "pixel_mandate_attached")
            }
        }
    } | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $auctionPath -Encoding UTF8

    $contract = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\codex_patch_contract_builder.ps1") `
            -MissionId A20AO_TEST `
            -AuctionPath $auctionPath `
            -OutPath (Join-Path $TempRoot "contract.json") `
            -ContractOutPath (Join-Path $TempRoot "contract.md")
    }
    Assert-True ($contract.status -eq "CODEX_PATCH_CONTRACT_READY") "contract not ready"
    Assert-True ($contract.word_count -le 900) "contract exceeds word limit"
    Assert-True ($contract.contract_text -match "Allowed paths") "contract missing allowed paths"
    Assert-True ($contract.contract_text -notmatch "chatgpt.com/g/") "private URL leaked"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\codex_patch_contract_builder.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host") "contract builder contains prompt"

    [ordered]@{
        status = "pass"
        tests = 5
        contract_ready = $true
        max_words_enforced = $true
        giant_prompt_prevented = $true
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
