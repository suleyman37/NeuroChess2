param(
  [string]$MicroPromptPath = "",
  [string]$MissionId = "",
  [string]$RiskTier = "",
  [string]$WorkType = "",
  [string]$Goal = "",
  [string[]]$ExpectedChangedFiles = @(),
  [string[]]$AllowedPaths = @(),
  [string[]]$ForbiddenPaths = @(),
  [int]$MaxFiles = 0,
  [int]$MaxDiffLines = 0,
  [int]$ExpectedDiffLinesMin = 0,
  [int]$ExpectedDiffLinesMax = 0,
  [string[]]$ExpectedReadPaths = @(),
  [string[]]$ExpectedWritePaths = @(),
  [string[]]$RequiredChecks = @(),
  [string[]]$ExpectedArtifacts = @(),
  [bool]$CommitAllowed = $true,
  [bool]$PushAllowed = $true,
  [string[]]$StopConditions = @(),
  [bool]$RedTierAllowed = $false,
  [bool]$BackendAllowed = $false,
  [bool]$FrontendAllowed = $false,
  [bool]$DocsRebuildAllowed = $false,
  [bool]$PackageChangesAllowed = $false,
  [bool]$ExactFileMatch = $true,
  [string]$OutDir = ""
)

$ErrorActionPreference = "Stop"
. "$PSScriptRoot\lib.ps1"

function Get-JsonPropertyValue {
  param($Object, [string]$Name, $Default)
  if ($Object -and ($Object.PSObject.Properties.Name -contains $Name)) {
    return $Object.$Name
  }
  return $Default
}

if ($MicroPromptPath) {
  $raw = Get-Content -LiteralPath $MicroPromptPath -Raw
  try {
    $prompt = $raw | ConvertFrom-Json
    if (-not $MissionId) { $MissionId = Get-JsonPropertyValue $prompt "mission_id" "" }
    if (-not $RiskTier) { $RiskTier = Get-JsonPropertyValue $prompt "risk_tier" "" }
    if (-not $WorkType) { $WorkType = Get-JsonPropertyValue $prompt "work_type" "" }
    if (-not $Goal) { $Goal = Get-JsonPropertyValue $prompt "goal" "" }
    if ($ExpectedChangedFiles.Count -eq 0) { $ExpectedChangedFiles = @(Get-JsonPropertyValue $prompt "expected_changed_files" @()) }
    if ($AllowedPaths.Count -eq 0) { $AllowedPaths = @(Get-JsonPropertyValue $prompt "allowed_paths" @()) }
    if ($ForbiddenPaths.Count -eq 0) { $ForbiddenPaths = @(Get-JsonPropertyValue $prompt "forbidden_paths" @()) }
    if ($MaxFiles -eq 0) { $MaxFiles = [int](Get-JsonPropertyValue $prompt "max_files" 0) }
    if ($MaxDiffLines -eq 0) { $MaxDiffLines = [int](Get-JsonPropertyValue $prompt "max_diff_lines" 0) }
    if ($RequiredChecks.Count -eq 0) { $RequiredChecks = @(Get-JsonPropertyValue $prompt "required_checks" @()) }
    if ($StopConditions.Count -eq 0) { $StopConditions = @(Get-JsonPropertyValue $prompt "stop_conditions" @()) }
  } catch {
    throw "MicroPromptPath must contain JSON when used by A11A build_mission_contract.ps1: $($_.Exception.Message)"
  }
}

if (-not $MissionId) { $MissionId = "UNREGISTERED_MISSION" }
if (-not $OutDir) {
  $safeMission = $MissionId -replace "[^A-Za-z0-9_.-]", "_"
  $OutDir = Join-Path (Get-AutopilotArtifactRoot) "mission_contracts\$safeMission`_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$contract = [ordered]@{
  schema_version = "A11A_mission_contract_v1"
  mission_id = $MissionId
  risk_tier = $RiskTier
  work_type = $WorkType
  goal = $Goal
  expected_changed_files = @($ExpectedChangedFiles)
  allowed_paths = @($AllowedPaths)
  forbidden_paths = @($ForbiddenPaths)
  max_files = $MaxFiles
  max_diff_lines = $MaxDiffLines
  expected_diff_lines_min = $ExpectedDiffLinesMin
  expected_diff_lines_max = $ExpectedDiffLinesMax
  expected_read_paths = @($ExpectedReadPaths)
  expected_write_paths = @($ExpectedWritePaths)
  required_checks = @($RequiredChecks)
  expected_artifacts = @($ExpectedArtifacts)
  commit_policy = [ordered]@{
    commit_allowed = $CommitAllowed
    push_allowed = $PushAllowed
  }
  stop_conditions = @($StopConditions)
  red_tier_allowed = $RedTierAllowed
  backend_allowed = $BackendAllowed
  frontend_allowed = $FrontendAllowed
  docs_rebuild_allowed = $DocsRebuildAllowed
  package_changes_allowed = $PackageChangesAllowed
  exact_file_match = $ExactFileMatch
  live_chatgpt_called = $false
  codex_execution_started = $false
  product_mission_executed = $false
}

$jsonPath = Join-Path $OutDir "mission_contract.json"
$mdPath = Join-Path $OutDir "mission_contract.md"
$contract | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $jsonPath -Encoding UTF8

$md = @(
  "# Mission Contract",
  "",
  "Mission: $MissionId",
  "Risk tier: $RiskTier",
  "Work type: $WorkType",
  "",
  "Goal: $Goal",
  "",
  "Expected changed files:",
  (@($ExpectedChangedFiles) | ForEach-Object { "- $_" }),
  "",
  "Required checks:",
  (@($RequiredChecks) | ForEach-Object { "- $_" }),
  "",
  "No ChatGPT call, Codex execution, commit, or push is performed by this builder."
)
$md | Set-Content -LiteralPath $mdPath -Encoding UTF8

[ordered]@{
  status = "built"
  mission_id = $MissionId
  contract_json = $jsonPath
  contract_markdown = $mdPath
  live_chatgpt_called = $false
  codex_execution = $false
  commit = $false
  push = $false
} | ConvertTo-Json -Depth 10
