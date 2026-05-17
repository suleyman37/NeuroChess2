param(
  [string[]]$ReferencePaths = @(),
  [string]$CorpusType = "all",
  [string]$OutPath
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

function Resolve-PathFromRepo {
  param([string]$Path)
  if ([System.IO.Path]::IsPathRooted($Path)) { return $Path }
  return (Join-Path (Get-RepoRoot) $Path)
}

function Get-DefaultReferencePaths {
  $fixtures = Join-Path $PSScriptRoot "fixtures"
  return @(
    (Join-Path $fixtures "design_reference_igloo.json"),
    (Join-Path $fixtures "design_reference_messenger.json"),
    (Join-Path $fixtures "design_reference_orano.json"),
    (Join-Path $fixtures "design_reference_shader.json"),
    (Join-Path $fixtures "design_reference_som.json"),
    (Join-Path $fixtures "design_reference_linear.json"),
    (Join-Path $fixtures "design_reference_figma.json"),
    (Join-Path $fixtures "design_reference_balatro.json")
  )
}

if ($ReferencePaths.Count -eq 0) { $ReferencePaths = Get-DefaultReferencePaths }

$references = @()
foreach ($path in $ReferencePaths) {
  $reference = Get-Content -LiteralPath (Resolve-PathFromRepo -Path $path) -Raw | ConvertFrom-Json
  if ([bool]$reference.copyrighted_assets_stored) {
    throw "Reference stores copyrighted assets, which is forbidden: $path"
  }
  if ($CorpusType -ne "all" -and [string]$reference.corpus_type -ne $CorpusType) { continue }
  $references += $reference
}

$corpus = [ordered]@{
  schema_version = "A20E_design_reference_corpus_v1"
  generated_at = (Get-Date).ToUniversalTime().ToString("o")
  corpus_type = $CorpusType
  reference_count = $references.Count
  references = @($references)
  stores_images = $false
  stores_metadata_only = $true
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$json = $corpus | ConvertTo-Json -Depth 20
if ($OutPath) {
  $outFullPath = Resolve-PathFromRepo -Path $OutPath
  $outDir = Split-Path -Parent $outFullPath
  if ($outDir) { New-Item -ItemType Directory -Force -Path $outDir | Out-Null }
  Set-Content -LiteralPath $outFullPath -Value $json -Encoding UTF8
}

$json
exit 0
