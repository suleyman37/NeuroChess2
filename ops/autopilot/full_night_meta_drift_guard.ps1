param(
    [string]$IterationPath = "",
    [string]$ObjectiveId = "",
    [string[]]$ChangedFiles = @(),
    [switch]$VisualProductionBottleneck,
    [string]$OutPath = ""
)

$ErrorActionPreference = "Stop"

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Test-PixelObjective {
    param([string]$Value)
    return ($Value -match '(?i)PIXEL|CHAMBER|FEEDBACK|SIGIL|MEMORY|PRESSURE|SIGNATURE|MICRO_FLOW|VISUAL')
}

function Test-PixelFiles {
    param([string[]]$Files)
    return (@($Files | Where-Object { $_ -match '^frontend/src/dev/|^scripts/browser_.*smoke\.mjs$' }).Count -gt 0)
}

$iterations = @()
if (-not [string]::IsNullOrWhiteSpace($IterationPath) -and (Test-Path -LiteralPath $IterationPath -PathType Leaf)) {
    $json = Get-Content -LiteralPath $IterationPath -Raw | ConvertFrom-Json
    $iterations = @($json.iterations)
} elseif (-not [string]::IsNullOrWhiteSpace($ObjectiveId)) {
    $iterations = @([pscustomobject]@{ objective = $ObjectiveId; changed_files = $ChangedFiles })
}

$classified = @()
foreach ($iteration in $iterations) {
    $objective = ""
    if ($iteration.PSObject.Properties.Name -contains "objective") { $objective = [string]$iteration.objective }
    if ([string]::IsNullOrWhiteSpace($objective) -and $iteration.PSObject.Properties.Name -contains "selected_objective") { $objective = [string]$iteration.selected_objective }
    if ([string]::IsNullOrWhiteSpace($objective) -and $iteration.PSObject.Properties.Name -contains "id") { $objective = [string]$iteration.id }
    $files = @($iteration.changed_files)
    if ($files.Count -eq 0 -and $ChangedFiles.Count -gt 0) { $files = $ChangedFiles }
    $isPixel = (Test-PixelObjective -Value $objective) -or (Test-PixelFiles -Files $files)
    $docsOnly = ($files.Count -gt 0 -and @($files | Where-Object { $_ -notmatch '^docs/|\.md$|\.ya?ml$|\.json$' }).Count -eq 0)
    $classified += [pscustomobject]@{
        objective = $objective
        is_pixel_delta = [bool]$isPixel
        docs_only = [bool]$docsOnly
        changed_files = @($files)
    }
}

$consecutiveNonPixel = 0
$maxConsecutiveNonPixel = 0
foreach ($item in $classified) {
    if ($item.is_pixel_delta) {
        $consecutiveNonPixel = 0
    } else {
        $consecutiveNonPixel += 1
        $maxConsecutiveNonPixel = [Math]::Max($maxConsecutiveNonPixel, $consecutiveNonPixel)
    }
}

$rejectObjective = $false
if ($VisualProductionBottleneck -and -not [string]::IsNullOrWhiteSpace($ObjectiveId) -and -not (Test-PixelObjective -Value $ObjectiveId) -and -not (Test-PixelFiles -Files $ChangedFiles)) {
    $rejectObjective = $true
}

$status = if ($maxConsecutiveNonPixel -ge 2) {
    "META_DRIFT_STOP"
} elseif ($rejectObjective) {
    "OBJECTIVE_REJECTED_NON_PIXEL"
} else {
    "META_DRIFT_GUARD_PASS"
}

$result = [ordered]@{
    schema_version = "full_night_meta_drift_guard_v1"
    status = $status
    max_consecutive_non_pixel_iterations = $maxConsecutiveNonPixel
    visual_production_bottleneck = [bool]$VisualProductionBottleneck
    objective_rejected = $rejectObjective
    classified_iterations = $classified
    pure_docs_do_not_count_as_pixel = $true
    yaml_only_does_not_count_as_pixel = $true
    score_only_does_not_count_as_pixel = $true
    test_only_does_not_count_as_pixel = $true
    report_only_does_not_count_as_pixel = $true
}

Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 30
if ($status -eq "META_DRIFT_STOP") { exit 3 }
if ($status -eq "OBJECTIVE_REJECTED_NON_PIXEL") { exit 4 }
exit 0
