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

// Steam's real callback shape (captured read-only from this PC's Steam client).
const { clientDownloadProgress } = require('../src/steam-local.cjs');
const phases = (download, total, staged = 0, stageTotal = 0) => [{}, {}, { bytes_in_progress: download, bytes_total: total, estimated_time_remaining_sec: -1 }, { bytes_in_progress: staged, bytes_total: stageTotal }, {}, {}, {}];
const manifest = { installed: false, state: 'downloading', downloaded: 0, total: 0, percent: 0 };
const pausedItem = { appid: 1721110, active: false, paused: true, completed: false, queue_index: -1, update_type_info: [{ has_update: true, progress: phases(2325825712, 5630004048, 2561720551, 5940063701), overall_percent_complete: 41 }] };
const idle = { update_appid: 0, update_network_bytes_per_second: 0, progress: phases(0, 0), overall_percent_complete: 0, paused: false };
const pausedResult = clientDownloadProgress({ overview: idle, items: [{ remote_client_id: '0', item_data: [{ appid: 730, active: false, paused: false, update_type_info: [{ has_update: false, progress: phases(0, 0) }] }, pausedItem] }] }, 1721110, manifest);
assert.equal(pausedResult.state, 'paused');
assert.equal(pausedResult.percent, 41);
assert.equal(pausedResult.downloaded, 2325825712);
assert.equal(pausedResult.total, 5630004048);
assert.equal(pausedResult.rate, 0);
// The running download: the overview carries live bytes and speed (bytes per second).
const runningOverview = { update_appid: 1721110, update_network_bytes_per_second: 39e6, progress: phases(4166203000, 5630004048, 3000000000, 5940063701), overall_percent_complete: 74, overall_estimated_time_remaining_sec: 38, paused: false };
const liveResult = clientDownloadProgress({ overview: runningOverview, items: [{ item_data: [{ ...pausedItem, active: true, paused: false }] }] }, 1721110, manifest);
assert.equal(liveResult.state, 'downloading');
assert.equal(liveResult.percent, 74);
assert.equal(liveResult.rate, 312e6);
assert.equal(liveResult.secondsLeft, 38);
assert.equal(liveResult.estimated, false);
// Everything paused globally.
assert.equal(clientDownloadProgress({ overview: { ...runningOverview, paused: true }, items: [] }, 1721110, manifest).state, 'paused');
// Download finished, now writing files.
assert.equal(clientDownloadProgress({ overview: { ...runningOverview, progress: phases(5630004048, 5630004048, 100, 5940063701) } }, 1721110, manifest).state, 'installing');
// Queued with nothing measured yet defers to the manifest or log.
assert.equal(clientDownloadProgress({ overview: idle, items: [{ item_data: [{ appid: 42, active: false, paused: false, queue_index: 1, update_type_info: [{ has_update: true, progress: phases(0, 0), overall_percent_complete: 0 }] }] }] }, 42, manifest), null);
assert.equal(clientDownloadProgress({ overview: idle, items: [] }, 7, manifest), null);
console.log('PASS live Steam counters from the real callback shape: paused, running, global pause, staging, queued');
// Steam's global pause: the overview no longer names the game, but the front of the queue is paused.
const globalPause = clientDownloadProgress({ overview: { ...idle, paused: true }, items: [{ item_data: [{ appid: 55, active: false, paused: false, queue_index: 0, update_type_info: [{ has_update: true, progress: phases(500, 1000), overall_percent_complete: 50 }] }] }] }, 55, manifest);
assert.equal(globalPause.state, 'paused');
assert.equal(globalPause.percent, 50);
console.log('PASS global pause marks the front of the queue as paused');
