$ErrorActionPreference = 'Stop'
$workspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).ProviderPath
$fixtureDir = Join-Path $workspace '.visual-review\host-session-fixture'
New-Item -ItemType Directory -Path $fixtureDir -Force | Out-Null
$source = Join-Path $fixtureDir 'SessionFixture.cs'
$executable = Join-Path $fixtureDir 'GarrisonSessionFixture.exe'
[IO.File]::WriteAllText($source, 'class SessionFixture { static void Main(string[] args) { System.Threading.Thread.Sleep(int.Parse(args[0])); } }')
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
& $compiler /nologo /target:winexe "/out:$executable" $source
if ($LASTEXITCODE -ne 0) { throw 'Fixture compilation failed' }
$wrapper = Join-Path $workspace 'tools\host-game-session.ps1'
$shell = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$arguments = @('-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', "`"$wrapper`"", '-AppId', '1', '-Executable', "`"$executable`"", '-LaunchTimeoutSeconds', '5', '-ExitGraceSeconds', '1', '-MonitorOnly')
$output = Join-Path $fixtureDir 'monitor.stdout'
$errors = Join-Path $fixtureDir 'monitor.stderr'
$monitor = Start-Process -FilePath $shell -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput $output -RedirectStandardError $errors
# Retain the process handle so Windows PowerShell 5 can read its exit code even
# after the short-lived fixture has closed.
[void]$monitor.Handle
$gameFixture = $null
try {
    Start-Sleep -Milliseconds 900
    if ($monitor.HasExited) { throw 'The session ended before the delayed game process appeared' }
    $gameFixture = Start-Process -FilePath $executable -ArgumentList '1800' -WindowStyle Hidden -PassThru
    Start-Sleep -Milliseconds 900
    if ($monitor.HasExited) { throw 'The session ended while the game fixture was running' }
    if (!$monitor.WaitForExit(10000)) { throw 'The session failed to end after the game fixture closed' }
    if ($monitor.ExitCode -ne 0) { throw (Get-Content -LiteralPath $errors -Raw) }
    if ((Get-Content -LiteralPath $output -Raw) -notmatch 'Game closed') { throw 'Game exit was not detected' }
    Write-Output 'PASS delayed game start, exact executable tracking, and automatic exit after game process closes. No Steam launch or pairing used.'
} finally {
    if (!$monitor.HasExited) { Stop-Process -Id $monitor.Id }
    if ($gameFixture -and !$gameFixture.HasExited) { Stop-Process -Id $gameFixture.Id }
}
