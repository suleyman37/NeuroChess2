param(
  [string]$InputPath = "",
  [string]$AuditJson = ""
)

$ErrorActionPreference = "Stop"

if (-not $InputPath -and -not $AuditJson) { throw "Provide -InputPath or -AuditJson." }
$audit = if ($AuditJson) { $AuditJson | ConvertFrom-Json } else { Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json }

$risk = ([string]$audit.risk_level).Trim().ToLowerInvariant()
$dangerText = (@($audit.dangerous_patterns) + @($audit.conflicts_with_neurochess)) -join "`n"

if ($dangerText -match '(?i)secrets exfiltration|destructive|git add -A|git clean|force push|prompt injection|safety gate weakening|red-tier') {
  $risk = "critical"
} elseif ($dangerText -match '(?i)network fetch|dependency install|script or executable|browser profile|secrets') {
  if ($risk -ne "critical") { $risk = "high" }
} elseif ($dangerText -match '(?i)broad|missing description') {
  if ($risk -ne "critical" -and $risk -ne "high") { $risk = "medium" }
}

$verdict = switch ($risk) {
  "critical" { "REJECT" }
  "high" {
    if ($dangerText -match '(?i)network fetch|script or executable|dependency install') { "QUARANTINE" } else { "ADAPT_TO_INTERNAL" }
  }
  "medium" { "ADAPT_TO_INTERNAL" }
  default { "APPROVE_INTERNAL" }
}

[ordered]@{
  classified = $true
  skill_name = [string]$audit.skill_name
  risk_level = $risk
  recommended_verdict = $verdict
  reasons = @($audit.dangerous_patterns) + @($audit.conflicts_with_neurochess)
  live_network_call = $false
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
  scripts_executed = $false
} | ConvertTo-Json -Depth 10
exit 0
