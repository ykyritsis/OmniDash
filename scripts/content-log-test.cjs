const assert = require('node:assert/strict');
const { contentLogProgress } = require('../src/steam-local.cjs');
const at = (h, m, s) => new Date(2026, 9, 12, h, m, s).getTime();

// A download running at 400 Mbps for 60 seconds from a resumed 1 GB of 10 GB.
const running = `[2026-10-12 21:29:00] Current download rate: 400.000 Mbps
[2026-10-12 21:30:00] AppID 42 update started : download 1000000000/10000000000, store 0/0, reuse 0/0, delta 0/0, stage 0/11000000000
[2026-10-12 21:30:00] AppID 42 App update changed : Running Update,Downloading,Staging,
[2026-10-12 21:30:30] Increasing target number of download connections to 10 (rate was 400.000, now 800.000)`;
const live = contentLogProgress(running, 42, at(21, 31, 0));
// 30 s at 400 Mbps (1.5 GB) + 30 s at 800 Mbps (3 GB) on top of 1 GB.
assert.equal(live.state, 'downloading');
assert.equal(live.downloaded, 5.5e9);
assert.equal(live.percent, 55);
assert.equal(live.rate, 800e6);
assert.equal(live.estimated, true);

// Paused (suspended) stops the clock.
const paused = `${running}
[2026-10-12 21:31:00] AppID 42 update canceled : Disabled (Suspended)
[2026-10-12 21:31:00] AppID 42 App update changed : Running Update,Downloading,Staging,Stopping,
[2026-10-12 21:31:01] AppID 42 App update changed : None`;
const stopped = contentLogProgress(paused, 42, at(21, 40, 0));
assert.equal(stopped.state, 'paused');
assert.equal(stopped.downloaded, 5.5e9);
assert.equal(stopped.rate, 0);

// The real log from this PC: started, cancelled, uninstalled, so there's nothing to show.
const real = `[2026-10-12 21:30:43] AppID 1721110 update started : download 0/5630004048, store 0/0, reuse 0/0, delta 0/0, stage 0/5940063701
[2026-10-12 21:30:43] AppID 1721110 App update changed : Running Update,Downloading,Staging,
[2026-10-12 21:30:55] Increasing target number of download connections to 9 (rate was 0.000, now 427.868)
[2026-10-12 21:31:39] AppID 1721110 update canceled : Disabled (Suspended)
[2026-10-12 21:31:42] AppID 1721110 state changed : Uninstalled,
[2026-10-12 21:31:42] AppID 1721110 finished uninstall (No Error)`;
assert.equal(contentLogProgress(real, 1721110, at(21, 35, 0)), null);
// Mid-way through that same download it would have read about 46%.
const midway = contentLogProgress(real.split('\n').slice(0, 3).join('\n'), 1721110, at(21, 31, 39));
assert.equal(midway.state, 'downloading');
assert.ok(midway.percent >= 40 && midway.percent <= 50, String(midway.percent));
assert.equal(contentLogProgress(running, 7, at(21, 31, 0)), null);
assert.equal(contentLogProgress(running, '../1', at(21, 31, 0)), null);
// Global transfer rates must stop accruing to this app when Steam switches games.
const switched = `${running}\n[2026-10-12 21:31:00] AppID 7 App update changed : Running Update,Downloading,Staging,\n[2026-10-12 21:31:30] Current download rate: 800.000 Mbps`;
assert.equal(contentLogProgress(switched, 42, at(21, 32, 0)).downloaded, 5.5e9);
assert.equal(contentLogProgress(switched, 42, at(21, 32, 0)).state, 'queued');
const stale = contentLogProgress(running, 42, at(23, 0, 0));
assert.equal(stale.rate, 0);
assert.equal(stale.state, 'queued');
console.log('content log progress ok');

const { clientDownloadProgress } = require('../src/steam-local.cjs');
const manifest = { installed: false, state: 'downloading', downloaded: 0, total: 1000, percent: 0 };
const overview = { update_appid: 42, update_bytes_downloaded: 740, update_bytes_to_download: 1000, update_network_bytes_per_second: 10, update_seconds_remaining: 26 };
const exact = clientDownloadProgress({ overview, items: [{ appid: 42, downloaded_bytes: 0, total_bytes: 1000 }] }, 42, manifest);
assert.equal(exact.percent, 74);
assert.equal(exact.rate, 80);
assert.equal(exact.estimated, false);
assert.equal(clientDownloadProgress({ overview }, 42, manifest).percent, 74);
assert.equal(clientDownloadProgress({ overview: { ...overview, paused: true } }, 42, manifest).rate, 0);
assert.equal(clientDownloadProgress({ overview: { ...overview, update_bytes_downloaded: 1000 } }, 42, manifest).installed, false);
assert.equal(clientDownloadProgress({ items: [{ appid: 42 }] }, 42, manifest), null);
assert.equal(clientDownloadProgress({ overview }, 7, manifest), null);
console.log('PASS live Steam counters override stale 0% manifests, partial callbacks, pause and staging');
