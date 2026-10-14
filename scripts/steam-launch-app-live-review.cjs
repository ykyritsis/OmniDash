// Opt-in live integration check. Uses a separate profile and only launches AW Exo.
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
if (!process.argv.includes('--start')) throw new Error('Pass --start only with permission to launch Advanced Warfare.');
const output = path.resolve(__dirname, '../.visual-review/steam-launch-app-live');
fs.mkdirSync(path.join(output, 'profile'), { recursive: true });
fs.writeFileSync(path.join(output, 'profile/settings.json'), JSON.stringify({ onboardingComplete: true, fullscreen: false, startupAnimation: false }));
process.env.NEBULA_REVIEW = '1';
delete process.env.NEBULA_DEMO;
app.setPath('userData', path.join(output, 'profile'));
app.disableHardwareAcceleration();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.on('browser-window-created', (_, win) => {
  const trace = [];
  const send = win.webContents.send.bind(win.webContents);
  win.webContents.send = (channel, data, ...args) => { if (channel === 'launch:status') trace.push(data); return send(channel, data, ...args); };
  win.webContents.once('did-finish-load', async () => {
    const report = { trace };
    const run = code => win.webContents.executeJavaScript(code);
    try {
      await pause(3000);
      await run('scanLibrary(false)');
      report.game = await run(`state.games.find(g => String(g.appId) === '209660')`);
      assert.ok(report.game?.installed !== false && report.game?.id, 'Advanced Warfare must be installed');
      await run(`for(const d of document.querySelectorAll('dialog[open]'))d.close(); document.querySelector('#startup-screen').hidden=true; state.selectedGameId=${JSON.stringify(report.game.id)}; launchSelectedGame(); true`);
      for (let count = 0; count < 100 && !await run('steamLaunchUI.isOpen()'); count++) await pause(200);
      report.choices = await run(`[...document.querySelectorAll('#steam-game-launch-dialog .steam-launch-choices button')].map(b=>b.textContent)`);
      assert.ok(report.choices.some(label => label.includes('Exo Zombies')));
      fs.writeFileSync(path.join(output, 'advanced-warfare-modes.png'), (await win.webContents.capturePage()).toPNG());
      await run(`document.querySelector('#steam-game-launch-dialog [data-choice="1"]').click(); true`);
      for (let count = 0; count < 120 && !await run('launchOverlay.hidden'); count++) await pause(500);
      report.overlayClosed = await run('launchOverlay.hidden');
      report.active = await run('window.launcher.getActiveGameSession()');
      assert.equal(report.overlayClosed, true);
      assert.equal(report.active?.gameId, report.game.id);
      assert.equal(report.active?.verified, true);
      assert.ok(trace.some(event => event.text === 'Game ready'));
      report.ok = true;
      fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(report, null, 2));
      app.exit(0);
    } catch (error) {
      await run('cancelLaunchWait(); true').catch(() => {});
      fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify({ ...report, error: error.stack }, null, 2));
      app.exit(1);
    }
  });
});
require('../src/main.cjs');
