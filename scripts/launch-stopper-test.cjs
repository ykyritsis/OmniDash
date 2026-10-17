// Cancelling a launch for real: nothing running means nothing is closed; a game that is running or starts
// late is closed and confirmed gone; a game that will not exit is reported honestly; direct programs are killed
// as a tree; store launchers say they can't be stopped; and two cancels share one stop.
const assert = require('node:assert/strict');
const { createLaunchStopper } = require('../src/launch-stopper.cjs');

const noWait = () => Promise.resolve();
function rig({ running = [], alive = [], terminateKillsAt = 0 } = {}) {
  const calls = { cancel: 0, terminate: 0, kill: 0, reads: 0, log: [] };
  const script = [...running];
  const aliveScript = [...alive];
  let dead = false;
  const stopper = createLaunchStopper({
    runningSteamApp: async () => { calls.reads++; return script.length ? script.shift() : (terminateKillsAt && calls.terminate >= terminateKillsAt ? '0' : script.last ?? '0'); },
    terminateSteamApp: async () => { calls.terminate++; },
    isAlive: () => dead ? false : (aliveScript.length ? aliveScript.shift() : false),
    killProcessTree: async () => { calls.kill++; dead = true; },
    sleep: noWait, log: line => calls.log.push(line)
  });
  return { stopper, calls };
}
const steamGame = { gameId: 'steam-1', provider: 'Steam', appId: '1551360' };

(async () => {
  // Nothing was running: Steam's cancel is called, nothing is closed, three clean reads confirm it.
  let { stopper, calls } = rig({ running: ['0', '0', '0', '0'] });
  let result = await stopper.stop({ ...steamGame, cancelSteamLaunch: async () => { calls.cancel++; } });
  assert.deepEqual(result, { stopped: true, wasRunning: false, stillRunning: false, method: 'steam' });
  assert.equal(calls.cancel, 1);
  assert.equal(calls.terminate, 0, 'nothing running, nothing closed');

  // The game was already running: it is closed, and the stop is confirmed by clean reads afterwards.
  ({ stopper, calls } = rig({ running: ['1551360', '0', '0', '0', '0'] }));
  result = await stopper.stop({ ...steamGame, cancelSteamLaunch: async () => {} });
  assert.equal(result.wasRunning, true);
  assert.equal(result.stopped, true);
  assert.equal(calls.terminate, 1);

  // The game starts late, after two clean reads: still caught.
  ({ stopper, calls } = rig({ running: ['0', '0', '1551360', '0', '0', '0', '0'] }));
  result = await stopper.stop({ ...steamGame, gameId: 'steam-2', cancelSteamLaunch: async () => {} });
  assert.equal(result.stopped, true);
  assert.equal(calls.terminate, 0 + 1, 'a late start is closed too');

  // A different game running in Steam is not ours to close.
  ({ stopper, calls } = rig({ running: ['730', '730', '730', '730'] }));
  result = await stopper.stop({ ...steamGame, gameId: 'steam-3', cancelSteamLaunch: async () => {} });
  assert.equal(calls.terminate, 0, 'another game is left alone');
  assert.equal(result.stopped, true);

  // A game that will not exit: terminate is retried a bounded number of times, then it is reported as still running.
  const stubborn = [];
  for (let i = 0; i < 60; i++) stubborn.push('1551360');
  ({ stopper, calls } = rig({ running: stubborn }));
  result = await stopper.stop({ ...steamGame, gameId: 'steam-4', cancelSteamLaunch: async () => {} });
  assert.equal(result.stillRunning, true);
  assert.equal(result.stopped, false);
  assert.ok(calls.terminate >= 3 && calls.terminate <= 14, `terminate attempts are bounded (${calls.terminate})`);

  // Steam's own cancel failing does not stop the rest from running.
  ({ stopper, calls } = rig({ running: ['0', '0', '0', '0'] }));
  result = await stopper.stop({ ...steamGame, gameId: 'steam-5', cancelSteamLaunch: async () => { throw new Error('Steam is not ready'); } });
  assert.equal(result.stopped, true);
  assert.ok(calls.log.some(line => /Steam is not ready/.test(line)));

  // A program the launcher started: killed as a tree, then confirmed gone.
  ({ stopper, calls } = rig({ alive: [true] }));
  result = await stopper.stop({ gameId: 'exe-1', provider: 'PC', pid: 4242 });
  assert.deepEqual(result, { stopped: true, wasRunning: true, stillRunning: false, method: 'process' });
  assert.equal(calls.kill, 1);
  // Already gone: nothing is killed.
  ({ stopper, calls } = rig({ alive: [false] }));
  result = await stopper.stop({ gameId: 'exe-2', provider: 'PC', pid: 4243 });
  assert.equal(result.stopped, true);
  assert.equal(calls.kill, 0);

  // A store launcher or shortcut gives us nothing to close: say so instead of claiming success.
  ({ stopper } = rig());
  result = await stopper.stop({ gameId: 'epic-1', provider: 'Epic Games', appId: '' });
  assert.deepEqual(result, { stopped: false, wasRunning: false, stillRunning: false, method: 'unsupported' });

  // Two cancels share one stop.
  ({ stopper, calls } = rig({ running: ['0', '0', '0', '0'] }));
  const request = { ...steamGame, gameId: 'steam-6', cancelSteamLaunch: async () => { calls.cancel++; } };
  const [first, second] = await Promise.all([stopper.stop(request), stopper.stop(request)]);
  assert.equal(first, second, 'the same stop is returned');
  assert.equal(calls.cancel, 1, 'Steam is asked to cancel once');
  console.log('launch-stopper tests passed');
})().catch(error => { console.error(error); process.exit(1); });
