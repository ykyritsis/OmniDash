param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string]$OpenButtonName = "Open"
)

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement
$windows = $root.FindAll(
    [System.Windows.Automation.TreeScope]::Children,
    [System.Windows.Automation.Condition]::TrueCondition)

foreach ($win in $windows) {
    $cls = $win.Current.ClassName
    $name = $win.Current.Name
    if ([string]::IsNullOrWhiteSpace($name)) { continue }
    "window: '$name' class=$cls"
}

# find a dialog that looks like a file picker: has an Edit and an Open button
$target = $null
foreach ($win in $windows) {
    $name = $win.Current.Name
    if ([string]::IsNullOrWhiteSpace($name)) { continue }
    $all = $win.FindAll(
        [System.Windows.Automation.TreeScope]::Descendants,
        [System.Windows.Automation.Condition]::TrueCondition)
    $hasEdit = $false
    $hasOpen = $false
    foreach ($el in $all) {
        $t = $el.Current.ControlType.ProgrammaticName
        if ($t -eq 'ControlType.Edit') { $hasEdit = $true }
        if ($t -eq 'ControlType.Button' -and $el.Current.Name -eq $OpenButtonName) { $hasOpen = $true }
    }
    if ($hasEdit -and $hasOpen -and $name -notlike '*XBOX*') {
        $target = $win
        "picker candidate: '$name' class=$($win.Current.ClassName)"
        break
    }
}
if (-not $target) { "no file picker window found"; exit 1 }

$all = $target.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.Condition]::TrueCondition)
$edit = $null
foreach ($el in $all) {
    if ($el.Current.ControlType.ProgrammaticName -eq 'ControlType.Edit') { $edit = $el; break }
}
if (-not $edit) { "no edit in picker"; exit 1 }
"edit: '$($edit.Current.Name)' id=$($edit.Current.AutomationId)"
$value = $null
if ($edit.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$value)) {
    $value.SetValue($FilePath)
    "typed path: $FilePath"
    Start-Sleep -Milliseconds 700
} else {
    "no ValuePattern"; exit 1
}

foreach ($el in $all) {
    if ($el.Current.ControlType.ProgrammaticName -eq 'ControlType.Button' -and
        $el.Current.Name -eq $OpenButtonName) {
        $inv = $null
        if ($el.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$inv)) {
            $inv.Invoke()
            "pressed $OpenButtonName"
            break
        }
    }
}
