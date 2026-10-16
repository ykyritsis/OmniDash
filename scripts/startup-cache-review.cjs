// Uses a separate demo profile to verify that cached games appear before a slow scan.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const output = path.resolve(__dirname, '../.visual-review');
// A fresh profile also keeps short test runs out of the crash-recovery counter.
const profile = path.join(output, `cache-profile-${Date.now()}-${process.pid}`);
process.env.NEBULA_DEMO = '1';
process.env.NEBULA_REVIEW = '1';
process.env.NEBULA_REVIEW_SCAN_DELAY = '2400';
process.env.NEBULA_DEMO_USER_DATA = profile;
fs.mkdirSync(profile, { recursive: true });
const imageDirectory = path.join(profile, 'artwork-cache');
fs.mkdirSync(imageDirectory, { recursive: true });
const imagePath = path.join(imageDirectory, 'fixture.png');
fs.writeFileSync(imagePath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9xnl8AAAAASUVORK5CYII=', 'base64'));
fs.writeFileSync(path.join(profile, 'settings.json'), JSON.stringify({ onboardingComplete: true, fullscreen: false }));
fs.writeFileSync(path.join(profile, 'library-snapshot.json'), JSON.stringify({
  version: 1,
  // Fresh snapshots intentionally defer scanning for 15 minutes. Exercise the
  // stale-snapshot path, which refreshes quietly four seconds after startup.
  savedAt: Date.now() - 16 * 60 * 1000,
  summary: { steamStatus: 'disabled', epicStatus: 'needs-helper' },
  games: [{ id: 'cached-fixture', title: 'Cached Preview Game', provider: 'PC', installed: true, executable: process.execPath, artwork: { tile: pathToFileURL(imagePath).href, tileIsSquare: true } }]
}));
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.on('browser-window-created', (_, window) => {
  window.webContents.once('did-finish-load', async () => {
    try {
      const run = script => window.webContents.executeJavaScript(script);
      let cached = false;
      for (let attempt = 0; attempt < 30; attempt++) {
        cached = await run("state.games.some(game => game.id === 'cached-fixture')");
        if (cached) break;
        await pause(50);
      }
      if (!cached) throw Error('Saved library did not appear promptly');
      if (await run('state.fullScreenImport')) throw Error('Cached Home was blocked by full-screen import');
      let startup;
      for (let attempt = 0; attempt < 100; attempt++) {
        startup = await run("({cached:state.games.some(game=>game.id==='cached-fixture'),fullScreen:state.fullScreenImport,background:scanProgress.classList.contains('background-refresh'),visible:!scanProgress.hidden})");
        if (startup.background && startup.visible) break;
        await pause(50);
      }
      if (!startup.cached || startup.fullScreen || !startup.background || !startup.visible) throw Error(`Refresh blocked cached Home: ${JSON.stringify(startup)}`);
      const imageLoaded = await run("(() => { const image = document.querySelector('.game-card[data-game-id=\"cached-fixture\"] img'); return Boolean(image?.complete && image.naturalWidth > 0); })()");
      if (!imageLoaded) throw Error('Cached file artwork was not displayed by the renderer');
      await run("setFocusedElement(document.querySelector('.game-card[data-game-id=\"cached-fixture\"]'), {scroll:false})");
      await fs.promises.writeFile(path.join(output, 'cached-startup.png'), (await window.webContents.capturePage()).toPNG());
      let refreshed = false;
      for (let attempt = 0; attempt < 200; attempt++) {
        refreshed = await run("state.games.some(game=>game.id==='demo-1') && !state.games.some(game=>game.id==='cached-fixture')");
        if (refreshed) break;
        await pause(100);
      }
      if (!refreshed) throw Error('Background refresh did not replace the cached library');
      const focusRestored = await run("document.activeElement?.classList.contains('focusable') && document.activeElement.isConnected && state.focusedElement === document.activeElement");
      if (!focusRestored) throw Error('Controller focus was lost during the background refresh');
      const saved = JSON.parse(fs.readFileSync(path.join(profile, 'library-snapshot.json'), 'utf8'));
      if (!saved.games.some(game => game.id === 'demo-1')) throw Error('Fresh library was not saved for next launch');
      await run('window.launcher.resetLauncherData()');
      if (fs.existsSync(path.join(profile, 'library-snapshot.json'))) throw Error('Reset did not remove the cached library');
      if (fs.existsSync(imageDirectory)) throw Error('Reset did not remove the artwork cache');
      console.log('PASS: cached Home before scan, background refresh, focus retention, disk persistence, and reset');
      app.exit(0);
    } catch (error) { console.error(error); app.exit(1); }
  });
});
require('../src/main.cjs');
