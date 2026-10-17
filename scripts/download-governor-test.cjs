// Pause downloads while playing: pauses once when a game starts and downloads are active, resumes when it
// ends, leaves alone anything you paused or resumed yourself, and hands downloads back on quit.
const assert = require('node:assert/strict');
const { createDownloadGovernor } = require('../src/download-governor.cjs');

function rig(options = {}) {
  const world = { enabled: true, running: false, active: false, calls: [] };
  const governor = createDownloadGovernor({
    enabled: async () => world.enabled,
    gameRunning: async () => world.running,
    downloadsActive: async () => world.active,
    setPaused: async paused => { world.calls.push(paused ? 'pause' : 'resume'); world.active = !paused && world.active; if (paused) world.active = false; else if (options.resumeMakesActive) world.active = true; },
    ...options.governor
  });
  return { world, governor };
}

(async () => {
  // Nothing happens while no game runs, and nothing is paused when there are no downloads.
  let { world, governor } = rig();
  world.active = true;
  await governor.tick();
  assert.deepEqual(world.calls, [], 'no game, no change');
  world.running = true; world.active = false;
  await governor.tick();
  assert.deepEqual(world.calls, [], 'nothing to pause');

  // A game starts with a download running: pause once, not on every tick.
  ({ world, governor } = rig({ resumeMakesActive: true }));
  world.active = true; world.running = true;
  await governor.tick(); await governor.tick(); await governor.tick();
  assert.deepEqual(world.calls, ['pause'], 'paused exactly once');
  assert.equal(governor.state().pausedByUs, true);

  // The game closes: downloads come back.
  world.running = false;
  await governor.tick();
  assert.deepEqual(world.calls, ['pause', 'resume']);
  assert.equal(governor.state().pausedByUs, false);
  await governor.tick();
  assert.deepEqual(world.calls, ['pause', 'resume'], 'resumed exactly once');

  // You resumed by hand during the game: leave them running, don't pause again, and don't resume later either.
  ({ world, governor } = rig());
  world.active = true; world.running = true;
  await governor.tick();
  assert.deepEqual(world.calls, ['pause']);
  world.active = true;
  await governor.tick(); await governor.tick();
  assert.deepEqual(world.calls, ['pause'], 'downloads you resumed stay running for the rest of the game');
  assert.equal(governor.state().overridden, true);
  world.running = false;
  await governor.tick();
  assert.deepEqual(world.calls, ['pause'], 'nothing to resume, we no longer hold the pause');
  // The next game starts fresh.
  world.running = true; world.active = true;
  await governor.tick();
  assert.deepEqual(world.calls, ['pause', 'pause']);

  // Downloads you paused yourself are never resumed by the launcher.
  ({ world, governor } = rig());
  world.active = false; world.running = true;
  await governor.tick();
  world.running = false;
  await governor.tick();
  assert.deepEqual(world.calls, []);

  // Turning the setting off while we hold a pause gives the downloads back at once.
  ({ world, governor } = rig());
  world.active = true; world.running = true;
  await governor.tick();
  world.enabled = false;
  await governor.tick();
  assert.deepEqual(world.calls, ['pause', 'resume']);
  world.enabled = true;
  await governor.tick();
  assert.equal(governor.state().pausedByUs, false, 'it does not pause again straight away without active downloads');

  // Quitting hands downloads back.
  ({ world, governor } = rig());
  world.active = true; world.running = true;
  await governor.tick();
  await governor.dispose();
  assert.deepEqual(world.calls, ['pause', 'resume']);

  // A failing Steam call never throws out of the loop, and the next tick tries again.
  let attempts = 0;
  const logs = [];
  governor = createDownloadGovernor({ enabled: async () => true, gameRunning: async () => true, downloadsActive: async () => true, log: line => logs.push(line),
    setPaused: async () => { attempts++; if (attempts === 1) throw new Error('Steam is not ready'); } });
  await governor.tick();
  assert.equal(governor.state().pausedByUs, false, 'a failed pause is not recorded as done');
  await governor.tick();
  assert.equal(governor.state().pausedByUs, true);
  assert.ok(logs.some(line => /Steam is not ready/.test(line)));

  // Scheduling uses the injected timer: slow while idle, quicker while it holds a pause.
  const delays = [];
  ({ world, governor } = rig({ governor: { setTimer: (fn, ms) => { delays.push(ms); return { unref() {} }; }, clearTimer() {}, idleMs: 111, pausedMs: 22 } }));
  governor.start();
  assert.deepEqual(delays, [111]);
  console.log('download-governor tests passed');
})().catch(error => { console.error(error); process.exit(1); });
