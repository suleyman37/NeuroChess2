param(
    [string]$MissionId = "A20AN",
    [string]$ReservoirPath = "",
    [string]$ObjectiveId = "",
    [string]$ObjectiveFamily = "",
    [string]$OutPath = "",
    [string]$PromptOutPath = "",
    [switch]$NoLiveWeb
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ReservoirPath)) {
    $ReservoirPath = Join-Path $PSScriptRoot "objective_reservoir.yaml"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) {
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    $Payload | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Convert-Scalar {
    param([string]$Value)
    $trimmed = $Value.Trim()
    if ($trimmed -match '^\d+$') { return [int]$trimmed }
    if ($trimmed -eq "true") { return $true }
    if ($trimmed -eq "false") { return $false }
    return $trimmed.Trim('"')
}

function Read-Objectives {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "RESERVOIR_NOT_FOUND"
    }
    $objectives = @()
    $current = $null
    $activeList = ""
    foreach ($rawLine in Get-Content -LiteralPath $Path) {
        $line = $rawLine.Trim()
        if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) { continue }
        if ($line -match '^- id:\s*(.+)$') {
            if ($current) { $objectives += [pscustomobject]$current }
            $current = [ordered]@{ id = $Matches[1].Trim(); allowed_paths = @(); forbidden_paths = @(); expected_artifacts = @(); success_criteria = @() }
            $activeList = ""
            continue
        }
        if (-not $current) { continue }
        if ($line -match '^([A-Za-z0-9_]+):\s*(.*)$') {
            $key = $Matches[1]
            $value = $Matches[2]
            if ([string]::IsNullOrWhiteSpace($value)) {
                $current[$key] = @()
                $activeList = $key
            } else {
                $current[$key] = Convert-Scalar $value
                $activeList = ""
            }
            continue
        }
        if ($line -match '^- (.+)$' -and -not [string]::IsNullOrWhiteSpace($activeList)) {
            $items = @($current[$activeList])
            $items += $Matches[1].Trim()
            $current[$activeList] = @($items)
        }
    }
    if ($current) { $objectives += [pscustomobject]$current }
    return @($objectives)
}

function Sanitize-BranchPart {
    param([string]$Value)
    $Value.ToLowerInvariant() -replace '[^a-z0-9]+', '-' -replace '(^-|-$)', ''
}

try {
    $objectives = @(Read-Objectives -Path $ReservoirPath)
    if ($objectives.Count -eq 0) { throw "OBJECTIVE_RESERVOIR_EMPTY" }

    $selected = $null
    if (-not [string]::IsNullOrWhiteSpace($ObjectiveId)) {
        $selected = @($objectives | Where-Object { [string]$_.id -eq $ObjectiveId })[0]
    } elseif (-not [string]::IsNullOrWhiteSpace($ObjectiveFamily)) {
        $selected = @($objectives | Where-Object { [string]$_.family -eq $ObjectiveFamily } | Sort-Object -Property priority -Descending)[0]
    } else {
        $selected = @($objectives | Sort-Object -Property priority -Descending)[0]
    }
    if (-not $selected) { throw "OBJECTIVE_NOT_FOUND" }

    $isVisual = [string]$selected.family -in @("VISUAL_PRODUCTION_MODE", "SIGNATURE_COMPONENTS")
    $branchName = "auto/" + (Sanitize-BranchPart -Value ([string]$selected.id)) + "-micro-" + (Get-Date -Format "yyyyMMdd")
    $validation = @(
        "git diff --check",
        "powershell -ExecutionPolicy Bypass -File ops/autopilot/mission_doctor.ps1",
        "python tools/plan_guard.py"
    )
    if ($isVisual) {
        $validation += "visual screenshot evidence external path required"
    }

    $prompt = @"
MICRO MISSION: $($selected.id)

Objective family: $($selected.family)
Expected value: $($selected.expected_value)
Risk tier: $($selected.risk_tier)

Hard rules:
- no road-to-V2 push or merge
- no secrets, private URLs, local config, runtime state, screenshots, or QA artifacts committed
- no login, CAPTCHA, 2FA, consent, or human-verification bypass
- no user intervention during autonomous mode
- live GPT Web is optional; park it if blocked

Allowed paths:
$(@($selected.allowed_paths | ForEach-Object { "- $_" }) -join "`n")

Forbidden paths:
$(@($selected.forbidden_paths | ForEach-Object { "- $_" }) -join "`n")

Success criteria:
$(@($selected.success_criteria | ForEach-Object { "- $_" }) -join "`n")

Validation:
$($validation | ForEach-Object { "- $_" } | Out-String)
"@

    $result = [ordered]@{
        schema_version = "autonomous_micro_mission_v1"
        status = "MICRO_MISSION_GENERATED"
        mission_id = $MissionId
        objective = $selected
        branch_name = $branchName
        prompt_word_limit = 1200
        prompt = $prompt.Trim()
        allowed_paths = @($selected.allowed_paths)
        forbidden_paths = @($selected.forbidden_paths)
        expected_artifacts = @($selected.expected_artifacts)
        validation_commands = @($validation)
        success_criteria = @($selected.success_criteria)
        stop_conditions = @(
            "FORBIDDEN_PATH_TOUCHED",
            "SECRET_OR_PRIVATE_URL_DETECTED",
            "USER_INTERVENTION_REQUIRED",
            "LIVE_WEB_DEPENDENCY_REQUIRED",
            "ROAD_TO_V2_PUSH_OR_MERGE"
        )
        pixel_mandate_required = $isVisual
        non_visual_pixel_exception = if ($isVisual) { "" } else { "Allowed only because objective value is automation, safety, or evidence control-plane work." }
        live_gpt_web_optional = $true
        no_user_intervention = $true
        no_live_web = [bool]$NoLiveWeb
        operator_prompt_leak_detected = $false
    }
    Write-JsonFile -Path $OutPath -Payload $result
    if (-not [string]::IsNullOrWhiteSpace($PromptOutPath)) {
        $dir = Split-Path -Parent $PromptOutPath
        if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
        $prompt.Trim() | Set-Content -LiteralPath $PromptOutPath -Encoding UTF8
    }
    $result | ConvertTo-Json -Depth 30
    exit 0
} catch {
    $result = [ordered]@{
        schema_version = "autonomous_micro_mission_v1"
        status = "MICRO_MISSION_GENERATION_FAILED"
        error_redacted = $_.Exception.Message
        operator_prompt_leak_detected = $false
        no_user_intervention = $true
    }
    Write-JsonFile -Path $OutPath -Payload $result
    $result | ConvertTo-Json -Depth 10
    exit 2
}
