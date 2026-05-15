param(
  [int]$IntervalSeconds = 300,
  [int]$MaxCycles = 0
)

$cycles = 0
while ($true) {
  & "$PSScriptRoot\run_once.ps1"
  $cycles += 1
  if ($MaxCycles -gt 0 -and $cycles -ge $MaxCycles) {
    break
  }
  Start-Sleep -Seconds $IntervalSeconds
}
