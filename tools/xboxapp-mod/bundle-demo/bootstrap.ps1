# Bootstrap the route A demo outside the repo workspace, then build it.
#
# Why outside: this repo has a pnpm-workspace.yaml at its root, so running
# `pnpm install` in a subfolder installs the whole repo instead of this package.
# The working copy therefore lives in %LOCALAPPDATA%\XboxMod\bundle-demo.
$ErrorActionPreference = 'Stop'

$src = $PSScriptRoot
$work = Join-Path $env:LOCALAPPDATA 'XboxMod\bundle-demo'
New-Item -ItemType Directory -Path $work -Force | Out-Null

Write-Host "source: $src" -ForegroundColor Cyan
Write-Host "work  : $work" -ForegroundColor Cyan

foreach ($f in 'index.js', 'package.json', 'metro.config.js', '.npmrc', 'build.ps1') {
    if (Test-Path (Join-Path $src $f)) {
        Copy-Item (Join-Path $src $f) (Join-Path $work $f) -Force
    }
}

function Resolve-Node {
    $cmd = Get-Command node -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $fallback = Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
    if (Test-Path $fallback) { return $fallback }
    throw 'node.exe not found on PATH'
}

function Resolve-Pnpm {
    $cmd = Get-Command pnpm -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    $fallback = Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs'
    if (Test-Path $fallback) { return $fallback }
    throw 'pnpm not found on PATH'
}

$node = Resolve-Node
$pnpm = Resolve-Pnpm
Write-Host "node  : $node"
Write-Host "pnpm  : $pnpm"

Push-Location $work
try {
    if (-not (Test-Path (Join-Path $work 'node_modules'))) {
        Write-Host "`ninstalling dependencies (react-native 0.76.5 + react-native-windows 0.76.17)..." -ForegroundColor Cyan
        if ($pnpm.EndsWith('.mjs')) {
            & $node $pnpm install
        } else {
            & $pnpm install
        }
    } else {
        Write-Host "`nnode_modules already present" -ForegroundColor Yellow
    }
} finally {
    Pop-Location
}

Write-Host "`nrunning build.ps1..." -ForegroundColor Cyan
& powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $work 'build.ps1')
