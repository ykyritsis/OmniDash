// Quick settings for a handheld: battery, Wi-Fi, volume, brightness and the Windows power plan.
// Windows has no single call for these, so each one is read or set with a short hidden PowerShell script. Every
// part is optional: a desktop has no battery or brightness, and a part that can't be read is simply left out.
const { execFile } = require('node:child_process');

// Windows' master volume, through its Core Audio COM interfaces (the usual interop sketch).
const AUDIO_TYPE = String.raw`
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume { int f(); int g(); int h(); int i(); int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext); int j(); int GetMasterVolumeLevelScalar(out float pfLevel); int k(); int l(); int m(); int n(); int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, System.Guid pguidEventContext); int GetMute(out bool pbMute); }
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref System.Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint); }
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
public class QuickAudio {
  static IAudioEndpointVolume Endpoint() { var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator; IMMDevice device = null; Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out device)); IAudioEndpointVolume volume = null; var id = typeof(IAudioEndpointVolume).GUID; Marshal.ThrowExceptionForHR(device.Activate(ref id, 23, 0, out volume)); return volume; }
  public static float Level { get { float level = -1; Marshal.ThrowExceptionForHR(Endpoint().GetMasterVolumeLevelScalar(out level)); return level; } set { Marshal.ThrowExceptionForHR(Endpoint().SetMasterVolumeLevelScalar(value, System.Guid.Empty)); } }
  public static bool Muted { get { bool muted; Marshal.ThrowExceptionForHR(Endpoint().GetMute(out muted)); return muted; } set { Marshal.ThrowExceptionForHR(Endpoint().SetMute(value, System.Guid.Empty)); } }
}
'@
`;

const READ_SCRIPT = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
$out = @{}
$battery = Get-CimInstance Win32_Battery | Select-Object -First 1
if ($battery) { $out.battery = @{ percent = [int]$battery.EstimatedChargeRemaining; status = [int]$battery.BatteryStatus } }
$brightness = Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness | Select-Object -First 1
if ($brightness) { $out.brightness = [int]$brightness.CurrentBrightness }
$out.wifi = (netsh wlan show interfaces) -join [Environment]::NewLine
$out.plans = (powercfg /list) -join [Environment]::NewLine
VOLUME_PART
$out | ConvertTo-Json -Compress -Depth 4
`;
const VOLUME_READ = String.raw`
try { $out.volume = @{ level = [math]::Round([QuickAudio]::Level * 100); muted = [QuickAudio]::Muted } } catch { }
`;

// netsh output, English Windows: a connected adapter has State, SSID and Signal lines.
function parseWifi(text) {
  const value = key => (String(text || '').match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, 'im')) || [])[1]?.trim() || '';
  const state = value('State').toLowerCase();
  if (!state) return null;
  const signal = Number.parseInt(value('Signal'), 10);
  return { connected: state === 'connected', ssid: value('SSID'), signal: Number.isFinite(signal) ? signal : null };
}
// powercfg /list: "Power Scheme GUID: <guid>  (Name) *" with a star on the active plan.
function parsePlans(text) {
  const plans = [];
  for (const match of String(text || '').matchAll(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\s+\(([^)]+)\)(\s*\*)?/gi)) {
    plans.push({ guid: match[1].toLowerCase(), name: match[2].trim(), active: Boolean(match[3]) });
  }
  return plans;
}
// BatteryStatus: 2 is on AC power; 6 to 9 are the charging states.
function parseBattery(raw) {
  if (!raw || !Number.isFinite(Number(raw.percent))) return null;
  return { percent: Math.max(0, Math.min(100, Number(raw.percent))), charging: [2, 6, 7, 8, 9].includes(Number(raw.status)) };
}

function createQuickSettings({ run = runPowerShell } = {}) {
  const level = value => { const number = Math.round(Number(value)); if (!Number.isFinite(number)) throw new Error('Choose a number from 0 to 100.'); return Math.max(0, Math.min(100, number)); };
  async function get({ volume = true } = {}) {
    const script = (volume ? AUDIO_TYPE : '') + READ_SCRIPT.replace('VOLUME_PART', volume ? VOLUME_READ : '');
    let raw;
    try { raw = JSON.parse(await run(script, 20000)); } catch { raw = {}; }
    return {
      battery: parseBattery(raw.battery),
      wifi: parseWifi(raw.wifi),
      brightness: Number.isFinite(Number(raw.brightness)) ? Number(raw.brightness) : null,
      volume: raw.volume && Number.isFinite(Number(raw.volume.level)) ? { level: Number(raw.volume.level), muted: Boolean(raw.volume.muted) } : null,
      plans: parsePlans(raw.plans)
    };
  }
  async function set(kind, value) {
    if (kind === 'volume') return run(`${AUDIO_TYPE}[QuickAudio]::Level = ${level(value) / 100}; if (${level(value)} -gt 0) { [QuickAudio]::Muted = $false }`, 15000);
    if (kind === 'mute') return run(`${AUDIO_TYPE}[QuickAudio]::Muted = $${value === true ? 'true' : 'false'}`, 15000);
    if (kind === 'brightness') return run(`(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods | Select-Object -First 1) | Invoke-CimMethod -MethodName WmiSetBrightness -Arguments @{ Timeout = 1; Brightness = ${level(value)} } | Out-Null`, 15000);
    if (kind === 'plan') {
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(value))) throw new Error('That power plan is not valid.');
      return run(`powercfg /setactive ${String(value).toLowerCase()}`, 10000);
    }
    throw new Error('Unknown setting.');
  }
  return { get, set };
}

// A hidden PowerShell with the script passed encoded, so nothing in it needs quoting.
function runPowerShell(script, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(script, 'utf16le').toString('base64');
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-EncodedCommand', encoded],
      { windowsHide: true, timeout, maxBuffer: 1024 * 1024 }, (error, stdout) => error ? reject(error) : resolve(String(stdout).trim()));
  });
}

module.exports = { createQuickSettings, parseWifi, parsePlans, parseBattery, runPowerShell, READ_SCRIPT, AUDIO_TYPE };
