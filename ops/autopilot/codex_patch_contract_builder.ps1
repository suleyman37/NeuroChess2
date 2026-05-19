param(
    [string]$MissionId = "A20AO",
    [string]$AuctionPath = "",
    [string]$DecisionPacketPath = "",
    [int]$MaxWords = 900,
    [string]$OutPath = "",
    [string]$ContractOutPath = ""
)

$ErrorActionPreference = "Stop"

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Count-Words {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return 0 }
    return @($Text -split '\s+' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }).Count
}

$candidate = $null
$recommended = ""
if (-not [string]::IsNullOrWhiteSpace($AuctionPath) -and (Test-Path -LiteralPath $AuctionPath -PathType Leaf)) {
    $auction = Get-Content -LiteralPath $AuctionPath -Raw | ConvertFrom-Json
    $candidate = $auction.winner.candidate_mission
    $recommended = [string]$auction.winner.recommended_action
} elseif (-not [string]::IsNullOrWhiteSpace($DecisionPacketPath) -and (Test-Path -LiteralPath $DecisionPacketPath -PathType Leaf)) {
    $packet = Get-Content -LiteralPath $DecisionPacketPath -Raw | ConvertFrom-Json
    $candidate = $packet.candidate_mission
    $recommended = [string]$packet.recommended_action
}
if (-not $candidate) { throw "NO_CANDIDATE_FOR_CONTRACT" }

$allowed = @($candidate.allowed_paths | ForEach-Object { [string]$_ })
$forbidden = @($candidate.forbidden_paths | ForEach-Object { [string]$_ })
$criteria = @($candidate.success_criteria | ForEach-Object { [string]$_ })

$contract = @"
# Codex Patch Contract: $MissionId

Objective: $($candidate.objective)

Recommended action: $recommended

Allowed paths:
$($allowed | ForEach-Object { "- $_" } | Out-String)
Forbidden paths:
$($forbidden | ForEach-Object { "- $_" } | Out-String)
Deliverables:
- Implement only the selected micro-mission.
- Keep the diff bounded to the allowed paths.
- Emit report and machine-readable artifacts outside committed runtime/local paths.

Validation:
- git diff --check
- relevant mission tests
- python tools/plan_guard.py

Safety:
- no road-to-V2 push or merge
- no A21 or Night Mode launch
- no secrets, private URLs, ntfy topic, SMTP password, cookies, or tokens
- no login, CAPTCHA, 2FA, consent, or human-verification bypass
- no user intervention or READY gate in unattended mode

Stop conditions:
- forbidden path touched
- operator prompt leak
- external service becomes required
- contract exceeds file or diff budget
- safety scan fails

Success criteria:
$($criteria | ForEach-Object { "- $_" } | Out-String)
Final report:
- verdict
- files changed
- tests run
- safety status
- next recommended objective
"@

$contract = $contract.Trim()
$wordCount = Count-Words -Text $contract
if ($wordCount -gt $MaxWords) {
    $contract = @"
# Codex Patch Contract: $MissionId

Objective: $($candidate.objective)

Allowed: $($allowed -join ", ")
Forbidden: $($forbidden -join ", ")
Deliverables: selected micro-mission only; concise report; no runtime/local commits.
Validation: git diff --check; relevant tests; python tools/plan_guard.py.
Safety: no road push/merge, no A21, no Night Mode, no secrets/private URLs, no bypass, no user intervention.
Stop: forbidden path, prompt leak, external dependency, oversized diff, failed safety scan.
Success: $($criteria -join "; ")
"@.Trim()
    $wordCount = Count-Words -Text $contract
}

$result = [ordered]@{
    schema_version = "neurorelay_codex_patch_contract_v1"
    status = if ($wordCount -le $MaxWords) { "CODEX_PATCH_CONTRACT_READY" } else { "CODEX_PATCH_CONTRACT_TOO_LARGE" }
    mission_id = $MissionId
    candidate_id = [string]$candidate.id
    word_count = $wordCount
    max_words = $MaxWords
    contract_text = $contract
    giant_prompt_prevented = $true
    no_private_urls = $true
    no_secrets = $true
}

if (-not [string]::IsNullOrWhiteSpace($ContractOutPath)) {
    $dir = Split-Path -Parent $ContractOutPath
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $contract | Set-Content -LiteralPath $ContractOutPath -Encoding UTF8
}
Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 30
if ($result.status -ne "CODEX_PATCH_CONTRACT_READY") { exit 6 }
exit 0
