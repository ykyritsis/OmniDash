// Really cancel a game launch.
//
// Hiding the launch screen is not cancelling: Steam may already be starting the game, a program may already be
// running. This asks Steam to cancel the launch, then keeps checking for a game that is running or about to
// start and closes it, and only reports "stopped" once it has seen nothing running. It says plainly when it
// could not stop something (a store launcher that gives us nothing to close, or a game that will not exit).
function createLaunchStopper({ runningSteamApp, terminateSteamApp, isAlive, killProcessTree, sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), log = () => {}, checks = 14, cleanReads = 3, gapMs = 500, settleMs = 700, killSettleMs = 400 }) {
  const inflight = new Map();

  async function run({ gameId, provider, appId, pid, cancelSteamLaunch }) {
    const result = { stopped: false, wasRunning: false, stillRunning: false, method: 'none' };
    if (provider === 'Steam' && /^\d+$/.test(String(appId))) {
      result.method = 'steam';
      // Steam's own cancel covers the early stages (setup, cloud sync, shader prep).
      try { await cancelSteamLaunch?.(); } catch (error) { log(`Steam launch cancel: ${error.message}`); }
      let clean = 0;
      for (let check = 0; check < checks; check++) {
        const running = String(await runningSteamApp()) === String(appId);
        if (running) {
          // The game started anyway, or was about to: close it, then look again.
          result.wasRunning = true; clean = 0;
          try { await terminateSteamApp(String(appId)); } catch (error) { log(`Closing ${appId}: ${error.message}`); }
          await sleep(settleMs);
          continue;
        }
        // Several clean reads in a row mean nothing is running and nothing is about to.
        if (++clean >= cleanReads) break;
        await sleep(gapMs);
      }
      result.stillRunning = String(await runningSteamApp()) === String(appId);
      result.stopped = !result.stillRunning;
    } else if (pid) {
      result.method = 'process';
      if (isAlive(pid)) {
        result.wasRunning = true;
        try { await killProcessTree(pid); } catch (error) { log(`Closing process ${pid}: ${error.message}`); }
        await sleep(killSettleMs);
      }
      result.stillRunning = isAlive(pid);
      result.stopped = !result.stillRunning;
    } else {
      // A store launcher or shortcut handed the game over; there is no process of ours to close.
      result.method = 'unsupported';
    }
    log(`Launch of ${gameId} cancelled: ${JSON.stringify(result)}`);
    return result;
  }

  return {
    // One stop per game at a time: pressing Cancel twice, or the launch noticing the cancel too, shares the work.
    stop(request) {
      const key = String(request.gameId);
      if (inflight.has(key)) return inflight.get(key);
      const work = run(request).finally(() => setTimeout(() => inflight.delete(key), 1500));
      inflight.set(key, work);
      return work;
    }
  };
}
module.exports = { createLaunchStopper };
