param([switch]$IncludeHidden)

Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public class WEnum {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int c);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int c);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

$rows = New-Object System.Collections.ArrayList
$cb = [WEnum+EnumProc]{
    param($h, $l)
    $pid2 = 0
    [WEnum]::GetWindowThreadProcessId($h, [ref]$pid2) | Out-Null
    if (-not $IncludeHidden -and -not [WEnum]::IsWindowVisible($h)) { return $true }
    $sb = New-Object System.Text.StringBuilder 512
    [WEnum]::GetWindowText($h, $sb, 512) | Out-Null
    $cls = New-Object System.Text.StringBuilder 256
    [WEnum]::GetClassName($h, $cls, 256) | Out-Null
    $rect = New-Object WEnum+RECT
    [WEnum]::GetWindowRect($h, [ref]$rect) | Out-Null
    $proc = (Get-Process -Id $pid2 -ErrorAction SilentlyContinue).Name
    [void]$rows.Add([pscustomobject]@{
        Handle = $h; Pid = $pid2; Proc = $proc; Class = $cls.ToString()
        Title = $sb.ToString(); Visible = [WEnum]::IsWindowVisible($h)
        Size = "$($rect.Right - $rect.Left)x$($rect.Bottom - $rect.Top)"
    })
    return $true
}
[WEnum]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null
$rows | Where-Object { $_.Proc -match 'Picker|Xbox|ApplicationFrame|SDK' -or $_.Title -match 'Open|Select|Add' } |
    Select-Object Pid, Proc, Class, Title, Visible, Size | Format-Table -AutoSize | Out-String -Width 170
