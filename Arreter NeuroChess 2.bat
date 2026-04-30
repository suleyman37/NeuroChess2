@echo off
setlocal

echo NeuroChess 2 - arret local
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ports = @(8000, 5173); " ^
  "$pids = @(); " ^
  "foreach ($port in $ports) { " ^
  "  $lines = netstat -ano | Select-String (':' + $port + '\s'); " ^
  "  foreach ($line in $lines) { " ^
  "    $parts = ($line.ToString() -split '\s+') | Where-Object { $_ }; " ^
  "    if ($parts.Count -gt 0) { $pids += [int]$parts[-1] } " ^
  "  } " ^
  "} " ^
  "$processes = Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and ($_.CommandLine -match 'uvicorn backend.app:app' -or $_.CommandLine -match 'vite.*127.0.0.1' -or $_.CommandLine -match 'NeuroChess2\\frontend') }; " ^
  "$pids += $processes.ProcessId; " ^
  "$pids = $pids | Sort-Object -Unique; " ^
  "foreach ($targetPid in $pids) { " ^
  "  try { Stop-Process -Id $targetPid -Force -ErrorAction Stop; Write-Host ('Processus arrete: ' + $targetPid) } catch { } " ^
  "} "

echo.
echo Arret termine.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 3" >nul
exit /b 0
