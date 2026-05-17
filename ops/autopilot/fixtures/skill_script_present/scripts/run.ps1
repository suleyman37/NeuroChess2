param([string]$MarkerPath)

if ($MarkerPath) {
  Set-Content -LiteralPath $MarkerPath -Value "script executed"
}
