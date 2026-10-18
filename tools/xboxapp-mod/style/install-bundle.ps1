# Install, revert or inspect the UI bundle of the official Xbox app.
#
#   ... -Status          show what is currently installed (no admin needed)
#   ...                  install the theme-patched bundle (index.patched.bundle)
#   ... -Bundle <path>   install a specific bundle (e.g. the route A demo)
#   ... -Restore         put the most recent backup back
#
# The bundle lives in C:\Program Files\WindowsApps (owned by TrustedInstaller), so
# installing needs administrator rights; the script relaunches itself elevated.
# Everything is logged to %LOCALAPPDATA%\XboxMod\install.log and the elevated window
# pauses at the end so you can read the result.
param(
    [string]$Bundle = '',
    [switch]$Restore,
    [switch]$Force,
    [switch]$Status,
    [switch]$Diagnose,
    [switch]$Pause
)

$ErrorActionPreference = 'Stop'

$modDir = Join-Path $env:LOCALAPPDATA 'XboxMod'
$logPath = Join-Path $modDir 'install.log'
New-Item -ItemType Directory -Path $modDir -Force | Out-Null

function Log([string]$message, [string]$colour = 'Gray') {
    $line = '[{0}] {1}' -f (Get-Date -Format 'HH:mm:ss'), $message
    Write-Host $message -ForegroundColor $colour
    try { Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8 } catch { }
}

function Test-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    (New-Object Security.Principal.WindowsPrincipal $id).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Get-BundleInfo {
    $pkg = Get-AppxPackage Microsoft.GamingApp | Select-Object -First 1
    if (-not $pkg) { throw 'Microsoft.GamingApp is not installed' }
    $path = Join-Path $pkg.InstallLocation 'Bundle\index.bundle'
    if (-not (Test-Path $path)) { throw "bundle not found: $path" }
    [pscustomobject]@{
        Package = $pkg
        Path    = $path
        Hash    = (Get-FileHash $path -Algorithm SHA256).Hash.ToLower()
        Size    = (Get-Item $path).Length
    }
}

# ---------------------------------------------------------------- status (no admin)
if ($Status) {
    $info = Get-BundleInfo
    Log "package      : $($info.Package.PackageFullName)" Cyan
    Log "bundle       : $($info.Path)"
    Log "size         : $($info.Size) bytes"
    Log "sha256       : $($info.Hash)"
    $known = @()
    foreach ($candidate in @('index.patched.bundle', 'index.demo.bundle')) {
        $p = Join-Path $modDir $candidate
        $i = [System.IO.Path]::ChangeExtension($p, '.info.json')
        if ((Test-Path $p) -and (Test-Path $i)) {
            $doc = Get-Content $i -Raw | ConvertFrom-Json
            if ($doc.source_sha256 -eq $info.Hash) {
                $known += "MATCHES $candidate (would install cleanly)"
            } elseif ($doc.output_sha256 -eq $info.Hash) {
                $known += "INSTALLED: $candidate"
            } else {
                $known += "does not match $candidate"
            }
        }
    }
    $backups = Get-ChildItem (Join-Path $modDir 'backup') -Filter 'index.bundle.*.orig' -ErrorAction SilentlyContinue
    Log "backups      : $(if ($backups) { $backups.Count } else { 0 })"
    if ($backups) { $backups | Sort-Object LastWriteTime -Descending | Select-Object -First 3 | ForEach-Object { Log "   $($_.Name)  $([math]::Round($_.Length/1MB,2)) MB" } }
    if ($known.Count -eq 0) { Log 'state        : no artifact matches this bundle (original or unknown)' Yellow }
    else { $known | ForEach-Object { Log "state        : $_" Green } }
    return
}

# ---------------------------------------------------------------- elevation
if (-not (Test-Admin)) {
    $forward = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath, '-Pause')
    if ($Bundle) { $forward += @('-Bundle', $Bundle) }
    if ($Restore) { $forward += '-Restore' }
    if ($Force) { $forward += '-Force' }
    if ($Diagnose) { $forward += '-Diagnose' }
    Log 'Requesting administrator rights (accept the UAC prompt)...' Yellow
    Start-Process powershell -Verb RunAs -ArgumentList $forward
    return
}

try {
    $info = Get-BundleInfo
    Log "package : $($info.Package.PackageFullName)" Cyan
    Log "bundle  : $($info.Path)"
    Log "current : $($info.Hash)"

    $backupDir = Join-Path $modDir 'backup'
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null

    function Stop-Xbox {
        foreach ($name in 'XboxPcApp', 'XboxPcAppCE', 'XboxPcAppFT', 'XboxPcTray', 'XboxGameBarWidgets') {
            Get-Process -Name $name -ErrorAction SilentlyContinue | ForEach-Object {
                Log "  stopping $($_.ProcessName) ($($_.Id))"
                $_ | Stop-Process -Force -ErrorAction SilentlyContinue
            }
        }
        Start-Sleep -Seconds 2
    }

    function Grant-Write([string]$path) {
        Log '  clearing read-only attribute'
        try { attrib.exe -R "$path" | Out-Null } catch { }

        Log '  takeown /f (claim the file)'
        $out = & takeown.exe /f "$path" 2>&1
        foreach ($line in $out) { Log "    $line" }
        Log "    exit code: $LASTEXITCODE"

        $owner = (Get-Acl -LiteralPath $path).Owner
        Log "    owner now: $owner"
        if ($owner -notmatch 'Administrators|SYSTEM|ykyri') {
            Log '  takeown /a (claim for Administrators)'
            $out = & takeown.exe /a /f "$path" 2>&1
            foreach ($line in $out) { Log "    $line" }
            Log "    owner now: $((Get-Acl -LiteralPath $path).Owner)"
        }

        Log '  icacls /grant Administrators:F'
        $out = & icacls.exe "$path" /grant '*S-1-5-32-544:F' 2>&1
        foreach ($line in $out) { Log "    $line" }

        try {
            $fs = [System.IO.File]::Open($path, 'Open', 'ReadWrite')
            $fs.Close()
            Log '    write test: OK' Green
        } catch {
            throw "cannot write to the bundle after ACL changes: $($_.Exception.Message)"
        }
    }

    function Copy-FileBytes([string]$from, [string]$to) {
        $input = [System.IO.File]::OpenRead($from)
        try {
            $output = [System.IO.File]::Open($to, 'Open', 'Write')
            try { $input.CopyTo($output) } finally { $output.Close() }
        } finally { $input.Close() }
    }

    function Restore-Ownership([string]$path) {
        Log '  handing ownership back to TrustedInstaller'
        icacls "$path" /setowner "NT SERVICE\TrustedInstaller" | Out-Null
        icacls "$path" /reset | Out-Null
    }

    if ($Diagnose) {
        Log '' ; Log '--- diagnose -------------------------------------------------' Cyan
        Log 'elevation test'
        $groups = & whoami.exe /groups 2>&1
        foreach ($line in $groups) {
            if ($line -match 'S-1-16-12288|S-1-16-8192|S-1-5-32-544|High Mandatory|Medium Mandatory') { Log "  $line" }
        }
        Log 'defender controlled folder access'
        try {
            $mp = Get-MpPreference -ErrorAction Stop
            Log "  EnableControlledFolderAccess: $($mp.EnableControlledFolderAccess)"
        } catch { Log '  cannot read Defender preferences' Yellow }

        Log "file: $($info.Path)"
        $item = Get-Item -LiteralPath $info.Path
        Log "  attributes: $($item.Attributes)"
        $acl = Get-Acl -LiteralPath $info.Path
        Log "  owner: $($acl.Owner)"
        foreach ($rule in ($acl.Access | Select-Object -First 8)) {
            Log ("  {0} {1} {2}" -f $rule.IdentityReference, $rule.FileSystemRights, $rule.AccessControlType)
        }

        $bundleDir = Split-Path -Parent $info.Path
        Log 'folder write test'
        try {
            $probe = Join-Path $bundleDir '.dsh-write-test'
            [System.IO.File]::WriteAllText($probe, 'x')
            Remove-Item -LiteralPath $probe -Force
            Log '  writing into the Bundle folder: OK' Green
        } catch { Log "  writing into the Bundle folder failed: $($_.Exception.Message)" Yellow }

        Log 'attempt takeown + grant (ownership is handed back afterwards)'
        try { Grant-Write $info.Path } catch { Log "  FAILED: $($_.Exception.Message)" Red }
        Restore-Ownership $info.Path
        Log '  ownership restored to TrustedInstaller'
        Log '--------------------------------------------------------------' Cyan
        return
    }

    if ($Restore) {
        $backups = Get-ChildItem $backupDir -Filter 'index.bundle.*.orig' -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending
        if (-not $backups) {
            Log '' ; Log 'nothing to restore: no backup exists.' Yellow
            Log 'The installed bundle is untouched (your Xbox app was never modified).' Yellow
            Log 'If you expected a modification, the install step never ran - run it without -Restore.' Yellow
            if ($Pause) { Read-Host 'Press Enter to close' | Out-Null }
            return
        }
        $from = $backups[0].FullName
        Log "restoring: $from"
        Stop-Xbox
        Grant-Write $info.Path
        Copy-FileBytes $from $info.Path
        Restore-Ownership $info.Path
        $after = (Get-FileHash $info.Path -Algorithm SHA256).Hash.ToLower()
        Log "restored, bundle sha256 now $after" Green
        Start-Process 'shell:appsFolder\Microsoft.GamingApp_8wekyb3d8bbwe!Microsoft.Xbox.App'
        if ($Pause) { Read-Host 'Press Enter to close' | Out-Null }
        return
    }

    $source = if ($Bundle) { $Bundle } else { Join-Path $modDir 'index.patched.bundle' }
    $infoPath = [System.IO.Path]::ChangeExtension($source, '.info.json')
    if (-not (Test-Path $source)) {
        throw "bundle to install is missing: $source`nBuild one first: patch_style.py --write (theme patch) or bundle-demo\build.ps1 (demo)."
    }
    Log "installing: $source"

    $sourceHash = $null
    if (Test-Path $infoPath) {
        $sourceHash = (Get-Content $infoPath -Raw | ConvertFrom-Json).source_sha256
    }
    if ($sourceHash -and $info.Hash -ne $sourceHash -and -not $Force) {
        throw @"
the installed bundle does not match the one this bundle was built for.
  installed: $($info.Hash)
  expected : $sourceHash
The app probably updated. Rebuild, or pass -Force to apply anyway.
"@
    }

    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $backup = Join-Path $backupDir "index.bundle.$($info.Package.Version).$stamp.orig"
    Stop-Xbox
    Copy-Item $info.Path $backup -Force
    Log "backup  : $backup"

    Grant-Write $info.Path
    Copy-FileBytes $source $info.Path
    Restore-Ownership $info.Path

    $after = (Get-FileHash $info.Path -Algorithm SHA256).Hash.ToLower()
    $expected = (Get-FileHash $source -Algorithm SHA256).Hash.ToLower()
    if ($after -ne $expected) { throw "copy verification failed ($after != $expected)" }
    Log "installed and verified: $after" Green
    Log "revert with: powershell -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Restore"
    Start-Process 'shell:appsFolder\Microsoft.GamingApp_8wekyb3d8bbwe!Microsoft.Xbox.App'
    Log 'launched the Xbox app' Green
} catch {
    Log "ERROR: $($_.Exception.Message)" Red
    Log "see log: $logPath"
} finally {
    if ($Pause) { Read-Host 'Press Enter to close' | Out-Null }
}
