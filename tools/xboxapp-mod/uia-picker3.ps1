param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [int]$TimeoutSeconds = 12
)

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
$dialog = $null
$seen = @()

while ((Get-Date) -lt $deadline -and -not $dialog) {
    $windows = $root.FindAll(
        [System.Windows.Automation.TreeScope]::Children,
        [System.Windows.Automation.Condition]::TrueCondition)
    foreach ($win in $windows) {
        $cls = $win.Current.ClassName
        $name = $win.Current.Name
        if ($cls -eq '#32770' -or $name -match '^(Open|Select|Choose)') {
            if ($seen -notcontains "$name|$cls") {
                $seen += "$name|$cls"
                "candidate: '$name' [$cls]"
            }
            if ($cls -eq '#32770') { $dialog = $win; break }
        }
    }
    if (-not $dialog) { Start-Sleep -Milliseconds 600 }
}
if (-not $dialog) { "no file dialog appeared"; exit 1 }
"dialog: '$($dialog.Current.Name)' [$($dialog.Current.ClassName)]"

$all = $dialog.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.Condition]::TrueCondition)

$edit = $null
foreach ($el in $all) {
    if ($el.Current.ControlType.ProgrammaticName -eq 'ControlType.Edit') {
        "  edit: '$($el.Current.Name)' id=$($el.Current.AutomationId)"
        if (-not $edit -or $el.Current.AutomationId -eq '1148') { $edit = $el }
    }
}
if (-not $edit) { "no edit field"; exit 1 }

$value = $null
if (-not $edit.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$value)) {
    "no ValuePattern"; exit 1
}
$value.SetValue($FilePath)
"typed: $FilePath"
Start-Sleep -Milliseconds 900

foreach ($el in $all) {
    $n = $el.Current.Name
    if ($el.Current.ControlType.ProgrammaticName -eq 'ControlType.Button' -and
        ($n -eq 'Open' -or $n -eq '&Open' -or $n -eq 'Select')) {
        $inv = $null
        if ($el.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$inv)) {
            $inv.Invoke()
            "pressed: $n"
            exit 0
        }
    }
}
"Open/Select button not found"
