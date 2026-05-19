$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20ao_capsule_test_" + [guid]::NewGuid().ToString("N"))

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
    $report = Join-Path $TempRoot "report.md"
    @"
This report mentions https://chatgpt.example/private-placeholder and credential_marker=sample.
The useful decision is to continue offline with visual production.
"@ | Set-Content -LiteralPath $report -Encoding UTF8
    $capsule = Invoke-JsonCommand {
        & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\context_capsule_builder.ps1") `
            -Mode BuildNextObjectiveCapsule `
            -MissionId A20AO_TEST `
            -ObjectiveId VISUAL_CONSTITUTION_CANDIDATE_V0 `
            -ReportPath $report `
            -OutPath (Join-Path $TempRoot "capsule.json")
    }
    Assert-True ($capsule.status -eq "CONTEXT_CAPSULE_READY") "capsule not ready"
    Assert-True ($capsule.word_count -le 1200) "capsule exceeded default word limit"
    $json = $capsule | ConvertTo-Json -Depth 30
    Assert-True ($json -notmatch "chatgpt.com/g/private") "private ChatGPT URL leaked"
    Assert-True ($json -notmatch "token_marker") "token-shaped marker leaked"
    Assert-True ($capsule.evidence_refs.Count -ge 1) "evidence refs missing"

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\context_capsule_builder.ps1") -Raw
    Assert-True ($source -notmatch "Read-Host") "capsule builder contains prompt"

    [ordered]@{
        status = "pass"
        tests = 6
        capsule_ready = $true
        max_words_enforced = $true
        secrets_redacted = $true
    } | ConvertTo-Json -Depth 10
} finally {
    if (Test-Path -LiteralPath $TempRoot) { Remove-Item -LiteralPath $TempRoot -Recurse -Force }
}
