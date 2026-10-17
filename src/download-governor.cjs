// Pause downloads while a game is running, and bring them back when it ends, the way a console does, so a
// download never eats the bandwidth (or the disk) a game needs.
//
// It only resumes what it paused. If you resume by hand during a game it leaves them running until that
// game closes, and it never resumes downloads you paused yourself.
function createDownloadGovernor({ enabled, gameRunning, downloadsActive, setPaused, log = () => {}, idleMs = 10000, pausedMs = 4000, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let pausedByUs = false;   // we paused downloads for the running game
  let overridden = false;   // you resumed during this game; leave them running until it ends
  let timer = null, stopped = true, ticking = false;

  async function tick() {
    if (ticking) return;
    ticking = true;
    try {
      if (!await enabled()) {
        if (pausedByUs) { await setPaused(false); pausedByUs = false; log('Downloads resumed (setting turned off)'); }
        overridden = false;
        return;
      }
      const running = await gameRunning();
      if (running) {
        if (pausedByUs) {
          // Downloads are going again while the game runs: you resumed them, so leave them alone.
          if (await downloadsActive()) { pausedByUs = false; overridden = true; log('Downloads left running (resumed during the game)'); }
        } else if (!overridden && await downloadsActive()) {
          await setPaused(true);
          pausedByUs = true;
          log('Downloads paused while a game is running');
        }
      } else {
        overridden = false;
        if (pausedByUs) { await setPaused(false); pausedByUs = false; log('Downloads resumed (game closed)'); }
      }
    } catch (error) {
      log(`Download governor: ${error.message}`);
    } finally {
      ticking = false;
    }
  }

  function schedule() {
    if (stopped) return;
    timer = setTimer(async () => { await tick(); schedule(); }, pausedByUs ? pausedMs : idleMs);
    timer?.unref?.();
  }
  return {
    start() { if (!stopped) return; stopped = false; schedule(); },
    stop() { stopped = true; clearTimer(timer); },
    tick,
    // On quit, hand downloads back so they don't stay paused after the launcher is gone.
    async dispose() {
      this.stop();
      if (pausedByUs) { pausedByUs = false; try { await setPaused(false); } catch { /* Steam may already be gone. */ } }
    },
    state: () => ({ pausedByUs, overridden })
  };
}
module.exports = { createDownloadGovernor };
