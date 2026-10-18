param(
    [int]$ProcessId,
    [string]$TitleLike = "",
    [string]$OutFile = "$env:TEMP\xboxapp-window.png"
)

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class Win {
  public delegate bool EnumProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr lParam);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT rect);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr hWnd, StringBuilder name, int count);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdc, uint flags);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

$found = New-Object System.Collections.ArrayList
$callback = [Win+EnumProc]{
    param($hWnd, $lParam)
    $winPid = 0
    [Win]::GetWindowThreadProcessId($hWnd, [ref]$winPid) | Out-Null
    if ($winPid -eq $ProcessId -and [Win]::IsWindowVisible($hWnd)) {
        $rect = New-Object Win+RECT
        [Win]::GetWindowRect($hWnd, [ref]$rect) | Out-Null
        $len = [Win]::GetWindowTextLength($hWnd)
        $sb = New-Object System.Text.StringBuilder ($len + 2)
        [Win]::GetWindowText($hWnd, $sb, $sb.Capacity) | Out-Null
        $cls = New-Object System.Text.StringBuilder 256
        [Win]::GetClassName($hWnd, $cls, 256) | Out-Null
        [void]$found.Add([pscustomobject]@{
            Handle = $hWnd
            Title  = $sb.ToString()
            Class  = $cls.ToString()
            Width  = $rect.Right - $rect.Left
            Height = $rect.Bottom - $rect.Top
        })
    }
    return $true
}
[Win]::EnumWindows($callback, [IntPtr]::Zero) | Out-Null

if (-not $found) { "no visible windows for pid $ProcessId"; exit 1 }
$found | Sort-Object { $_.Width * $_.Height } -Descending |
    Select-Object Handle, Class, Title, Width, Height | Format-Table -AutoSize | Out-String -Width 160

$candidates = $found
if ($TitleLike) {
    $candidates = $found | Where-Object { $_.Title -like "*$TitleLike*" }
    if (-not $candidates) { "no window titled like '$TitleLike'"; exit 1 }
}
$target = $candidates | Where-Object { $_.Width -gt 400 -and $_.Height -gt 300 } |
    Sort-Object { $_.Width * $_.Height } -Descending | Select-Object -First 1
if (-not $target) { "no large window found"; exit 1 }

$bmp = New-Object System.Drawing.Bitmap($target.Width, $target.Height)
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$hdc = $gfx.GetHdc()
$ok = [Win]::PrintWindow($target.Handle, $hdc, 2)
$gfx.ReleaseHdc($hdc)
$gfx.Dispose()
$bmp.Save($OutFile, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
"PrintWindow=$ok target=$($target.Class) '$($target.Title)' $($target.Width)x$($target.Height) -> $OutFile"
