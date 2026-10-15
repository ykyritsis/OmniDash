# Optional Windows host wrapper for Steam shortcuts whose launcher detaches.
# Publish this script as the host app's command with auto-detach and wait-all off.
# No background service or client-side extension is required.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][ValidatePattern('^[0-9]{1,10}$')][string]$AppId,
    [Parameter(Mandatory = $true)][string]$Executable,
    [ValidateRange(5, 600)][int]$LaunchTimeoutSeconds = 120,
    [ValidateRange(1, 30)][int]$ExitGraceSeconds = 3,
    [switch]$MonitorOnly
)
$ErrorActionPreference = 'Stop'
$gamePath = (Resolve-Path -LiteralPath $Executable).ProviderPath
if ([IO.Path]::GetExtension($gamePath) -ine '.exe') { throw 'Choose the game executable.' }
$gameName = [IO.Path]::GetFileNameWithoutExtension($gamePath)

function Get-GameState {
    $unknown = $false
    foreach ($candidate in @(Get-Process -Name $gameName -ErrorAction SilentlyContinue)) {
        try {
            $candidatePath = $candidate.Path
            if (!$candidatePath) { $unknown = $true; continue }
            if ([string]::Equals($candidatePath, $gamePath, [StringComparison]::OrdinalIgnoreCase)) { return 'running' }
        } catch { $unknown = $true }
    }
    # Access failures are not evidence of an exit. Keep a known session alive.
    if ($unknown) { return 'unknown' }
    return 'closed'
}

$seen = (Get-GameState) -eq 'running'
if (!$seen -and !$MonitorOnly) {
    # Steam remains responsible for DRM, updates and launch options.
    Start-Process -FilePath "steam://rungameid/$AppId" -WindowStyle Hidden
}
$deadline = [DateTime]::UtcNow.AddSeconds($LaunchTimeoutSeconds)
$lastSeen = [DateTime]::UtcNow
while ($true) {
    $gameState = Get-GameState
    if ($gameState -eq 'running' -or ($seen -and $gameState -eq 'unknown')) {
        if (!$seen) { Write-Output 'Game process detected; tracking session.' }
        $seen = $true
        $lastSeen = [DateTime]::UtcNow
    } elseif ($seen -and ([DateTime]::UtcNow - $lastSeen).TotalSeconds -ge $ExitGraceSeconds) {
        Write-Output 'Game closed; host session can end.'
        exit 0
    } elseif (!$seen -and [DateTime]::UtcNow -ge $deadline) {
        Write-Error 'Steam did not start the configured game executable within the launch timeout.'
        exit 1
    }
    Start-Sleep -Milliseconds 500
}
