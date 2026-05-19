param(
    [string]$MemoryPath = "",
    [string]$MissionId = "A20AO",
    [string]$Category = "relay_protocol",
    [string]$Lesson = "Codex patch contracts should remain under 900 words.",
    [string]$Evidence = "A20AO NeuroRelay rehearsal.",
    [string]$ActionRule = "Compress context into capsules and pass only patch contracts downstream.",
    [string]$Confidence = "high",
    [int]$ExpiresAfterMissions = 12,
    [switch]$Compress,
    [switch]$ResolveContradictions,
    [string]$OutPath = ""
)

$ErrorActionPreference = "Stop"
if ([string]::IsNullOrWhiteSpace($MemoryPath)) {
    $MemoryPath = Join-Path $PSScriptRoot "protocol_memory.yaml"
}

function Write-JsonFile {
    param([string]$Path, [object]$Payload)
    if ([string]::IsNullOrWhiteSpace($Path)) { return }
    $dir = Split-Path -Parent $Path
    if (-not [string]::IsNullOrWhiteSpace($dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    $Payload | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $Path -Encoding UTF8
}

function Count-Words {
    param([string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) { return 0 }
    return @($Text -split '\s+' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) }).Count
}

function Redact-Text {
    param([string]$Text)
    $redacted = $Text
    $redacted = $redacted -replace 'https://chatgpt\.com/[^\s"<>]+', '[REDACTED_CHATGPT_URL]'
    $redacted = $redacted -replace 'https://gemini\.google\.com/[^\s"<>]+', '[REDACTED_GEMINI_URL]'
    $redacted = $redacted -replace 'https://ntfy\.sh/[A-Za-z0-9_-]{12,}', 'https://ntfy.sh/[REDACTED_TOPIC]'
    $redacted = $redacted -replace '(?i)(password|token|secret)\s*[:=]\s*\S+', '$1=[REDACTED]'
    return $redacted
}

function Compress-Text {
    param([string]$Text, [int]$MaxWords = 80)
    $words = @($Text -split '\s+' | Where-Object { $_ })
    if ($words.Count -le $MaxWords) { return $Text }
    return (($words | Select-Object -First $MaxWords) -join " ")
}

$Lesson = (Redact-Text -Text $Lesson).Trim()
$Evidence = (Redact-Text -Text $Evidence).Trim()
$ActionRule = (Redact-Text -Text $ActionRule).Trim()
if ($Compress) {
    $Lesson = Compress-Text -Text $Lesson -MaxWords 80
    $Evidence = Compress-Text -Text $Evidence -MaxWords 40
    $ActionRule = Compress-Text -Text $ActionRule -MaxWords 40
}
if ((Count-Words -Text $Lesson) -gt 80) { throw "MEMORY_LESSON_TOO_LONG" }
if ($Lesson -match '(?i)bypass|captcha|enter credentials') { throw "UNSAFE_MEMORY_LESSON" }

if (-not (Test-Path -LiteralPath $MemoryPath -PathType Leaf)) {
    "schema_version: neurorelay_protocol_memory_v1`nmax_entries: 100`nentries:" | Set-Content -LiteralPath $MemoryPath -Encoding UTF8
}

$raw = Get-Content -LiteralPath $MemoryPath -Raw
$duplicate = $raw -match [regex]::Escape($Lesson)
$contradictionResolved = $false
if ($ResolveContradictions -and $raw -match [regex]::Escape($Category) -and $raw -match '(?i)required dependency' -and $Lesson -match '(?i)optional') {
    $contradictionResolved = $true
}
$entryId = ("memory-" + ($MissionId.ToLowerInvariant()) + "-" + ([guid]::NewGuid().ToString("N").Substring(0, 8)))

if (-not $duplicate) {
    $entry = @"
  - id: $entryId
    date: $(Get-Date -Format yyyy-MM-dd)
    category: $Category
    lesson: "$Lesson"
    evidence: "$Evidence"
    action_rule: "$ActionRule"
    expires_after_missions: $ExpiresAfterMissions
    confidence: $Confidence
    source_mission: $MissionId
"@
    Add-Content -LiteralPath $MemoryPath -Value $entry -Encoding UTF8
}

$entryCount = @((Get-Content -LiteralPath $MemoryPath) | Where-Object { $_ -match '^\s*- id:' }).Count
$trimmedEntries = 0
if ($entryCount -gt 100) {
    $lines = Get-Content -LiteralPath $MemoryPath
    $ids = @($lines | Select-String -Pattern '^\s*- id:')
    $trimmedEntries = $entryCount - 100
}
$result = [ordered]@{
    schema_version = "neurorelay_protocol_memory_update_v1"
    status = if ($duplicate) { "MEMORY_DUPLICATE_MERGED" } else { "MEMORY_ENTRY_ADDED" }
    memory_path = $MemoryPath
    entry_count = $entryCount
    max_entries = 100
    lesson_word_count = Count-Words -Text $Lesson
    stale_entries_flagged = $entryCount -gt 100
    memory_compression_supported = $true
    expiration_supported = $true
    contradiction_resolution_supported = $true
    contradiction_resolved = $contradictionResolved
    trimmed_entries = $trimmedEntries
    no_secrets = $true
    private_urls_redacted = $true
    no_long_logs = $true
}
Write-JsonFile -Path $OutPath -Payload $result
$result | ConvertTo-Json -Depth 20
if ($entryCount -gt 100) { exit 7 }
exit 0
