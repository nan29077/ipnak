param(
  [string]$OutputDir = "public/app-packaging-assets"
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$outputPath = Join-Path $projectRoot $OutputDir
[System.IO.Directory]::CreateDirectory($outputPath) | Out-Null

$generatedDir = "C:\Users\Jeon\.codex\generated_images\019fdf83-24ee-7702-abe1-e9cf2baecbfe"
$slideSources = @(
  (Join-Path $generatedDir "exec-80fffec8-c580-41a7-a42d-f3d361930607.png"),
  (Join-Path $generatedDir "exec-40fc4cf9-8176-4613-8d33-50f83b80c745.png"),
  (Join-Path $generatedDir "exec-7f31dfb5-f172-40cf-9c95-d8356b85d884.png"),
  (Join-Path $generatedDir "exec-d7c1271e-24d1-428b-8797-9238f7a038fc.png")
)
$markPath = Join-Path $projectRoot "public/logo-ipnak-mark-transparent-v2.png"

function New-Bitmap([int]$Width, [int]$Height, [bool]$Alpha = $true) {
  $format = if ($Alpha) {
    [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
  } else {
    [System.Drawing.Imaging.PixelFormat]::Format24bppRgb
  }
  return [System.Drawing.Bitmap]::new($Width, $Height, $format)
}

function Set-Quality([System.Drawing.Graphics]$Graphics) {
  $Graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
  $Graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $Graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $Graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $Graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
}

function Save-Png([System.Drawing.Bitmap]$Bitmap, [string]$Name) {
  $target = Join-Path $outputPath $Name
  $Bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
  return $target
}

function Draw-CenteredImage(
  [System.Drawing.Graphics]$Graphics,
  [System.Drawing.Image]$Image,
  [int]$CanvasWidth,
  [int]$CanvasHeight,
  [int]$TargetWidth,
  [int]$TargetHeight,
  [int]$OffsetY = 0
) {
  $x = [int](($CanvasWidth - $TargetWidth) / 2)
  $y = [int](($CanvasHeight - $TargetHeight) / 2) + $OffsetY
  $Graphics.DrawImage($Image, $x, $y, $TargetWidth, $TargetHeight)
}

function Fill-BrandGradient([System.Drawing.Graphics]$Graphics, [int]$Size, [bool]$Light = $false) {
  $rect = [System.Drawing.Rectangle]::new(0, 0, $Size, $Size)
  if ($Light) {
    $start = [System.Drawing.Color]::FromArgb(255, 255, 253, 247)
    $end = [System.Drawing.Color]::FromArgb(255, 232, 238, 241)
  } else {
    $start = [System.Drawing.Color]::FromArgb(255, 17, 38, 58)
    $end = [System.Drawing.Color]::FromArgb(255, 5, 15, 27)
  }
  $brush = [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, $start, $end, 145)
  $Graphics.FillRectangle($brush, $rect)
  $brush.Dispose()
}

function Draw-BrandRings([System.Drawing.Graphics]$Graphics, [int]$Size, [bool]$Light = $false) {
  $alpha = if ($Light) { 22 } else { 35 }
  $color = [System.Drawing.Color]::FromArgb($alpha, 234, 179, 8)
  foreach ($ratio in @(0.84, 0.66, 0.48)) {
    $diameter = [int]($Size * $ratio)
    $offset = [int](($Size - $diameter) / 2)
    $pen = [System.Drawing.Pen]::new($color, [Math]::Max(2, $Size * 0.004))
    $Graphics.DrawEllipse($pen, $offset, $offset, $diameter, $diameter)
    $pen.Dispose()
  }
}

$mark = [System.Drawing.Image]::FromFile($markPath)
try {
  # 1. Store/app icon: fully opaque RGB PNG.
  $icon = New-Bitmap 1024 1024 $false
  $g = [System.Drawing.Graphics]::FromImage($icon)
  try {
    Set-Quality $g
    Fill-BrandGradient $g 1024
    Draw-BrandRings $g 1024
    Draw-CenteredImage $g $mark 1024 1024 750 750 0
  } finally { $g.Dispose() }
  Save-Png $icon "app-icon-1024.png" | Out-Null
  $icon.Dispose()

  # 2. Android adaptive foreground: transparent and safely inside the center zone.
  $foreground = New-Bitmap 1024 1024 $true
  $g = [System.Drawing.Graphics]::FromImage($foreground)
  try {
    Set-Quality $g
    $g.Clear([System.Drawing.Color]::Transparent)
    Draw-CenteredImage $g $mark 1024 1024 650 650 0
  } finally { $g.Dispose() }
  Save-Png $foreground "android-adaptive-foreground-1024.png" | Out-Null
  $foreground.Dispose()

  # 3. Android adaptive background: fully opaque, no foreground detail.
  $background = New-Bitmap 1024 1024 $false
  $g = [System.Drawing.Graphics]::FromImage($background)
  try {
    Set-Quality $g
    Fill-BrandGradient $g 1024
    Draw-BrandRings $g 1024
  } finally { $g.Dispose() }
  Save-Png $background "android-adaptive-background-1024.png" | Out-Null
  $background.Dispose()

  # 4-5. Light/dark splash screens with centered official mark and large safe area.
  foreach ($variant in @(@("light", $true), @("dark", $false))) {
    $name = [string]$variant[0]
    $isLight = [bool]$variant[1]
    $splash = New-Bitmap 2732 2732 $false
    $g = [System.Drawing.Graphics]::FromImage($splash)
    try {
      Set-Quality $g
      Fill-BrandGradient $g 2732 $isLight
      Draw-BrandRings $g 2732 $isLight
      Draw-CenteredImage $g $mark 2732 2732 900 900 -45
      $dotBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(210, 234, 179, 8))
      $g.FillEllipse($dotBrush, 1348, 1940, 36, 36)
      $dotBrush.Dispose()
    } finally { $g.Dispose() }
    Save-Png $splash "splash-$name-2732.png" | Out-Null
    $splash.Dispose()
  }

  # 6-9. Generated onboarding art, resized to the exact requested dimensions.
  for ($i = 0; $i -lt $slideSources.Count; $i++) {
    $source = [System.Drawing.Image]::FromFile($slideSources[$i])
    try {
      $slide = New-Bitmap 1080 1200 $false
      $g = [System.Drawing.Graphics]::FromImage($slide)
      try {
        Set-Quality $g
        $targetAspect = 1080.0 / 1200.0
        $sourceAspect = $source.Width / [double]$source.Height
        if ([Math]::Abs($sourceAspect - $targetAspect) -lt 0.01) {
          $g.DrawImage($source, 0, 0, 1080, 1200)
        } elseif ($sourceAspect -lt $targetAspect) {
          # Portrait generations are cropped vertically, preserving landscape scale and lower overlay space.
          $cropHeight = [int]($source.Width / $targetAspect)
          $cropY = if ($i -eq 1) { [Math]::Min(150, $source.Height - $cropHeight) } else { [int](($source.Height - $cropHeight) / 2) }
          $destRect = [System.Drawing.Rectangle]::new(0, 0, 1080, 1200)
          $sourceRect = [System.Drawing.Rectangle]::new(0, $cropY, $source.Width, $cropHeight)
          $g.DrawImage($source, $destRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
        } else {
          $cropWidth = [int]($source.Height * $targetAspect)
          $cropX = [int](($source.Width - $cropWidth) / 2)
          $destRect = [System.Drawing.Rectangle]::new(0, 0, 1080, 1200)
          $sourceRect = [System.Drawing.Rectangle]::new($cropX, 0, $cropWidth, $source.Height)
          $g.DrawImage($source, $destRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
        }
      } finally { $g.Dispose() }
      Save-Png $slide ("onboarding-slide-{0}-1080x1200.png" -f ($i + 1)) | Out-Null
      $slide.Dispose()
    } finally { $source.Dispose() }
  }

  # 10. Android notification icon: bold hook-arrow silhouette for legibility at 24 px.
  $maskLarge = New-Bitmap 512 512 $true
  $g = [System.Drawing.Graphics]::FromImage($maskLarge)
  try {
    Set-Quality $g
    $g.Clear([System.Drawing.Color]::Transparent)
    $pen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, 58)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $shaft = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $shaft.StartFigure()
    $shaft.AddLine(256, 105, 256, 285)
    $shaft.AddBezier(256, 285, 256, 405, 420, 405, 420, 285)
    $shaft.AddBezier(420, 285, 420, 225, 350, 220, 322, 275)
    $g.DrawPath($pen, $shaft)
    $shaft.Dispose()
    $arrow = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $arrow.AddLines(@(
      [System.Drawing.Point]::new(180, 178),
      [System.Drawing.Point]::new(256, 102),
      [System.Drawing.Point]::new(332, 178)
    ))
    $g.DrawPath($pen, $arrow)
    $arrow.Dispose()
    $pen.Dispose()
  } finally { $g.Dispose() }
  $notification = New-Bitmap 96 96 $true
  $g = [System.Drawing.Graphics]::FromImage($notification)
  try {
    Set-Quality $g
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($maskLarge, 0, 0, 96, 96)
  } finally { $g.Dispose() }
  $maskLarge.Dispose()
  # Android notification assets must contain white RGB only; antialiasing lives in alpha.
  for ($y = 0; $y -lt $notification.Height; $y++) {
    for ($x = 0; $x -lt $notification.Width; $x++) {
      $pixel = $notification.GetPixel($x, $y)
      if ($pixel.A -gt 0) {
        $notification.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($pixel.A, 255, 255, 255))
      }
    }
  }
  Save-Png $notification "android-notification-icon-96.png" | Out-Null
  # Human-visible preview only; do not use this dark-backed file as the Android resource.
  $notificationPreview = New-Bitmap 256 256 $false
  $g = [System.Drawing.Graphics]::FromImage($notificationPreview)
  try {
    Set-Quality $g
    $g.Clear([System.Drawing.Color]::FromArgb(255, 13, 27, 42))
    $g.DrawImage($notification, 48, 48, 160, 160)
  } finally { $g.Dispose() }
  Save-Png $notificationPreview "android-notification-icon-preview-dark.png" | Out-Null
  $notificationPreview.Dispose()
  $notification.Dispose()
} finally {
  $mark.Dispose()
}

$manifest = @"
# 입낚 앱 패키징 이미지

브랜드 팔레트: 딥 네이비 `#0d1b2a`, 골드 `#eab308`, 아쿠아 `#2dd4bf`

| 파일 | 규격 | 용도 |
|---|---:|---|
| app-icon-1024.png | 1024×1024 RGB | 앱 스토어 아이콘 (알파 없음) |
| android-adaptive-foreground-1024.png | 1024×1024 RGBA | Android 적응형 전경 |
| android-adaptive-background-1024.png | 1024×1024 RGB | Android 적응형 배경 |
| splash-light-2732.png | 2732×2732 RGB | 라이트 스플래시 |
| splash-dark-2732.png | 2732×2732 RGB | 다크 스플래시 |
| onboarding-slide-1-1080x1200.png | 1080×1200 RGB | 환영/앵글러 라이프 |
| onboarding-slide-2-1080x1200.png | 1080×1200 RGB | 스마트 낚시 포인트 |
| onboarding-slide-3-1080x1200.png | 1080×1200 RGB | 입낚볼 측정/기록 |
| onboarding-slide-4-1080x1200.png | 1080×1200 RGB | 권한/안전 |
| android-notification-icon-96.png | 96×96 RGBA | Android 흰색 실루엣 알림 아이콘 |
| android-notification-icon-preview-dark.png | 256×256 RGB | 알림 아이콘 확인용 미리보기 (패키징에 사용하지 않음) |
"@
[System.IO.File]::WriteAllText((Join-Path $outputPath "README.md"), $manifest, [System.Text.UTF8Encoding]::new($false))

Write-Output "Created app packaging assets in: $outputPath"
