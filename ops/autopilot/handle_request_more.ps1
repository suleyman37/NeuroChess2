param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$Nonce,
  [Parameter(Mandatory = $true)][string]$MissionId,
  [string]$EvidenceRoot = "",
  [string]$OutDir = "",
  [int]$RequestMoreCount = 1
)

$ErrorActionPreference = "Stop"

$allowedItems = @(
  "changed_files",
  "diff_stat",
  "diff_excerpt",
  "full_patch",
  "checks_summary",
  "failing_test_log",
  "screenshot_contact_sheet",
  "alarm_report",
  "route_inventory",
  "db_mutation_report",
  "codex_report",
  "prompt_firewall_report",
  "supervisor_digest"
)

$evidenceFileMap = @{
  changed_files = "changed_files.txt"
  diff_stat = "diff_stat.txt"
  diff_excerpt = "diff_excerpt.diff"
  full_patch = "patch.diff"
  checks_summary = "checks_summary.md"
  failing_test_log = "failing_test_log.txt"
  screenshot_contact_sheet = "screenshots/contact_sheet.png"
  alarm_report = "alarm_report.md"
  route_inventory = "route_inventory.md"
  db_mutation_report = "db_mutation_report.md"
  codex_report = "codex_report.md"
  prompt_firewall_report = "prompt_firewall_report.json"
  supervisor_digest = "supervisor_digest.md"
}

if (-not $OutDir) {
  $root = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\request_more"
  $OutDir = Join-Path $root (Get-Date -Format "yyyyMMdd_HHmmss")
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

function Write-RequestMoreSummary {
  param(
    [Parameter(Mandatory = $true)][string]$Status,
    [string[]]$Reasons = @(),
    [string[]]$RequestedItems = @(),
    [string[]]$UnavailableItems = @(),
    [string]$FollowupPath = "",
    [bool]$FullPatchIncluded = $false,
    [bool]$ScreenshotsIncluded = $false
  )

  $summary = [ordered]@{
    status = $Status
    mission_id = $MissionId
    nonce = $Nonce
    request_more_count = $RequestMoreCount
    reasons = @($Reasons)
    requested_items = @($RequestedItems)
    unavailable_items = @($UnavailableItems)
    followup_path = $FollowupPath
    live_chatgpt_called = $false
    browser_called = $false
    codex_execution = $false
    commit = $false
    push = $false
    full_patch_included = $FullPatchIncluded
    screenshots_included = $ScreenshotsIncluded
  }

  $summaryPath = Join-Path $OutDir "request_more_summary.json"
  $summary | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $summaryPath -Encoding UTF8
  $summary | ConvertTo-Json -Depth 8
}

if ($RequestMoreCount -gt 2) {
  Write-RequestMoreSummary -Status "STOP_REQUIRED" -Reasons @("request_more_count exceeds 2")
  exit 2
}

if (-not (Test-Path -LiteralPath $InputPath)) {
  Write-RequestMoreSummary -Status "fail" -Reasons @("input response not found")
  exit 1
}

$raw = Get-Content -LiteralPath $InputPath -Raw
$escapedNonce = [regex]::Escape($Nonce)
$reasons = [System.Collections.Generic.List[string]]::new()

if ($raw -notmatch "(?s)<NC_SUPERVISOR_RESPONSE\s+nonce=`"$escapedNonce`">.*</NC_SUPERVISOR_RESPONSE>") {
  $reasons.Add("missing supervisor response block or nonce mismatch") | Out-Null
}

$doneMatches = [regex]::Matches($raw, "<NC_DONE\s+nonce=`"$escapedNonce`">DONE</NC_DONE>")
if ($doneMatches.Count -ne 1) {
  $reasons.Add("missing or duplicated nonce-bound DONE") | Out-Null
}

if ($raw -notmatch '(?s)<VERDICT>\s*REQUEST_MORE\s*</VERDICT>') {
  $reasons.Add("verdict is not REQUEST_MORE") | Out-Null
}

$requestMatch = [regex]::Match($raw, '(?s)<REQUEST_MORE>\s*(.*?)\s*</REQUEST_MORE>')
if (-not $requestMatch.Success) {
  $reasons.Add("missing REQUEST_MORE block") | Out-Null
}

$requestedItems = [System.Collections.Generic.List[string]]::new()
$reasonText = ""

if ($requestMatch.Success) {
  $body = $requestMatch.Groups[1].Value
  $neededMatch = [regex]::Match($body, '(?ms)^needed_items:\s*(.*?)(?:^reason:|\z)')
  if (-not $neededMatch.Success) {
    $reasons.Add("missing needed_items block") | Out-Null
  } else {
    foreach ($match in [regex]::Matches($neededMatch.Groups[1].Value, '(?m)^\s*-\s*([A-Za-z0-9_]+)\s*$')) {
      $requestedItems.Add($match.Groups[1].Value) | Out-Null
    }
  }

  $reasonMatch = [regex]::Match($body, '(?ms)^reason:\s*(.+)$')
  if ($reasonMatch.Success) {
    $reasonText = $reasonMatch.Groups[1].Value.Trim()
  }
}

if ($requestedItems.Count -eq 0) {
  $reasons.Add("no requested evidence items") | Out-Null
}

if ([string]::IsNullOrWhiteSpace($reasonText)) {
  $reasons.Add("missing reason") | Out-Null
}

$unknown = @($requestedItems | Where-Object { $allowedItems -notcontains $_ })
if ($unknown.Count -gt 0) {
  $reasons.Add("unknown requested evidence item(s): $($unknown -join ', ')") | Out-Null
}

if ($reasons.Count -gt 0) {
  Write-RequestMoreSummary -Status "fail" -Reasons @($reasons) -RequestedItems @($requestedItems)
  exit 1
}

$unavailable = [System.Collections.Generic.List[string]]::new()
$followupLines = [System.Collections.Generic.List[string]]::new()
$followupLines.Add("<REQUEST_MORE_FOLLOWUP>") | Out-Null
$followupLines.Add("mission_id: $MissionId") | Out-Null
$followupLines.Add("nonce: $Nonce") | Out-Null
$followupLines.Add("request_more_count: $RequestMoreCount") | Out-Null
$followupLines.Add("requested_items:") | Out-Null
foreach ($item in $requestedItems) {
  $followupLines.Add("- $item") | Out-Null
}
$followupLines.Add("unavailable_items:") | Out-Null

$evidenceBlocks = [System.Collections.Generic.List[string]]::new()
foreach ($item in $requestedItems) {
  $relativePath = $evidenceFileMap[$item]
  $sourcePath = if ($EvidenceRoot) { Join-Path $EvidenceRoot $relativePath } else { "" }
  $evidenceBlocks.Add("## $item") | Out-Null

  if ($sourcePath -and (Test-Path -LiteralPath $sourcePath)) {
    if ($item -eq "screenshot_contact_sheet") {
      $evidenceBlocks.Add("path: $sourcePath") | Out-Null
    } else {
      $content = Get-Content -LiteralPath $sourcePath -Raw
      $evidenceBlocks.Add('```text') | Out-Null
      $evidenceBlocks.Add($content.TrimEnd()) | Out-Null
      $evidenceBlocks.Add('```') | Out-Null
    }
  } else {
    $unavailable.Add($item) | Out-Null
    $evidenceBlocks.Add("[unavailable: $item]") | Out-Null
  }
}

if ($unavailable.Count -eq 0) {
  $followupLines.Add("- none") | Out-Null
} else {
  foreach ($item in $unavailable) {
    $followupLines.Add("- $item") | Out-Null
  }
}

$followupLines.Add("") | Out-Null
$followupLines.Add("You requested more evidence.") | Out-Null
$followupLines.Add("Review only the targeted evidence below.") | Out-Null
$followupLines.Add("Now respond with exactly one MICRO_PROMPT, STOP_REASON, or another REQUEST_MORE only if absolutely necessary.") | Out-Null
$followupLines.Add("Do not ask for unknown evidence items.") | Out-Null
$followupLines.Add("Do not output free prose.") | Out-Null
$followupLines.Add("End with nonce-bound DONE.") | Out-Null
$followupLines.Add("") | Out-Null
$followupLines.Add("<TARGETED_EVIDENCE>") | Out-Null
foreach ($line in $evidenceBlocks) {
  $followupLines.Add($line) | Out-Null
}
$followupLines.Add("</TARGETED_EVIDENCE>") | Out-Null
$followupLines.Add("</REQUEST_MORE_FOLLOWUP>") | Out-Null

$followupPath = Join-Path $OutDir "request_more_followup.md"
Set-Content -LiteralPath $followupPath -Value ($followupLines -join "`n") -Encoding UTF8

$fullPatchIncluded = @($requestedItems | Where-Object { $_ -eq "full_patch" }).Count -gt 0
$screenshotsIncluded = @($requestedItems | Where-Object { $_ -eq "screenshot_contact_sheet" }).Count -gt 0
Write-RequestMoreSummary `
  -Status "pass" `
  -RequestedItems @($requestedItems) `
  -UnavailableItems @($unavailable) `
  -FollowupPath $followupPath `
  -FullPatchIncluded $fullPatchIncluded `
  -ScreenshotsIncluded $screenshotsIncluded

exit 0
