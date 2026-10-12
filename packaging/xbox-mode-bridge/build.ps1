# Builds the Xbox mode home app bridge as an unpacked app layout in src/xbox-mode-bridge.
# Nothing is installed or signed here. When the player chooses "Add to Xbox mode" in Settings,
# the launcher copies this layout to their profile and registers it with Add-AppxPackage -Register,
# which Windows allows for unpacked layouts while Developer Mode is on.
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Resolve-Path (Join-Path $here '..\..')
$package = Join-Path $here 'package'
$out = Join-Path $root 'src\xbox-mode-bridge'
New-Item -ItemType Directory -Force (Join-Path $package 'Assets'), (Join-Path $package 'Public') | Out-Null
Set-Content -Path (Join-Path $package 'Public\README.txt') -Value 'Xbox Preview UI Xbox mode bridge.' -Encoding ascii

# 1. Launcher stub.
$stubOut = "/out:$(Join-Path $package 'XboxPreviewUIHome.exe')"
& 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe' /nologo /target:winexe /optimize+ /reference:System.Windows.Forms.dll $stubOut (Join-Path $here 'XboxPreviewUIHome.cs')
if ($LASTEXITCODE) { throw 'Stub compile failed.' }

# 2. Tile and logo assets from the app icon.
Add-Type -AssemblyName System.Drawing
$icon = [System.Drawing.Image]::FromFile((Join-Path $root 'build\icon.png'))
foreach ($asset in @(@('Square150x150Logo', 150, 150), @('Square44x44Logo', 44, 44), @('StoreLogo', 50, 50), @('Wide310x150Logo', 310, 150))) {
  $bitmap = New-Object System.Drawing.Bitmap $asset[1], $asset[2]
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.InterpolationMode = 'HighQualityBicubic'
  $graphics.Clear([System.Drawing.Color]::FromArgb(16, 124, 16))
  $size = [Math]::Min($asset[1], $asset[2])
  $graphics.DrawImage($icon, [int](($asset[1] - $size) / 2), [int](($asset[2] - $size) / 2), $size, $size)
  $bitmap.Save((Join-Path $package "Assets\$($asset[0]).png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose()
}
$icon.Dispose()

# 3. Copy the layout into the app.
if (Test-Path $out) { Remove-Item -Recurse -Force $out }
Copy-Item -Recurse $package $out
Write-Output "Built $out"
