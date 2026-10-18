param(
    [string]$Title = "Deadzone: Rogue",
    [string]$ImagePath = "",
    [switch]$SetTitle,
    [switch]$PickImage,
    [switch]$Save,
    [switch]$DumpOnly
)

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement
$cond = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::NameProperty, 'XBOX')
$win = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)
if (-not $win) { "XBOX window not found"; exit 1 }

$all = $win.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.Condition]::TrueCondition)

function Invoke-Button([string]$name) {
    foreach ($el in $all) {
        if ($el.Current.ControlType.ProgrammaticName -ne 'ControlType.Button') { continue }
        if ($el.Current.Name -ne $name) { continue }
        $inv = $null
        if ($el.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$inv)) {
            $inv.Invoke(); "invoked (invoke pattern): $name"; return $true
        }
        $legacy = $null
        if ($el.TryGetCurrentPattern([System.Windows.Automation.LegacyIAccessiblePattern]::Pattern, [ref]$legacy)) {
            $legacy.DoDefaultAction(); "invoked (legacy action): $name"; return $true
        }
        try {
            $el.SetFocus()
            Start-Sleep -Milliseconds 250
            Add-Type -AssemblyName System.Windows.Forms
            [System.Windows.Forms.SendKeys]::SendWait(' ')
            "invoked (focus + space): $name"
            return $true
        } catch {
            "could not activate '$name': $($_.Exception.Message)"
        }
    }
    return $false
}

"=== edit fields"
$edits = @()
foreach ($el in $all) {
    if ($el.Current.ControlType.ProgrammaticName -ne 'ControlType.Edit') { continue }
    $v = $null
    $text = ''
    if ($el.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$v)) {
        $text = $v.Current.Value
    }
    $edits += [pscustomobject]@{ Element = $el; Text = $text }
    "  [$($edits.Count)] '$text' id=$($el.Current.AutomationId)"
}

if ($DumpOnly) { return }

if ($SetTitle) {
    $target = $edits | Where-Object { $_.Text -like 'Deadzone*' } | Select-Object -First 1
    if (-not $target) { "title field not found"; exit 1 }
    $v = $null
    if ($target.Element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$v)) {
        $v.SetValue($Title)
        "title set to: $Title"
    }
}

if ($PickImage) {
    if (-not (Invoke-Button 'Pick a custom image file')) { "image button not found" }
}

if ($Save) {
    if (-not (Invoke-Button 'Save')) { "save button not found" }
}
