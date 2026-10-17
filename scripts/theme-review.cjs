// Captures the main screens in each console theme (Helix, Series, One) in a hidden demo window.
// Output: .visual-review/themes/<theme>-<screen>.png
const { app } = require('electron');
const fs = require('node:fs/promises'), path = require('node:path');
const output = path.resolve(__dirname, '../.visual-review/themes');
process.env.NEBULA_DEMO = '1'; process.env.NEBULA_REVIEW = '1'; process.env.NEBULA_DEMO_USER_DATA = path.join(output, 'profile');
const themes = (process.env.THEMES || 'helix,series,one').split(',');
const screens = (process.env.SCREENS || 'home,library,detail,settings').split(',');
const SHOW = {
  home: `showView('home')`,
  library: `showView('library')`,
  detail: `(() => { const g = state.games.find(x => !x.isApp && x.installed !== false); openGameDetails(g.id); })()`,
  settings: `settingsDialog.showModal()`,
  apps: `(() => { state.libraryCategory = 'apps'; showView('library'); })()`,
  appearance: `(() => { settingsDialog.showModal(); showSettingsPage('personalization'); })()`,
  launch: `(() => { const g = state.games.find(x => !x.isApp && x.installed !== false); state.selectedGameId = g.id; launchSelectedGame(); })()`,
  boot: `(() => { runStartupSequence({}); })()`,
  toast: `(() => { showToast('Achievement unlocked · 50G · Welcome home'); })()`,
  saver: `(() => { window.gThemeSaver.show(); })()`,
  options: `(() => { openGameOptions(state.games.find(x => !x.isApp).id); })()`,
  store: `showView('store')`,
  halo: `(() => { const t = document.body.dataset.gTheme; localStorage.setItem('g-bg:' + t, 'pack:Halo_4'); gSetTheme('helix'); gSetTheme(t); showView('home'); })()`,
  onboarding: `(() => { onboardingDialog.showModal(); showOnboardingStep(0); })()`,
  // Controller steps on Home, chained in SCREENS (for example home,navR,navR,navU,press).
  navR: `navigateConsoleHome('right', document.activeElement)`, navL: `navigateConsoleHome('left', document.activeElement)`,
  navU: `navigateConsoleHome('up', document.activeElement)`, navD: `navigateConsoleHome('down', document.activeElement)`,
  press: `(() => { const el = document.querySelector('#g-retro .focused, #g-retro-chrome .focused') || document.activeElement; window.__noLaunch = true; if (!el?.dataset?.retroBoot) el?.click(); })()`, back: `navigateBack()`
};
app.on('browser-window-created', (_, win) => {
  const errors = []; win.webContents.on('console-message', e => { if (e.level === 'error') errors.push(e.message.slice(0, 200)); });
  win.webContents.once('did-finish-load', async () => {
    await new Promise(r => setTimeout(r, 6000));
    win.setContentSize(1920, 1080);
    await fs.mkdir(output, { recursive: true });
    if (process.env.DEMO_ART !== '0') await win.webContents.executeJavaScript(await fs.readFile(path.join(__dirname, 'theme-demo-art.js'), 'utf8')).catch(e => errors.push('art: ' + e));
    for (const theme of themes) {
      await win.webContents.executeJavaScript(`(() => { for (const d of document.querySelectorAll('dialog[open]')) d.close(); if (window.gSetTheme) gSetTheme(${JSON.stringify(theme)}); else document.body.dataset.gTheme = ${JSON.stringify(theme)}; })()`).catch(e => errors.push(String(e)));
      for (const [si, screen] of screens.entries()) {
        const show = screen.startsWith('hub-') ? `(() => { showView('home'); window.gHub && gHub.go(${JSON.stringify(screen.slice(4))}); })()` : SHOW[screen];
        await win.webContents.executeJavaScript(`(() => { for (const d of document.querySelectorAll('dialog[open]')) d.close(); ${show}; })()`).catch(e => errors.push(screen + ': ' + e));
        await new Promise(r => setTimeout(r, screen === 'boot' ? 1100 : screen === 'saver' ? 2600 : screen === 'store' ? 6000 : 1800));
        await fs.writeFile(path.join(output, `${theme}-${/^(nav[RLUD]|press|back)$/.test(screen) ? si + "-" : ""}${screen}.png`), (await win.webContents.capturePage()).toPNG());
      }
    }
    await fs.writeFile(path.join(output, 'errors.json'), JSON.stringify(errors, null, 2));
    app.exit(0);
  });
});
require('../src/main.cjs');
