param(
  [Parameter(Mandatory = $true)][string]$MissionId,
  [string]$Scope = "sensitive",
  [string]$BaseBranch = "road-to-V2",
  [string]$Timestamp = "",
  [string]$OutDir = "",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

if (-not $Timestamp) {
  $Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
}

& "$PSScriptRoot\prepare_ephemeral_branch.ps1" `
  -MissionId $MissionId `
  -RiskTier "red" `
  -WorkType $Scope `
  -BaseBranch $BaseBranch `
  -Timestamp $Timestamp `
  -OutDir $OutDir `
  -DryRun:$DryRun
