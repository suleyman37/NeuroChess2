param(
  [ValidateSet("prompt_auditor", "visual_court", "long_horizon_critic")]
  [string]$Mode = "prompt_auditor",
  [string]$InputPath = "",
  [string]$OutPath = "",
  [string]$Nonce = "",
  [string]$MissionId = ""
)

$ErrorActionPreference = "Stop"

function Has-Property {
  param($Object, [string]$Name)
  return ($null -ne $Object -and $Object.PSObject.Properties.Name -contains $Name)
}

function Get-ValueOrDefault {
  param($Object, [string]$Name, $Default)
  if (Has-Property $Object $Name) { return $Object.$Name }
  return $Default
}

function Scrub-Value {
  param($Value, [string]$PropertyName = "")
  if ($PropertyName -match "(?i)project_url|chatgpt_project_url|local_project_url|cookie|token|secret|password|raw_dom|dom_dump") {
    return $null
  }
  if ($null -eq $Value) { return $null }
  if ($Value -is [string]) {
    if ($Value -match "https://(chatgpt\.com|chat\.openai\.com)/") { return "[redacted]" }
    return $Value
  }
  if ($Value -is [System.Collections.IDictionary]) {
    $out = [ordered]@{}
    foreach ($key in $Value.Keys) {
      $scrubbed = Scrub-Value -Value $Value[$key] -PropertyName ([string]$key)
      if ($null -ne $scrubbed) { $out[$key] = $scrubbed }
    }
    return $out
  }
  if ($Value -is [pscustomobject]) {
    $out = [ordered]@{}
    foreach ($prop in $Value.PSObject.Properties) {
      $scrubbed = Scrub-Value -Value $prop.Value -PropertyName $prop.Name
      if ($null -ne $scrubbed) { $out[$prop.Name] = $scrubbed }
    }
    return $out
  }
  if ($Value -is [System.Collections.IEnumerable] -and -not ($Value -is [string])) {
    $items = @()
    foreach ($item in $Value) {
      $scrubbed = Scrub-Value -Value $item -PropertyName $PropertyName
      if ($null -ne $scrubbed) { $items += $scrubbed }
    }
    return @($items)
  }
  return $Value
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
$input = [pscustomobject]@{}
if ($InputPath) {
  if (-not (Test-Path -LiteralPath $InputPath)) { throw "InputPath not found: $InputPath" }
  $input = Get-Content -LiteralPath $InputPath -Raw | ConvertFrom-Json
}

if (-not $Nonce) { $Nonce = "A16G_" + ([guid]::NewGuid().ToString("N").Substring(0, 12)) }
if (-not $MissionId) { $MissionId = [string](Get-ValueOrDefault $input "mission_id" "UNKNOWN_MISSION") }

$head = (& git -C $repoRoot rev-parse --short HEAD).Trim()
$branch = (& git -C $repoRoot branch --show-current).Trim()

$dangerousZones = @(
  "Practice",
  "due_at",
  "Daily Plan",
  "training_items",
  "practice_attempts",
  "scoring",
  "XP/rank/Transfer",
  "ops/autopilot/local/chatgpt_project.local.json"
)

$packet = [ordered]@{
  schema_version = "A16G_gemini_audit_packet_v1"
  nonce = $Nonce
  mode = $Mode
  current_head = $head
  branch = $branch
  mission_id = $MissionId
  risk_tier = [string](Get-ValueOrDefault $input "risk_tier" "green")
  work_type = [string](Get-ValueOrDefault $input "work_type" "docs-only")
  supervisor_digest = Scrub-Value (Get-ValueOrDefault $input "supervisor_digest" "")
  proposed_micro_prompt = Scrub-Value (Get-ValueOrDefault $input "proposed_micro_prompt" "")
  nc_mp2_normalized = Scrub-Value (Get-ValueOrDefault $input "nc_mp2_normalized" @{})
  mission_contract = Scrub-Value (Get-ValueOrDefault $input "mission_contract" @{})
  shadow_plan = Scrub-Value (Get-ValueOrDefault $input "shadow_plan" @{})
  product_impact_review = Scrub-Value (Get-ValueOrDefault $input "product_impact_review" @{})
  active_policies = Scrub-Value (Get-ValueOrDefault $input "active_policies" @("deterministic gates beat Gemini", "Gemini cannot generate Codex prompts"))
  dangerous_zones = Scrub-Value (Get-ValueOrDefault $input "dangerous_zones" $dangerousZones)
  screenshot_paths = Scrub-Value (Get-ValueOrDefault $input "screenshot_paths" @())
  visual_review_brief = Scrub-Value (Get-ValueOrDefault $input "visual_review_brief" "")
  prompt_ledger_summary = Scrub-Value (Get-ValueOrDefault $input "prompt_ledger_summary" @{})
  failure_summary = Scrub-Value (Get-ValueOrDefault $input "failure_summary" @{})
  includes_local_project_url = $false
  includes_unsafe_page_dump = $false
  live_gemini_called = $false
  live_chatgpt_called = $false
  product_mission_executed = $false
  commit = $false
  push = $false
}

$json = $packet | ConvertTo-Json -Depth 30
if ($json -match "https://(chatgpt\.com|chat\.openai\.com)/") {
  throw "Gemini audit packet still contains a ChatGPT project URL."
}
if ($json -match "(?i)raw_dom|dom_dump") {
  throw "Gemini audit packet still contains raw DOM evidence."
}

if ($OutPath) {
  $dir = Split-Path -Parent $OutPath
  if ($dir) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
  $json | Set-Content -LiteralPath $OutPath -Encoding UTF8
}

[ordered]@{
  status = "pass"
  packet_path = $OutPath
  packet = $packet
  includes_local_project_url = $false
  includes_secrets = $false
  live_gemini_called = $false
  live_chatgpt_called = $false
  product_mission_executed = $false
  commit = $false
  push = $false
} | ConvertTo-Json -Depth 30
