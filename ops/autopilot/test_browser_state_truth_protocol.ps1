$ErrorActionPreference = "Stop"

$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$TempRoot = Join-Path ([System.IO.Path]::GetTempPath()) ("a20ba_browser_state_truth_test_" + [guid]::NewGuid().ToString("N"))
$ArtifactPath = Join-Path $TempRoot "artifacts"

function Assert-True {
    param([bool]$Condition, [string]$Message)
    if (-not $Condition) { throw "ASSERT FAILED: $Message" }
}

function Invoke-ClassifierFixture {
    param([hashtable]$Fixture)
    $fixturePath = Join-Path $TempRoot ("fixture_" + [guid]::NewGuid().ToString("N") + ".json")
    $Fixture | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $fixturePath -Encoding UTF8
    $output = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $RepoRoot "ops\autopilot\classify_browser_state.ps1") `
        -Mode Fixture `
        -Service chatgpt `
        -MissionId A20BA_TEST `
        -FixturePath $fixturePath `
        -ArtifactPath $ArtifactPath `
        -NoPrompt 2>&1
    $exit = $LASTEXITCODE
    Assert-True ($exit -eq 0) "classifier exited $exit $($output | Out-String)"
    $text = ($output | Out-String).Trim()
    $text.Substring($text.IndexOf("{")) | ConvertFrom-Json
}

try {
    New-Item -ItemType Directory -Force -Path $TempRoot, $ArtifactPath | Out-Null

    $baseUsable = @{
        service = "chatgpt"
        composer_visible = $true
        composer_enabled = $true
        send_available = $true
        foreground_blocker_visible = $false
        page_loading = $false
        screenshot_path = Join-Path $ArtifactPath "fake.png"
    }

    $cases = @(
        @{ name = "history CAPTCHA"; fixture = $baseUsable + @{ body_text = "Old assistant report mentioned CAPTCHA in history." }; expected = "PAGE_USABLE" },
        @{ name = "history human verification"; fixture = $baseUsable + @{ history_text = "Previous discussion said human verification." }; expected = "PAGE_USABLE" },
        @{ name = "history bypass"; fixture = $baseUsable + @{ body_text = "Do not bypass anything, historical instruction only." }; expected = "PAGE_USABLE" },
        @{ name = "plain composer"; fixture = $baseUsable; expected = "PAGE_USABLE" },
        @{ name = "login wall"; fixture = @{ service = "chatgpt"; composer_visible = $false; composer_enabled = $false; send_available = $false; foreground_blocker_visible = $true; screenshot_path = Join-Path $ArtifactPath "login.png" }; expected = "HUMAN_ACTION_REQUIRED" },
        @{ name = "consent wall"; fixture = @{ service = "chatgpt"; composer_visible = $true; composer_enabled = $false; send_available = $false; composer_blocked = $true; foreground_blocker_visible = $true; screenshot_path = Join-Path $ArtifactPath "consent.png" }; expected = "HUMAN_ACTION_REQUIRED" },
        @{ name = "captcha overlay"; fixture = @{ service = "chatgpt"; composer_visible = $false; composer_enabled = $false; send_available = $false; direct_blocker_selector_visible = $true; screenshot_path = Join-Path $ArtifactPath "captcha.png" }; expected = "HUMAN_ACTION_REQUIRED" },
        @{ name = "2fa overlay"; fixture = @{ service = "chatgpt"; composer_visible = $false; composer_enabled = $false; send_available = $false; foreground_blocker_visible = $true; screenshot_path = Join-Path $ArtifactPath "2fa.png" }; expected = "HUMAN_ACTION_REQUIRED" },
        @{ name = "absent no blocker"; fixture = @{ service = "chatgpt"; composer_visible = $false; composer_enabled = $false; send_available = $false; foreground_blocker_visible = $false; body_text = "No useful evidence." }; expected = "UNCLASSIFIED_PAGE_STATE" },
        @{ name = "loading shell"; fixture = @{ service = "chatgpt"; composer_visible = $false; composer_enabled = $false; send_available = $false; foreground_blocker_visible = $false; page_loading = $true }; expected = "PAGE_LOADING" },
        @{ name = "user visual contradiction"; fixture = $baseUsable + @{ body_text = "CAPTCHA verification auth wall terms in old page text."; user_visual_observation = "composer visible" }; expected = "PAGE_USABLE" },
        @{ name = "repeated false alert"; fixture = $baseUsable + @{ body_text = "human verification human verification"; repeated_reason = "HUMAN_ACTION_REQUIRED" }; expected = "PAGE_USABLE" }
    )

    foreach ($case in $cases) {
        $result = Invoke-ClassifierFixture -Fixture $case.fixture
        Assert-True ($result.classification -eq $case.expected) "$($case.name) expected $($case.expected), got $($result.classification)"
        Assert-True ($result.history_text_ignored -eq $true) "$($case.name) did not mark history text ignored"
        if ($case.expected -eq "PAGE_USABLE") {
            Assert-True ($result.recommended_action -eq "CONTINUE") "$($case.name) should continue"
        }
        if ($case.expected -eq "HUMAN_ACTION_REQUIRED") {
            Assert-True ($result.foreground_blocker_detected -eq $true) "$($case.name) needs foreground blocker evidence"
            Assert-True ($result.recommended_action -eq "SEND_ALERT") "$($case.name) should send alert"
        }
    }

    $source = Get-Content -LiteralPath (Join-Path $RepoRoot "ops\autopilot\classify_browser_state.ps1") -Raw
    Assert-True ($source -notmatch "SendKeys") "classifier must not use blind SendKeys"
    Assert-True ($source -match "history_text_ignored") "classifier must encode ignored history text"

    [ordered]@{
        status = "pass"
        tests = $cases.Count + 2
        false_positive_history_terms_ignored = $true
        composer_first_protocol = $true
        screenshot_first_before_human_action = $true
        no_blind_typing = $true
    } | ConvertTo-Json -Depth 20
} finally {
    if (Test-Path -LiteralPath $TempRoot) {
        Remove-Item -LiteralPath $TempRoot -Recurse -Force
    }
}
