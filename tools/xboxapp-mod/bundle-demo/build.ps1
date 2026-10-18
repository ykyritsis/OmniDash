# Build the demo React Native bundle for the official Xbox app (route A).
#
#   powershell -ExecutionPolicy Bypass -File build.ps1
#
# Output: %LOCALAPPDATA%\XboxMod\index.demo.bundle  (+ index.demo.info.json)
# Install:
#   powershell -ExecutionPolicy Bypass -File "<repo>\tools\xboxapp-mod\style\install-bundle.ps1" ^
#       -Bundle "%LOCALAPPDATA%\XboxMod\index.demo.bundle"
param(
    [string]$OutName = 'index.demo.bundle'
)

# Metro and hermesc both write progress/warnings to stderr; keep going and check
# exit codes explicitly instead of letting PowerShell treat stderr as fatal.
$ErrorActionPreference = 'Continue'
Set-Location -LiteralPath $PSScriptRoot

function Resolve-Node {
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $fallback = Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
    if (Test-Path $fallback) { return $fallback }
    throw 'node.exe not found on PATH and no bundled runtime found'
}

$node = Resolve-Node
Write-Host "node      : $node"
Write-Host "project   : $PSScriptRoot"

$buildDir = Join-Path $PSScriptRoot 'build'
New-Item -ItemType Directory -Path $buildDir -Force | Out-Null
$jsBundle = Join-Path $buildDir 'index.jsbundle'
$hbc = Join-Path $buildDir 'index.hbc'

Write-Host "`n[1/3] Metro bundle (platform windows, release)..." -ForegroundColor Cyan
& $node 'node_modules\react-native\cli.js' bundle --platform windows --dev false --minify true `
    --entry-file index.js --bundle-output $jsBundle --assets-dest (Join-Path $buildDir 'assets') `
    2> (Join-Path $buildDir 'metro.log')
if (-not (Test-Path $jsBundle)) {
    Get-Content (Join-Path $buildDir 'metro.log') -Tail 20
    throw 'metro did not produce a bundle'
}
Write-Host ("      js bundle: {0:N0} bytes" -f (Get-Item $jsBundle).Length)

Write-Host "`n[2/3] Hermes compile (bytecode must be v96)..." -ForegroundColor Cyan
$hermesc = Join-Path $PSScriptRoot 'node_modules\react-native\sdks\hermesc\win64-bin\hermesc.exe'
if (-not (Test-Path $hermesc)) { throw "hermesc missing: $hermesc" }
& $hermesc -emit-binary -O -out $hbc $jsBundle 2> (Join-Path $buildDir 'hermesc.log')
if (-not (Test-Path $hbc)) {
    Get-Content (Join-Path $buildDir 'hermesc.log') -Tail 20
    throw 'hermesc did not produce bytecode'
}
$bytes = [System.IO.File]::ReadAllBytes($hbc)
$version = [int]$bytes[8] -bor ([int]$bytes[9] -shl 8) -bor ([int]$bytes[10] -shl 16) -bor ([int]$bytes[11] -shl 24)
Write-Host ("      hbc: {0:N0} bytes, bytecode version {1}" -f $bytes.Length, $version)
if ($version -ne 96) { throw "bytecode version $version does not match the app's runtime (96)" }

$sha1 = [System.Security.Cryptography.SHA1]::Create()
$calc = ($sha1.ComputeHash($bytes[0..($bytes.Length - 21)]) | ForEach-Object { $_.ToString('x2') }) -join ''
$stored = ($bytes[($bytes.Length - 20)..($bytes.Length - 1)] | ForEach-Object { $_.ToString('x2') }) -join ''
Write-Host "      sha1 trailer valid: $($calc -eq $stored)"
if ($calc -ne $stored) { throw 'sha1 trailer mismatch' }

Write-Host "`n[3/3] Publishing to %LOCALAPPDATA%\XboxMod ..." -ForegroundColor Cyan
$modDir = Join-Path $env:LOCALAPPDATA 'XboxMod'
New-Item -ItemType Directory -Path $modDir -Force | Out-Null
$outPath = Join-Path $modDir $OutName
Copy-Item $hbc $outPath -Force

# The installer verifies the bundle it replaces is the one this build targeted,
# so a Store update cannot silently mix an old UI bundle with a new app.
$pkg = Get-AppxPackage Microsoft.GamingApp | Select-Object -First 1
$installed = Join-Path $pkg.InstallLocation 'Bundle\index.bundle'
$sourceHash = $null
if (Test-Path $installed) {
    $sourceHash = (Get-FileHash $installed -Algorithm SHA256).Hash.ToLower()
}

$info = [ordered]@{
    kind          = 'demo-bundle'
    output        = $outPath
    output_sha256 = (Get-FileHash $outPath -Algorithm SHA256).Hash.ToLower()
    source        = $installed
    source_sha256 = $sourceHash
    bytecode      = $version
    js_bytes      = (Get-Item $jsBundle).Length
    hbc_bytes     = $bytes.Length
    built_utc     = (Get-Date).ToUniversalTime().ToString('o')
}
$infoPath = [System.IO.Path]::ChangeExtension($outPath, '.info.json')
$info | ConvertTo-Json | Set-Content -LiteralPath $infoPath -Encoding UTF8

Write-Host "`nready: $outPath" -ForegroundColor Green
Write-Host "info : $infoPath"
Write-Host "`ninstall with:"
Write-Host ('  powershell -ExecutionPolicy Bypass -File "<repo>\tools\xboxapp-mod\style\install-bundle.ps1" -Bundle "' + $outPath + '"')
