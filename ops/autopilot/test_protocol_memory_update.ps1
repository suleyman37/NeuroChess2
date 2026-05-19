$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20ao_memory_test_" + [guid]::NewGuid().ToString("N"))

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
    $memoryPath = Join-Path $TempRoot "protocol_memory.yaml"
    $first = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\protocol_memory_update.ps1") `
            -MemoryPath $memoryPath `
            -MissionId A20AO_TEST `
            -Lesson "If live web blocks twice, park the lane and continue offline." `
            -Evidence "test evidence" `
            -ActionRule "Prefer local fallback after repeated live lane blockers." `
            -OutPath (Join-Path $TempRoot "first.json")
    }
    Assert-True ($first.status -eq "MEMORY_ENTRY_ADDED") "memory not added"
    Assert-True ($first.lesson_word_count -le 80) "memory too long"

    $second = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\protocol_memory_update.ps1") `
            -MemoryPath $memoryPath `
            -MissionId A20AO_TEST `
            -Lesson "If live web blocks twice, park the lane and continue offline." `
            -Evidence "test evidence" `
            -ActionRule "Prefer local fallback after repeated live lane blockers." `
            -OutPath (Join-Path $TempRoot "second.json")
    }
    Assert-True ($second.status -eq "MEMORY_DUPLICATE_MERGED") "duplicate not merged"
    $raw = Get-Content -LiteralPath $memoryPath -Raw
    Assert-True ($raw -notmatch "chatgpt.com/g/") "private URL leaked"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\protocol_memory_update.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host") "memory updater contains prompt"

    [ordered]@{
        status = "pass"
        tests = 5
        entry_added = $true
        duplicate_merged = $true
        no_secrets = $true
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
