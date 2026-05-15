param([string]$RepoSlug = "suleyman37/NeuroChess2")

. "$PSScriptRoot\lib.ps1"

$result = [ordered]@{
  repo = $RepoSlug
  visibility = "unknown"
  private = $null
  source = "github_api"
  safe_for_self_hosted_runner = $false
  reason = "Visibility could not be proven private."
}

try {
  $repo = Invoke-RestMethod -Uri "https://api.github.com/repos/$RepoSlug" -Headers @{ "User-Agent" = "NeuroChessCodexAutopilot" } -TimeoutSec 20
  $result.visibility = [string]$repo.visibility
  $result.private = [bool]$repo.private
  if ($repo.private -eq $true -or $repo.visibility -eq "private") {
    $result.safe_for_self_hosted_runner = $true
    $result.reason = "Repository is private according to GitHub API."
  } else {
    $result.reason = "Repository is public; do not register a self-hosted runner here."
  }
} catch {
  $result.reason = "GitHub API visibility check failed: $($_.Exception.Message)"
}

$result | ConvertTo-Json -Depth 8
