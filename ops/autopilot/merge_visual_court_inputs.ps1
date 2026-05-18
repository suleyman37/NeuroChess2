param(
    [string]$GeminiPath = "",
    [string]$ChatGptPath = "",
    [string]$CodexPath = "",
    [string]$HardGatePath = "",
    [string]$OutPath = ""
)

$ErrorActionPreference = "Stop"

function Read-JsonOrMissing {
    param([string]$Path, [string]$Name)
    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -LiteralPath $Path)) {
        return [pscustomobject][ordered]@{ status = "MISSING_INPUT"; source = $Name }
    }
    return Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
}

function As-StringArray {
    param($Value)
    if ($null -eq $Value) { return @() }
    if ($Value -is [array]) { return @($Value | ForEach-Object { [string]$_ }) }
    return @([string]$Value)
}

$gemini = Read-JsonOrMissing -Path $GeminiPath -Name "gemini"
$chatgpt = Read-JsonOrMissing -Path $ChatGptPath -Name "chatgpt"
$codex = Read-JsonOrMissing -Path $CodexPath -Name "codex"
$hardGate = Read-JsonOrMissing -Path $HardGatePath -Name "hard_gate"

$sources = @($gemini, $chatgpt, $codex, $hardGate)
$missing = @()
foreach ($source in @(
    @{ name = "gemini"; value = $gemini },
    @{ name = "chatgpt"; value = $chatgpt },
    @{ name = "codex"; value = $codex },
    @{ name = "hard_gate"; value = $hardGate }
)) {
    if ($source.value.status -eq "MISSING_INPUT") { $missing += $source.name }
}

$blockedReasons = @()
$topDefects = @()
$topStrengths = @()
$screenshotSet = @()
$hardGateStatus = "UNKNOWN"
$chessVerdict = "UNKNOWN"
$antiGenericVerdict = "UNKNOWN"
$publicLevel = "INTERNAL_PROTOTYPE_ONLY"
$craftScore = 0
$competenceScore = 14

foreach ($source in $sources) {
    $blockedReasons += As-StringArray $source.blocked_reasons
    $topDefects += As-StringArray $source.top_defects
    $topStrengths += As-StringArray $source.top_strengths
    $screenshotSet += As-StringArray $source.screenshot_set
    if ($source.hard_gate_status) { $hardGateStatus = [string]$source.hard_gate_status }
    if ($source.chess_arbiter_verdict) { $chessVerdict = [string]$source.chess_arbiter_verdict }
    if ($source.anti_generic_verdict) { $antiGenericVerdict = [string]$source.anti_generic_verdict }
    if ($source.public_screenshot_level) { $publicLevel = [string]$source.public_screenshot_level }
    if ($source.awwwards_app_craft_score) { $craftScore = [int]$source.awwwards_app_craft_score }
    if ($source.visual_competence_score) { $competenceScore = [int]$source.visual_competence_score }
}

$hardGateText = (($hardGateStatus, $chessVerdict, ($blockedReasons -join " ")) -join " ").ToUpperInvariant()
$hardGateOverride = (
    $hardGateText -match "BLOCK" -or
    $hardGateText -match "FAIL" -or
    $hardGateText -match "BOARD_POLLUTION" -or
    $hardGateText -match "PRE_FEEDBACK_HINT"
)

$geminiVerdict = if ($gemini.gemini_visual_verdict) { [string]$gemini.gemini_visual_verdict } elseif ($gemini.verdict) { [string]$gemini.verdict } else { [string]$gemini.status }
$genericPraiseInsufficient = $false
if ($geminiVerdict -match "PASS" -and (@(As-StringArray $gemini.concrete_strengths).Count -eq 0) -and (@(As-StringArray $gemini.top_strengths).Count -eq 0)) {
    $genericPraiseInsufficient = $true
}

$summary = [ordered]@{
    mission_id = if ($gemini.mission_id) { $gemini.mission_id } elseif ($hardGate.mission_id) { $hardGate.mission_id } else { "A20O_MERGED_VISUAL_COURT" }
    evidence_path = if ($gemini.evidence_path) { $gemini.evidence_path } elseif ($hardGate.evidence_path) { $hardGate.evidence_path } else { "" }
    screenshot_set = @($screenshotSet | Select-Object -Unique)
    hard_gate_status = $hardGateStatus
    chess_arbiter_verdict = $chessVerdict
    gemini_visual_verdict = $geminiVerdict
    chatgpt_art_direction_verdict = if ($chatgpt.chatgpt_art_direction_verdict) { [string]$chatgpt.chatgpt_art_direction_verdict } else { [string]$chatgpt.status }
    anti_generic_verdict = $antiGenericVerdict
    codex_feasibility_verdict = if ($codex.codex_feasibility_verdict) { [string]$codex.codex_feasibility_verdict } else { [string]$codex.status }
    creative_director_final_verdict = "PENDING"
    public_screenshot_level = $publicLevel
    awwwards_app_craft_score = $craftScore
    visual_competence_score = $competenceScore
    top_defects = @($topDefects | Select-Object -Unique)
    top_strengths = @($topStrengths | Select-Object -Unique)
    required_patch = "PENDING_CREATIVE_DIRECTOR_SELECTION"
    allowed_next_action = "select_visual_patch_plan"
    blocked_reasons = @($blockedReasons | Select-Object -Unique)
    next_mission_prompt_path = $null
    missing_inputs = $missing
    hard_gate_override = $hardGateOverride
    generic_praise_insufficient = $genericPraiseInsufficient
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
    runtime_user_approval_required = $false
}

if ([string]::IsNullOrWhiteSpace($OutPath)) {
    $OutPath = Join-Path ([System.IO.Path]::GetTempPath()) "merged_visual_court_summary.json"
}

$summary | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $OutPath -Encoding UTF8

[ordered]@{
    merged_visual_court_summary_path = $OutPath
    missing_inputs = $missing
    hard_gate_override = $hardGateOverride
    generic_praise_insufficient = $genericPraiseInsufficient
    live_chatgpt_called = $false
    live_gemini_called = $false
    product_mission_executed = $false
} | ConvertTo-Json -Depth 6
