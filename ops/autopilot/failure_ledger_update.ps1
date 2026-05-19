param(
    [string]$LedgerPath = "",
    [string]$MissionId = "A20AU",
    [string]$Lane = "live_gpt_web",
    [string]$Reason = "UNAVAILABLE",
    [string]$NextSafeAlternative = "local_fallback_pixel_objective",
    [switch]$NtfyAlertSent,
    [switch]$UserInterventionRequired,
    [switch]$LoopContinued,
    [string]$OutPath = ""
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($LedgerPath)) { $LedgerPath = Join-Path $PSScriptRoot "failure_ledger.yaml" }

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 30 | Set-Content -LiteralPath $Path -Encoding UTF8
}

if (-not (Test-Path -LiteralPath $LedgerPath -PathType Leaf)) {
    @"
schema_version: failure_ledger_v2
updated_by: A20AU_OMEGA_AUTONOMY_KERNEL
entries: []
policy:
  repeat_threshold: 2
  repeated_failure_action: avoid_lane_unless_explicitly_unparked
  no_user_intervention_required: true
  loop_continues_when_lane_parked: true
"@ | Set-Content -LiteralPath $LedgerPath -Encoding UTF8
}

$raw = Get-Content -LiteralPath $LedgerPath -Raw
$pattern = "lane:\s*$([regex]::Escape($Lane))[\s\S]*?reason:\s*$([regex]::Escape($Reason))"
$existingCount = @([regex]::Matches($raw, $pattern)).Count
$recurrence = $existingCount + 1
$parkMinutes = if ($recurrence -ge 2) { 120 } else { 30 }
$parkedUntil = (Get-Date).AddMinutes($parkMinutes).ToString("o")
$entryId = "failure-$($MissionId.ToLowerInvariant())-$([guid]::NewGuid().ToString("N").Substring(0,8))"

$entry = @"
  - id: $entryId
    date: $(Get-Date -Format yyyy-MM-dd)
    mission_id: $MissionId
    lane: $Lane
    reason: $Reason
    recurrence_count: $recurrence
    parked_until: $parkedUntil
    do_not_repeat_rule: "$(if ($recurrence -ge 2) { "avoid_lane_unless_explicitly_unparked" } else { "retry_after_parked_until" })"
    next_safe_alternative: $NextSafeAlternative
    ntfy_alert_sent: $([bool]$NtfyAlertSent).ToString().ToLowerInvariant()
    user_intervention_required: $([bool]$UserInterventionRequired).ToString().ToLowerInvariant()
    loop_continued: $([bool]$LoopContinued).ToString().ToLowerInvariant()
"@

if ($raw -match "entries:\s*\[\]") {
    $raw = $raw -replace "entries:\s*\[\]", "entries:`n$entry"
    Set-Content -LiteralPath $LedgerPath -Value $raw -Encoding UTF8
} else {
    Add-Content -LiteralPath $LedgerPath -Value $entry -Encoding UTF8
}

$result = [ordered]@{
    schema_version = "failure_ledger_update_result_v2"
    status = "FAILURE_LEDGER_UPDATED"
    ledger_path = $LedgerPath
    lane = $Lane
    reason = $Reason
    recurrence_count = $recurrence
    parked_until = $parkedUntil
    do_not_repeat_rule = if ($recurrence -ge 2) { "avoid_lane_unless_explicitly_unparked" } else { "retry_after_parked_until" }
    next_safe_alternative = $NextSafeAlternative
    ntfy_alert_sent = [bool]$NtfyAlertSent
    user_intervention_required = [bool]$UserInterventionRequired
    loop_continued = [bool]$LoopContinued
    avoid_lane = [bool]($recurrence -ge 2)
}

Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 30
exit 0
