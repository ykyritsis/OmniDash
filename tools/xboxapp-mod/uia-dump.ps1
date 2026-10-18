param(
    [string]$TitleLike = "XBOX",
    [int]$MaxItems = 70,
    [string]$InvokeName = "",
    [string]$MatchContains = ""
)

Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes

$root = [System.Windows.Automation.AutomationElement]::RootElement
$cond = New-Object System.Windows.Automation.PropertyCondition(
    [System.Windows.Automation.AutomationElement]::NameProperty, $TitleLike)
$win = $root.FindFirst([System.Windows.Automation.TreeScope]::Children, $cond)
if (-not $win) { "window '$TitleLike' not found"; exit 1 }
"window: $($win.Current.Name) class=$($win.Current.ClassName)"

$all = $win.FindAll(
    [System.Windows.Automation.TreeScope]::Descendants,
    [System.Windows.Automation.Condition]::TrueCondition)

"elements: $($all.Count)"
$shown = 0
$target = $null
foreach ($el in $all) {
    $name = $el.Current.Name
    if ([string]::IsNullOrWhiteSpace($name)) { continue }
    $type = $el.Current.ControlType.ProgrammaticName -replace 'ControlType\.', ''
    if ($MatchContains -and $name -like "*$MatchContains*") {
        "MATCH: [$type] $name"
        if (-not $target) { $target = $el }
    }
    if ($shown -lt $MaxItems -and $type -in @('Button', 'ListItem', 'Text', 'TabItem', 'ComboBox', 'MenuItem')) {
        "[$type] $name"
        $shown++
    }
}
if ($InvokeName) {
    foreach ($el in $all) {
        if ($el.Current.Name -like "*$InvokeName*") {
            $pattern = $null
            if ($el.TryGetCurrentPattern(
                    [System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) {
                $pattern.Invoke()
                "invoked: $($el.Current.Name)"
                break
            }
        }
    }
}
