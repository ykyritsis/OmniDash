param(
    [string]$ExePath = "C:\Program Files (x86)\Steam\steamapps\common\Deadzone Rogue\DeadzoneSteam.exe",
    [string]$ShortcutName = "Deadzone Rogue",
    [switch]$CreateShortcut,
    [string]$SearchText = "Deadzone",
    [switch]$Select,
    [switch]$Add
)

$ErrorActionPreference = 'Stop'

function Get-XboxWindow {
    Add-Type -AssemblyName UIAutomationClient
    Add-Type -AssemblyName UIAutomationTypes
    $root = [System.Windows.Automation.AutomationElement]::RootElement
    $cond = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::NameProperty, 'XBOX')
    return $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)
}

function Get-All($element) {
    return $element.FindAll(
        [System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.Condition]::TrueCondition)
}

function Invoke-NamedButton($element, [string]$name) {
    foreach ($el in (Get-All $element)) {
        if ($el.Current.ControlType.ProgrammaticName -eq 'ControlType.Button' -and
            $el.Current.Name -eq $name) {
            $inv = $null
            if ($el.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$inv)) {
                $inv.Invoke()
                return $true
            }
        }
    }
    return $false
}

if ($CreateShortcut) {
    $startMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
    $lnkPath = Join-Path $startMenu "$ShortcutName.lnk"
    $shell = New-Object -ComObject WScript.Shell
    $lnk = $shell.CreateShortcut($lnkPath)
    $lnk.TargetPath = $ExePath
    $lnk.WorkingDirectory = Split-Path $ExePath
    $lnk.Description = "Deadzone: Rogue (Steam)"
    $lnk.Save()
    "shortcut created: $lnkPath"
    Start-Sleep -Seconds 2
}

$win = Get-XboxWindow
if (-not $win) { "XBOX window not found"; exit 1 }

# make sure the add dialog is open
$buttons = (Get-All $win) | Where-Object {
    $_.Current.ControlType.ProgrammaticName -eq 'ControlType.Button'
}
$hasBrowse = $buttons | Where-Object { $_.Current.Name -eq 'Browse' }
if (-not $hasBrowse) {
    if (Invoke-NamedButton $win 'Add a game to your library') {
        "opened: Add a game to your library"
        Start-Sleep -Seconds 3
    } else {
        "could not open the add dialog (is the library tab visible?)"; exit 1
    }
}

# type into the search box
$edit = $null
foreach ($el in (Get-All $win)) {
    if ($el.Current.ControlType.ProgrammaticName -eq 'ControlType.Edit' -and
        $el.Current.Name -like '*Search*') { $edit = $el; break }
}
if (-not $edit) { "search box not found"; exit 1 }
$value = $null
if ($edit.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$value)) {
    $value.SetValue($SearchText)
    "search text: $SearchText"
} else { "no ValuePattern"; exit 1 }
Start-Sleep -Seconds 2

$candidates = @()
foreach ($el in (Get-All $win)) {
    $n = $el.Current.Name
    if ([string]::IsNullOrWhiteSpace($n)) { continue }
    if ($n -match 'Deadzone') {
        $t = $el.Current.ControlType.ProgrammaticName -replace 'ControlType\.', ''
        "[$t] $n"
        $candidates += $el
    }
}
if (-not $candidates) { "no matching row yet" }

if ($Select -and $candidates.Count -gt 0) {
    foreach ($el in $candidates) {
        $toggle = $null
        if ($el.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$toggle)) {
            if ($toggle.Current.ToggleState -ne 'On') { $toggle.Toggle() }
            "toggled: $($el.Current.Name) -> $($toggle.Current.ToggleState)"
            break
        }
    }
}
if ($Add) {
    if (Invoke-NamedButton $win 'Add') { "pressed Add" } else { "Add button not found" }
}
