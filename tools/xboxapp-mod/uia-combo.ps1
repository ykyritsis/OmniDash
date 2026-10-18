param(
    [string]$TitleLike = "XBOX",
    [string]$ComboName = "Play state",
    [string]$SelectName = ""
)

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement
$cond = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::NameProperty, $TitleLike)
$win = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)
if (-not $win) { "window not found"; exit 1 }

$all = $win.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.Condition]::TrueCondition)

$combo = $null
foreach ($el in $all) {
    if ($el.Current.ControlType.ProgrammaticName -eq 'ControlType.ComboBox' -and
        $el.Current.Name -like "*$ComboName*") { $combo = $el; break }
}
if (-not $combo) { "combo '$ComboName' not found"; exit 1 }
"combo: $($combo.Current.Name)"

$expand = $null
if (-not $combo.TryGetCurrentPattern(
        [System.Windows.Automation.ExpandCollapsePattern]::Pattern, [ref]$expand)) {
    "no expand pattern"; exit 1
}
$expand.Expand()
Start-Sleep -Milliseconds 900

$items = $combo.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.Condition]::TrueCondition)
"items under combo: $($items.Count)"
foreach ($item in $items) {
    $name = $item.Current.Name
    if ([string]::IsNullOrWhiteSpace($name)) { continue }
    $type = $item.Current.ControlType.ProgrammaticName -replace 'ControlType\.', ''
    "[$type] $name"
    if ($SelectName -and $name -like "*$SelectName*") {
        $sel = $null
        if ($item.TryGetCurrentPattern(
                [System.Windows.Automation.SelectionItemPattern]::Pattern, [ref]$sel)) {
            $sel.Select()
            "selected: $name"
        } elseif ($item.TryGetCurrentPattern(
                [System.Windows.Automation.InvokePattern]::Pattern, [ref]$sel)) {
            $sel.Invoke()
            "invoked: $name"
        }
    }
}
