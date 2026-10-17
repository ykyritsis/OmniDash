// Quick settings: the Windows text it reads is parsed correctly, bad input is refused before anything runs,
// a part that can't be read is left out, and the scripts it would run have the right shape. Nothing here
// changes the real machine: the PowerShell runner is replaced by a recorder.
const assert = require('node:assert/strict');
const { createQuickSettings, parseWifi, parsePlans, parseBattery, READ_SCRIPT } = require('../src/quick-settings.cjs');

// Wi-Fi, as netsh prints it.
const connected = ['    Name                   : Wi-Fi', '    State                  : connected', '    SSID                   : Home Network', '    Signal                 : 87%'].join('\r\n');
assert.deepEqual(parseWifi(connected), { connected: true, ssid: 'Home Network', signal: 87 });
assert.deepEqual(parseWifi('    State                  : disconnected'), { connected: false, ssid: '', signal: null });
assert.equal(parseWifi(''), null, 'no adapter means no Wi-Fi row');
assert.equal(parseWifi('There is no wireless interface on the system.'), null);

// Power plans, as powercfg /list prints them, with the active one starred.
const plans = parsePlans(['Existing Power Schemes (* Active)', '-----------------------------------',
  'Power Scheme GUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (Balanced) *', 'Power Scheme GUID: 8C5E7FDA-E8BF-4A96-9A85-A6E23A8C635C  (High performance)',
  'Power Scheme GUID: a1841308-3541-4fab-bc81-f71556f20b4a  (Power saver)'].join('\n'));
assert.equal(plans.length, 3);
assert.deepEqual(plans[0], { guid: '381b4222-f694-41f0-9685-ff5bb260df2e', name: 'Balanced', active: true });
assert.equal(plans[1].guid, '8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c', 'guids are lower-cased');
assert.equal(plans[1].active, false);
assert.deepEqual(parsePlans(''), []);

// Battery: percent is clamped, and AC or charging states count as charging.
assert.deepEqual(parseBattery({ percent: 64, status: 1 }), { percent: 64, charging: false });
assert.deepEqual(parseBattery({ percent: 120, status: 2 }), { percent: 100, charging: true });
assert.deepEqual(parseBattery({ percent: 10, status: 6 }), { percent: 10, charging: true });
assert.equal(parseBattery(null), null, 'a desktop has no battery');
assert.equal(parseBattery({ percent: 'x' }), null);

// Reading: parts that are missing are left out instead of breaking the whole panel.
const reads = [];
const quick = createQuickSettings({ run: async (script) => { reads.push(script); return JSON.stringify({ wifi: connected, plans: 'Power Scheme GUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (Balanced) *', volume: { level: 42, muted: false } }); } });
(async () => {
  const got = await quick.get();
  assert.equal(got.battery, null, 'no battery reported');
  assert.equal(got.brightness, null, 'no brightness reported');
  assert.deepEqual(got.volume, { level: 42, muted: false });
  assert.equal(got.wifi.ssid, 'Home Network');
  assert.equal(got.plans[0].name, 'Balanced');
  assert.match(reads[0], /QuickAudio/, 'volume reading includes the audio helper');
  await createQuickSettings({ run: async script => { reads.push(script); return '{}'; } }).get({ volume: false });
  assert.doesNotMatch(reads[1], /QuickAudio/, 'the audio helper is left out when volume is not wanted');
  assert.match(READ_SCRIPT, /Win32_Battery/);
  const broken = await createQuickSettings({ run: async () => { throw new Error('PowerShell failed'); } }).get();
  assert.deepEqual(broken, { battery: null, wifi: null, brightness: null, volume: null, plans: [] }, 'a failed read gives an empty panel, not an error');

  // Setting: values are checked and clamped before any script is built.
  const ran = [];
  const setter = createQuickSettings({ run: async script => { ran.push(script); return ''; } });
  await setter.set('volume', 150);
  assert.match(ran[0], /Level = 1;/, 'volume is clamped to 100%');
  await setter.set('volume', -5);
  assert.match(ran[1], /Level = 0;/);
  assert.match(ran[1], /if \(0 -gt 0\) \{ \[QuickAudio\]::Muted = \$false \}/, 'unmuting happens only for a volume above zero');
  assert.match(ran[0], /if \(100 -gt 0\) \{ \[QuickAudio\]::Muted = \$false \}/, 'raising the volume unmutes');
  await setter.set('mute', true);
  assert.match(ran[2], /Muted = \$true/);
  await setter.set('brightness', 300);
  assert.match(ran[3], /Brightness = 100/, 'brightness is clamped');
  await setter.set('plan', '8C5E7FDA-E8BF-4A96-9A85-A6E23A8C635C');
  assert.equal(ran[4], 'powercfg /setactive 8c5e7fda-e8bf-4a96-9a85-a6e23a8c635c');
  await assert.rejects(() => setter.set('plan', 'x; calc.exe'), /not valid/, 'a power plan id is never passed through unchecked');
  await assert.rejects(() => setter.set('volume', 'loud'), /0 to 100/);
  await assert.rejects(() => setter.set('wipe', 1), /Unknown setting/);
  assert.equal(ran.length, 5, 'nothing ran for refused input');
  console.log('quick-settings tests passed');
})().catch(error => { console.error(error); process.exit(1); });
