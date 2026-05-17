param(
  [Parameter(Mandatory = $true)][string]$SkillPath,
  [string]$OutPath = ""
)

$ErrorActionPreference = "Stop"

function Add-Unique {
  param([System.Collections.Generic.List[string]]$List, [string]$Value)
  if (-not $List.Contains($Value)) { $List.Add($Value) | Out-Null }
}

function Test-TextMatch {
  param([string]$Text, [string]$Pattern)
  return [regex]::IsMatch($Text, $Pattern, [System.Text.RegularExpressions.RegexOptions]::IgnoreCase)
}

function Get-RiskRank {
  param([string]$Risk)
  switch ($Risk) {
    "critical" { return 3 }
    "high" { return 2 }
    "medium" { return 1 }
    default { return 0 }
  }
}

function Max-Risk {
  param([string]$Current, [string]$Candidate)
  if ((Get-RiskRank $Candidate) -gt (Get-RiskRank $Current)) { return $Candidate }
  return $Current
}

if (-not (Test-Path -LiteralPath $SkillPath)) { throw "SkillPath not found: $SkillPath" }
$resolvedSkillPath = (Resolve-Path -LiteralPath $SkillPath).Path
$skillMdPath = Join-Path $resolvedSkillPath "SKILL.md"
$hasSkillMd = Test-Path -LiteralPath $skillMdPath

$dangerous = [System.Collections.Generic.List[string]]::new()
$useful = [System.Collections.Generic.List[string]]::new()
$conflicts = [System.Collections.Generic.List[string]]::new()
$risk = "low"
$skillName = Split-Path -Leaf $resolvedSkillPath
$descriptionPresent = $false
$frontmatterPresent = $false

$textFiles = @()
if ($hasSkillMd) {
  $skillText = Get-Content -LiteralPath $skillMdPath -Raw
  $textFiles += [pscustomobject]@{ Path = $skillMdPath; Text = $skillText }
  $frontmatterPresent = ($skillText -match '(?s)^\s*---\s*.*?\s*---')
  $nameMatch = [regex]::Match($skillText, '(?im)^\s*name\s*:\s*["'']?([^"''\r\n]+)|^\s*#\s+(.+)$')
  if ($nameMatch.Success) {
    $skillName = if ($nameMatch.Groups[1].Value) { $nameMatch.Groups[1].Value.Trim() } else { $nameMatch.Groups[2].Value.Trim() }
  }
  $descriptionPresent = ($skillText -match '(?im)^\s*description\s*:' -or $skillText -match '(?im)\bPurpose\b|\bUse when\b|\bOverview\b')
} else {
  Add-Unique -List $dangerous -Value "missing SKILL.md"
  $risk = Max-Risk $risk "critical"
}

$candidateTextExtensions = @(".md", ".txt", ".json", ".yaml", ".yml", ".ps1", ".sh", ".py", ".js", ".mjs", ".cmd", ".bat")
$metadataNames = @("source.json")
$allFiles = @(Get-ChildItem -LiteralPath $resolvedSkillPath -File -Recurse -Force | Where-Object {
  $metadataNames -notcontains $_.Name -and
  $_.Name -notlike "*.audit.json" -and
  $_.Name -notlike "*.patterns.json"
})
foreach ($file in $allFiles) {
  if ($candidateTextExtensions -contains $file.Extension.ToLowerInvariant()) {
    try {
      $textFiles += [pscustomobject]@{ Path = $file.FullName; Text = (Get-Content -LiteralPath $file.FullName -Raw) }
    } catch {
      Add-Unique -List $dangerous -Value "unreadable text-like file: $($file.Name)"
      $risk = Max-Risk $risk "medium"
    }
  }
}

$scriptExtensions = @(".ps1", ".sh", ".py", ".js", ".mjs", ".cmd", ".bat", ".exe")
$scriptFiles = @($allFiles | Where-Object {
  ($scriptExtensions -contains $_.Extension.ToLowerInvariant()) -or
  ($_.DirectoryName -match '(?i)[\\/]scripts?$')
})
$hasScripts = $scriptFiles.Count -gt 0
if ($hasScripts) {
  Add-Unique -List $dangerous -Value "script or executable file present"
  $risk = Max-Risk $risk "high"
}

$patternRules = @(
  @{ Risk = "critical"; Bucket = "danger"; Label = "git add -A"; Pattern = '\bgit\s+add\s+-A\b' },
  @{ Risk = "critical"; Bucket = "danger"; Label = "destructive git reset"; Pattern = '\bgit\s+reset\b|\bgit\s+checkout\s+--\b' },
  @{ Risk = "critical"; Bucket = "danger"; Label = "git clean"; Pattern = '\bgit\s+clean\b' },
  @{ Risk = "critical"; Bucket = "danger"; Label = "force push"; Pattern = '\bgit\s+push\s+(--force|-f)\b' },
  @{ Risk = "critical"; Bucket = "danger"; Label = "destructive file deletion"; Pattern = '\brm\s+-rf\b|Remove-Item\s+.*-Recurse|\bdel\s+/s\s+/q\b|\brmdir\s+/s\s+/q\b' },
  @{ Risk = "critical"; Bucket = "danger"; Label = "prompt injection override"; Pattern = 'ignore previous instructions|disregard (the )?(system|developer|host)|override (host|system) rules|bypass (mission contract|control plane|shadow plan|prompt firewall)' },
  @{ Risk = "critical"; Bucket = "conflict"; Label = "NeuroChess safety gate weakening"; Pattern = 'relax red[- ]tier|disable (mission contract|shadow plan|control plane)|skip (mission contract|shadow plan|prompt firewall)' },
  @{ Risk = "critical"; Bucket = "conflict"; Label = "red-tier learning state conflict"; Pattern = '\bPractice\b|\bdue_at\b|\bDaily Plan\b|\btraining_items?\b|\bpractice_attempts?\b|\bscoring\b|\bXP\b|\brank\b|\bTransfer\b' },
  @{ Risk = "high"; Bucket = "danger"; Label = "network fetch"; Pattern = '\bcurl\b|\bwget\b|Invoke-WebRequest|\biwr\b|\bfetch\s*\(|https?://' },
  @{ Risk = "high"; Bucket = "danger"; Label = "remote script execution"; Pattern = 'curl.+\|\s*(bash|sh|powershell)|iwr.+\|\s*iex|Invoke-Expression|\biex\b' },
  @{ Risk = "high"; Bucket = "danger"; Label = "dependency install"; Pattern = '\bnpm\s+install\b|\bpip\s+install\b|\bpnpm\s+add\b|\byarn\s+add\b' },
  @{ Risk = "high"; Bucket = "danger"; Label = "secrets or environment access"; Pattern = '\$env:|process\.env|\.env\b|id_rsa|keychain|ssh-agent|token|secret' },
  @{ Risk = "high"; Bucket = "danger"; Label = "browser profile access"; Pattern = 'ChromeProfile|ChatGPTSupervisorChromeProfile|GeminiAuditorChromeProfile|user-data-dir' },
  @{ Risk = "medium"; Bucket = "danger"; Label = "architecture-wide refactor encouragement"; Pattern = 'codebase architecture|architectural friction|deepening opportunities|whole codebase|module-deepening refactors' },
  @{ Risk = "medium"; Bucket = "danger"; Label = "broad improvement language"; Pattern = 'improve everything|fix all|refactor everything|clean up everything|handle everything|as needed|if necessary' }
)

foreach ($entry in $textFiles) {
  foreach ($rule in $patternRules) {
    if (Test-TextMatch -Text $entry.Text -Pattern $rule.Pattern) {
      if ($rule.Bucket -eq "conflict") {
        Add-Unique -List $conflicts -Value $rule.Label
      } else {
        Add-Unique -List $dangerous -Value $rule.Label
      }
      $risk = Max-Risk $risk $rule.Risk
    }
  }
}

$combinedText = ($textFiles | ForEach-Object { $_.Text }) -join "`n"
foreach ($usefulRule in @(
  @{ Label = "checklist or review procedure"; Pattern = 'checklist|review|audit' },
  @{ Label = "test-first pattern"; Pattern = 'test[- ]first|TDD|behavior' },
  @{ Label = "design critique pattern"; Pattern = 'design|visual|UX|accessibility' },
  @{ Label = "skill authoring pattern"; Pattern = 'skill|frontmatter|description' },
  @{ Label = "scope discipline pattern"; Pattern = 'scope|allowed paths|forbidden paths' }
)) {
  if (Test-TextMatch -Text $combinedText -Pattern $usefulRule.Pattern) {
    Add-Unique -List $useful -Value $usefulRule.Label
  }
}
if ($useful.Count -eq 0 -and $hasSkillMd) { Add-Unique -List $useful -Value "manual review required" }
if (-not $descriptionPresent -and $hasSkillMd) {
  Add-Unique -List $dangerous -Value "missing description"
  $risk = Max-Risk $risk "medium"
}

$verdict = switch ($risk) {
  "critical" { "REJECT" }
  "high" { "QUARANTINE" }
  "medium" { "ADAPT_TO_INTERNAL" }
  default { "APPROVE_INTERNAL" }
}

$result = [ordered]@{
  skill_path = $resolvedSkillPath
  skill_name = $skillName
  has_skill_md = $hasSkillMd
  has_frontmatter = $frontmatterPresent
  has_description = $descriptionPresent
  has_scripts = $hasScripts
  script_files = @($scriptFiles | ForEach-Object { $_.FullName })
  risk_level = $risk
  dangerous_patterns = @($dangerous)
  useful_patterns = @($useful)
  conflicts_with_neurochess = @($conflicts)
  recommended_verdict = $verdict
  live_network_call = $false
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
  scripts_executed = $false
}

if ($OutPath) {
  $parent = Split-Path -Parent $OutPath
  if ($parent) { New-Item -ItemType Directory -Force -Path $parent | Out-Null }
  $result | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $OutPath -Encoding UTF8
}

$result | ConvertTo-Json -Depth 12
if (-not $hasSkillMd) { exit 1 }
exit 0
