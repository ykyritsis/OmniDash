param(
    [string]$WindowName = 'XBOX'
)

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement
$cond = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::NameProperty, $WindowName)
$win = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)
if (-not $win) { 'XBOX window not found (open the app on My games first)'; exit 1 }

$all = $win.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.Condition]::TrueCondition)

$tiles = @()
foreach ($el in $all) {
    $n = $el.Current.Name
    if ([string]::IsNullOrWhiteSpace($n)) { continue }
    if ($n -match ', (Steam|EA|Epic|GOG|Battle\.net|Ubisoft|Custom)') {
        $tiles += ($n -split ',')[0].Trim()
    } elseif ($el.Current.ControlType.ProgrammaticName -eq 'ControlType.MenuItem' -and $n -match 'Installed') {
        $tiles += ($n -split ',')[0].Trim()
    }
}
$tiles = $tiles | Select-Object -Unique
Write-Host "tiles visible in UI: $($tiles.Count)" -ForegroundColor Cyan

$names = @()
foreach ($acf in @(
        'C:\Program Files (x86)\Steam\steamapps\appmanifest_*.acf',
        'D:\SteamLibrary\steamapps\appmanifest_*.acf')) {
    foreach ($file in Get-Item $acf -ErrorAction SilentlyContinue) {
        $raw = Get-Content $file.FullName -Raw
        $name = ([regex]::Match($raw, '"name"\s+"([^"]+)"')).Groups[1].Value
        $id = ([regex]::Match($raw, '"appid"\s+"([^"]+)"')).Groups[1].Value
        $flags = ([regex]::Match($raw, '"StateFlags"\s+"([^"]+)"')).Groups[1].Value
        if ($name) { $names += [pscustomobject]@{ Id = $id; Name = $name; Flags = $flags } }
    }
}
Write-Host "installed steam manifests: $($names.Count)" -ForegroundColor Cyan
Write-Host "`n=== in Steam but not listed by the Xbox app ===" -ForegroundColor Yellow
foreach ($item in $names) {
    $hit = $tiles | Where-Object { $item.Name -like ("*" + ($_ -replace '[^\w ]', '') + "*") }
    $simple = $item.Name -replace '[^\w ]', ''
    $match = $tiles | Where-Object { ($_ -replace '[^\w ]', '') -like "*$simple*" -or $simple -like "*$($_ -replace '[^\w ]', '')*" }
    if (-not $match) {
        Write-Host ("  {0,-34} appid={1,-8} StateFlags={2}" -f $item.Name, $item.Id, $item.Flags)
    }
}
Write-Host "`n=== listed names (first 40) ===" -ForegroundColor Cyan
$tiles | Select-Object -First 40 | ForEach-Object { "  $_" }
