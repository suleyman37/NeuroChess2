param(
  [string]$OutDir = "",
  [string]$VisualCode = ""
)

$ErrorActionPreference = "Stop"

if (-not $OutDir) {
  $root = "C:\Users\suley\Documents\Dev\NeuroChess_QA_Artifacts\autopilot\gemini_visual_smokes"
  $OutDir = Join-Path $root ("images_" + (Get-Date -Format "yyyyMMdd_HHmmss"))
}
if (-not $VisualCode) {
  $VisualCode = "NC_GEM_VIS_" + ([guid]::NewGuid().ToString("N").Substring(0, 8)).ToUpperInvariant()
}

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Add-Type -AssemblyName System.Drawing

function New-Canvas {
  param([string]$Path, [string]$Kind, [string]$Code)
  $bmp = [System.Drawing.Bitmap]::new(1200, 760)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(18, 22, 28))
  $fontTitle = [System.Drawing.Font]::new("Arial", 42, [System.Drawing.FontStyle]::Bold)
  $fontBody = [System.Drawing.Font]::new("Arial", 30, [System.Drawing.FontStyle]::Regular)
  $fontCode = [System.Drawing.Font]::new("Consolas", 54, [System.Drawing.FontStyle]::Bold)
  $brushWhite = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $brushGreen = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(74, 222, 128))
  $brushRed = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(248, 113, 113))
  $brushBlue = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(96, 165, 250))
  $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(148, 163, 184), 4)

  if ($Kind -eq "safe") {
    $g.FillRectangle($brushBlue, 80, 110, 260, 180)
    $g.FillEllipse($brushGreen, 420, 120, 210, 210)
    $g.DrawRectangle($pen, 720, 120, 320, 210)
    $g.DrawString("Gemini Visual Code Smoke", $fontTitle, $brushWhite, 80, 380)
    $g.DrawString($Code, $fontCode, $brushGreen, 80, 470)
    $g.DrawString("Synthetic image only. No product UI.", $fontBody, $brushWhite, 80, 590)
  } else {
    $g.DrawString("Synthetic Unsafe NeuroChess UI Canary", $fontTitle, $brushWhite, 60, 40)
    $g.FillRectangle([System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(31, 41, 55)), 60, 130, 760, 540)
    $g.DrawRectangle($pen, 90, 170, 380, 380)
    $g.DrawString("Chessboard cramped", $fontBody, $brushWhite, 125, 325)
    $g.FillRectangle($brushRed, 850, 130, 280, 92)
    $g.DrawString("Practice ready", $fontBody, $brushWhite, 870, 155)
    $g.FillRectangle($brushRed, 850, 250, 280, 92)
    $g.DrawString("XP +250", $fontBody, $brushWhite, 900, 275)
    $g.FillRectangle($brushRed, 850, 370, 280, 92)
    $g.DrawString("Transfer rank unlocked", [System.Drawing.Font]::new("Arial", 22, [System.Drawing.FontStyle]::Bold), $brushWhite, 862, 400)
    $g.FillRectangle($brushGreen, 850, 520, 280, 96)
    $g.DrawString("Train now", $fontBody, $brushWhite, 905, 548)
    $g.DrawString("Mobile-first cramped warning pattern", [System.Drawing.Font]::new("Arial", 24), $brushRed, 70, 690)
  }

  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}

$safePath = Join-Path $OutDir "gemini_visual_safe_code_smoke.png"
$unsafePath = Join-Path $OutDir "gemini_visual_unsafe_canary.png"
New-Canvas -Path $safePath -Kind "safe" -Code $VisualCode
New-Canvas -Path $unsafePath -Kind "unsafe" -Code $VisualCode

[ordered]@{
  status = "pass"
  out_dir = (Resolve-Path -LiteralPath $OutDir).Path
  visual_code = $VisualCode
  safe_image_path = (Resolve-Path -LiteralPath $safePath).Path
  unsafe_image_path = (Resolve-Path -LiteralPath $unsafePath).Path
  images_committed = $false
  live_gemini_called = $false
  live_chatgpt_called = $false
  product_mission_executed = $false
} | ConvertTo-Json -Depth 8
