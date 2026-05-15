param(
  [switch]$PullModels
)

. "$PSScriptRoot\lib.ps1"

$runDir = New-AutopilotRunDir -Name "install_local_stack"
$ollama = Get-OllamaExe
$codexVersion = $null
try {
  $codexVersion = (cmd /c codex --version) -join "`n"
} catch {
  $codexVersion = "unavailable: $($_.Exception.Message)"
}

$result = [ordered]@{
  codex_cli = $codexVersion
  ollama_exe = $ollama
  ollama_install_status = if ($ollama) { "available" } else { "missing" }
  pulled_models = @()
  skipped_models = @()
}

if ($PullModels -and $ollama) {
  foreach ($model in @("gpt-oss:20b", "qwen2.5vl:7b")) {
    try {
      & $ollama pull $model 2>&1 | Tee-Object -FilePath (Join-Path $runDir "$($model -replace ':','_')_pull.log")
      $result.pulled_models += $model
    } catch {
      $result.skipped_models += "${model}: $($_.Exception.Message)"
    }
  }
} else {
  $result.skipped_models += "Model pull not requested by bootstrap run."
}

Write-AutopilotJson -Path (Join-Path $runDir "local_stack.json") -Value $result
$result | ConvertTo-Json -Depth 12
