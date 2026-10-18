param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [string]$DialogTitle = "Open"
)

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement
$windows = $root.FindAll(
    [System.Windows.Automation.TreeScope]::Children,
    [System.Windows.Automation.Condition]::TrueCondition)

$dialog = $null
foreach ($win in $windows) {
    if ($win.Current.ClassName -eq '#32770' -and $win.Current.Name -eq $DialogTitle) {
        $dialog = $win
        break
    }
}
if (-not $dialog) { "Open dialog not found"; exit 1 }
"dialog: $($dialog.Current.Name) [$($dialog.Current.ClassName)]"

$all = $dialog.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.Condition]::TrueCondition)

$edit = $null
foreach ($el in $all) {
    if ($el.Current.ControlType.ProgrammaticName -eq 'ControlType.Edit') {
        "edit: '$($el.Current.Name)' id=$($el.Current.AutomationId)"
        if (-not $edit) { $edit = $el }
    }
}
if (-not $edit) { "no edit field in dialog"; exit 1 }

$value = $null
if (-not $edit.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$value)) {
    "no ValuePattern on edit"; exit 1
}
$value.SetValue($FilePath)
"typed: $FilePath"
Start-Sleep -Milliseconds 800

$pressed = $false
foreach ($el in $all) {
    if ($el.Current.ControlType.ProgrammaticName -eq 'ControlType.Button' -and
        ($el.Current.Name -eq 'Open' -or $el.Current.Name -eq '&Open')) {
        $inv = $null
        if ($el.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$inv)) {
            $inv.Invoke()
            "pressed Open"
            $pressed = $true
            break
        }
    }
}
if (-not $pressed) { "Open button not found" }
