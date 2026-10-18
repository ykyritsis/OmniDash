param(
    [string]$TitleLike = "XBOX",
    [string]$SearchText = "DeadzoneSteam",
    [string]$SelectMatch = "Deadzone",
    [switch]$Add,
    [switch]$DumpOnly
)

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement
$cond = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::NameProperty, $TitleLike)
$win = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)
if (-not $win) { "window not found"; exit 1 }

function Get-All($element) {
    return $element.FindAll(
        [System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.Condition]::TrueCondition)
}

$all = Get-All $win
"elements: $($all.Count)"

# 1. type into the search box
$edit = $null
foreach ($el in $all) {
    if ($el.Current.ControlType.ProgrammaticName -eq 'ControlType.Edit' -and
        $el.Current.Name -like "*Search*") { $edit = $el; break }
}
if (-not $edit) { "search box not found"; exit 1 }
"search box: $($edit.Current.Name)"
$value = $null
if ($edit.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$value)) {
    $value.SetValue($SearchText)
    "typed: $SearchText"
} else {
    "no ValuePattern on search box"; exit 1
}
Start-Sleep -Seconds 2

$all = Get-All $win
"elements after search: $($all.Count)"
foreach ($el in $all) {
    $name = $el.Current.Name
    if ([string]::IsNullOrWhiteSpace($name)) { continue }
    if ($name -like "*$SelectMatch*") {
        $type = $el.Current.ControlType.ProgrammaticName -replace 'ControlType\.', ''
        "CANDIDATE [$type] $name"
    }
}
if ($DumpOnly) { return }

# 2. tick the matching row (checkbox or list item)
$ticked = $false
foreach ($el in $all) {
    $name = $el.Current.Name
    if ([string]::IsNullOrWhiteSpace($name) -or $name -notlike "*$SelectMatch*") { continue }
    $toggle = $null
    if ($el.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$toggle)) {
        if ($toggle.Current.ToggleState -ne 'On') { $toggle.Toggle() }
        "toggled: $name ($($toggle.Current.ToggleState))"
        $ticked = $true
        break
    }
    $sel = $null
    if ($el.TryGetCurrentPattern([System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$sel)) {
        $sel.Select(); "selected: $name"; $ticked = $true; break
    }
    $inv = $null
    if ($el.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$inv)) {
        $inv.Invoke(); "invoked row: $name"; $ticked = $true; break
    }
}
if (-not $ticked) { "could not select a row for '$SelectMatch'" }
Start-Sleep -Seconds 1

# 3. press Add
if ($Add) {
    $all = Get-All $win
    foreach ($el in $all) {
        if ($el.Current.ControlType.ProgrammaticName -eq 'ControlType.Button' -and
            $el.Current.Name -eq 'Add') {
            $inv = $null
            if ($el.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$inv)) {
                $inv.Invoke(); "pressed Add"; break
            }
        }
    }
}
