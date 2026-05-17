param(
  [string]$FixturePath,
  [string]$PortList,
  [int[]]$Ports = @(3000, 5173, 8000, 8080)
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  return (Resolve-Path (Join-Path $PSScriptRoot "..\..")).Path
}

if ($PortList) {
  $parsedPorts = New-Object System.Collections.Generic.List[int]
  foreach ($port in ($PortList -split ",")) {
    if (-not [string]::IsNullOrWhiteSpace($port)) { $parsedPorts.Add([int]$port.Trim()) | Out-Null }
  }
  $Ports = $parsedPorts.ToArray()
}

$portsInUse = New-Object System.Collections.Generic.List[object]
$fixtureMode = [bool]$FixturePath

if ($FixturePath) {
  $fullPath = if ([System.IO.Path]::IsPathRooted($FixturePath)) { $FixturePath } else { Join-Path (Get-RepoRoot) $FixturePath }
  $fixture = Get-Content -LiteralPath $fullPath -Raw | ConvertFrom-Json
  foreach ($port in @($fixture.ports)) {
    if ([bool]$port.in_use) {
      $portsInUse.Add([ordered]@{
        port = [int]$port.port
        pid = $port.pid
        process_name = $port.process_name
      }) | Out-Null
    }
  }
} else {
  foreach ($portNumber in $Ports) {
    $connections = @(Get-NetTCPConnection -LocalPort $portNumber -State Listen -ErrorAction SilentlyContinue)
    foreach ($connection in $connections) {
      $processName = $null
      if ($connection.OwningProcess) {
        $process = Get-Process -Id ([int]$connection.OwningProcess) -ErrorAction SilentlyContinue
        if ($process) { $processName = $process.ProcessName }
      }
      $portsInUse.Add([ordered]@{
        port = [int]$portNumber
        pid = $connection.OwningProcess
        process_name = $processName
      }) | Out-Null
    }
  }
}

if ($portsInUse.Count -gt 0) {
  $resultName = "STOP_PORT_CONFLICT"
  $action = "DRAIN"
} else {
  $resultName = "PASS"
  $action = "CONTINUE"
}

$result = [ordered]@{
  port_registry_result = $resultName
  ports_in_use = $portsInUse.ToArray()
  recommended_action = $action
  fixture_mode = $fixtureMode
  live_chatgpt_called = $false
  live_gemini_called = $false
  product_mission_executed = $false
}

$result | ConvertTo-Json -Depth 10
if ($portsInUse.Count -gt 0) { exit 2 }
exit 0
