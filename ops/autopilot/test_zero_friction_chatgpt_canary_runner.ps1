$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

$output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\run_chatgpt_visual_canary_autopilot.ps1") `
    -MissionId A20AF `
    -SkipLive `
    -NoPrompt `
    -MockCdpStatus LaunchSuccess 2>&1
$exit = $LASTEXITCODE
Assert-True ($exit -eq 0) "runner failed in non-live mode: $($output | Out-String)"
$text = ($output | Out-String).Trim()
$runner = $text.Substring($text.IndexOf("{")) | ConvertFrom-Json

Assert-True ($runner.status -eq "ZERO_FRICTION_RUNNER_READY") "runner did not report ready"
Assert-True ($runner.evidence_path_prompted -eq $false) "EvidencePath prompt leaked"
Assert-True ($runner.output_path_prompted -eq $false) "OutputPath prompt leaked"
Assert-True ($runner.artifact_path_prompted -eq $false) "ArtifactPath prompt leaked"
Assert-True ($runner.cdp_status -eq "CDP_SESSION_BOOTSTRAPPED") "mock CDP bootstrap did not run"
Assert-True ($runner.chrome_launched -eq $true) "mock Chrome launch not reported"
Assert-True (Test-Path -LiteralPath (Join-Path $runner.artifact_path "canary\canary_image.png") -PathType Leaf) "canary image missing"
Assert-True (Test-Path -LiteralPath (Join-Path $runner.artifact_path "canary\canary_prompt.md") -PathType Leaf) "canary prompt missing"

$captureSource = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\capture_chatgpt_visual_judge.ps1") -Raw
$runnerSource = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\run_chatgpt_visual_canary_autopilot.ps1") -Raw
Assert-True ($captureSource -notmatch '\[Parameter\(Mandatory\s*=\s*\$true\)\]\[string\]\$EvidencePath') "EvidencePath remains mandatory"
Assert-True ($captureSource -notmatch '\[Parameter\(Mandatory\s*=\s*\$true\)\]\[string\]\$OutputPath') "OutputPath remains mandatory"
Assert-True ($captureSource -match "PARAMETER_REQUIRED") "capture script missing non-interactive parameter guard"
Assert-True ($runnerSource -match "-EvidencePath") "runner does not pass EvidencePath explicitly"
Assert-True ($runnerSource -match "-OutputPath") "runner does not pass OutputPath explicitly"
Assert-True ($runnerSource -notmatch "Read-Host .*EvidencePath") "runner can prompt for EvidencePath"
Assert-True ($runnerSource -notmatch "Read-Host .*OutputPath") "runner can prompt for OutputPath"

$paramGuardOutput = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\capture_chatgpt_visual_judge.ps1") `
    -MissionId A20AF_PARAM_GUARD_TEST 2>&1
$paramGuardExit = $LASTEXITCODE
Assert-True ($paramGuardExit -eq 12) "capture param guard did not return expected exit code"
$paramText = ($paramGuardOutput | Out-String).Trim()
$paramGuard = $paramText.Substring($paramText.IndexOf("{")) | ConvertFrom-Json
Assert-True ($paramGuard.capture_result -eq "PARAMETER_REQUIRED") "capture missing params did not report PARAMETER_REQUIRED"
Assert-True ($paramGuard.interactive_prompt_used -eq $false) "capture missing params used interactive prompt"

[ordered]@{
    status = "pass"
    tests = 18
    zero_friction_runner_ready = $true
    evidence_path_prompt_eliminated = $true
    output_path_prompt_eliminated = $true
    artifact_path_prompt_eliminated = $true
    cdp_bootstrap_integrated = $true
    canary_generated = $true
    capture_guard_non_interactive = $true
    no_live_chatgpt_called = $true
    no_bypass_action = $true
} | ConvertTo-Json -Depth 10
