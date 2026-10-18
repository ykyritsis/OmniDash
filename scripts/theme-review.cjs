// Captures the main screens in each console theme (Helix, Series, One) in a hidden demo window.
// Output: .visual-review/themes/<theme>-<screen>.png
const { app } = require('electron');
const fs = require('node:fs/promises'), path = require('node:path');
const output = path.resolve(__dirname, '../.visual-review/themes');
process.env.NEBULA_DEMO = '1'; process.env.NEBULA_REVIEW = '1'; process.env.NEBULA_DEMO_USER_DATA = path.join(output, 'profile');
const themes = (process.env.THEMES || 'helix,series,one').split(',');
const screens = (process.env.SCREENS || 'home,library,detail,settings').split(',');
// The owner's display is 2560x1440 at 150%, so the page lays out at 1706x960 CSS pixels; REVIEW_SIZE matches that.
const [viewWidth, viewHeight] = (process.env.REVIEW_SIZE || '1920,1080').split(',').map(Number);
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
  // The console on-screen keyboard, opened on a throwaway field.
  keyboard: `(() => { showView('home'); let f = document.querySelector('#review-osk-field'); if (!f) { f = document.createElement('input'); f.id = 'review-osk-field'; f.type = 'text'; document.body.append(f); } f.value = 'Forza'; openNativeKeyboard(f); })()`,
  // A library the size of a real one, for paging and long lists.
  manygames: `(() => { if (state.__many) return; state.__many = true; const base = state.games.filter(g => !g.isApp); for (let i = 0; i < 9; i++) for (const g of base.slice(0, 6)) state.games.push({ ...g, id: g.id + '-x' + i, title: g.title + ' ' + (i + 2), installed: true }); renderRecentGames(); renderLibrary(); })()`,
  // Switch theme the way the picker does, then close the dialog a moment later: the real switch path.
  switchps3: `(() => { settingsDialog.showModal(); showSettingsPage('personalization'); document.querySelector('[data-g-theme-pick="ps3"]').click(); setTimeout(() => { for (const d of document.querySelectorAll('dialog[open]')) d.close(); }, 1200); })()`,
  switchwii: `(() => { settingsDialog.showModal(); showSettingsPage('personalization'); document.querySelector('[data-g-theme-pick="wii"]').click(); setTimeout(() => { for (const d of document.querySelectorAll('dialog[open]')) d.close(); }, 1200); })()`,
  // The same pick followed by the controller's Back, which is how the dialog actually closes.
  switchback: `(() => { settingsDialog.showModal(); showSettingsPage('personalization'); document.querySelector('[data-g-theme-pick="ps3"]').click(); setTimeout(() => { navigateBack(); console.error('after back dialog=' + Boolean(document.querySelector('dialog[open]')) + ' view=' + state.view + ' focus=' + document.activeElement?.className?.slice(0, 30)); }, 1200); })()`,
  probe: `(() => { const on = document.querySelector('#g-retro .xmb-item.on'); console.error(JSON.stringify({ view: state.view, theme: document.body.dataset.gTheme, index: on?.dataset.xmbIndex, focused: document.activeElement?.className?.slice(0, 40), items: document.querySelectorAll('#g-retro .xmb-item').length, w: innerWidth, h: innerHeight })); })()`,
  // Controller steps on Home, chained in SCREENS (for example home,navR,navR,navU,press).
  navR: `navigateConsoleHome('right', document.activeElement)`, navL: `navigateConsoleHome('left', document.activeElement)`,
  navU: `navigateConsoleHome('up', document.activeElement)`, navD: `navigateConsoleHome('down', document.activeElement)`,
  press: `(() => { const el = document.querySelector('#g-retro .focused, #g-retro-chrome .focused') || document.activeElement; window.__noLaunch = true; if (!el?.dataset?.retroBoot) el?.click(); })()`,
  back: `navigateBack()`,
  // PS5 surfaces (the screens are opened through the theme's real API, never by force-showing markup).
  ps5hub: `(() => { const g = state.games.find(x => !x.isApp && x.installed !== false); window.gPs5?.openHub(g.id); })()`,
  ps5cc: `(() => { window.gPs5?.openControlCenter(); })()`,
  ps5trophies: `(() => { const g = state.games.find(x => !x.isApp && x.installed !== false); window.gPs5?.openTrophies(g.id); })()`,
  ps5captures: `(() => { window.gPs5?.openCaptures(); })()`,
  ps5settings: `(() => { window.gShell?.open('ps5'); })()`
};
app.on('browser-window-created', (_, win) => {
  const errors = []; win.webContents.on('console-message', e => { if (e.level === 'error') errors.push(e.message.slice(0, 200)); });
  win.webContents.once('did-finish-load', async () => {
    // The demo library import lands a few seconds in and replaces the game list, so paint the stand-in
    // artwork after it rather than before, or covers come out blank. Wait for the import to finish (the
    // importing screen closing) instead of guessing a delay, then a moment for the first render.
    await new Promise(r => setTimeout(r, Number(process.env.SETTLE_MS || 3000)));
    for (let i = 0; i < 80; i++) {
      const ready = await win.webContents.executeJavaScript(`(() => { const s = document.querySelector('#importing-screen'); return Boolean(state.libraryInitialShown) || (state.games.length > 0 && (!s || s.hidden || !s.classList.contains('visible'))); })()`).catch(() => true);
      if (ready) break;
      await new Promise(r => setTimeout(r, 500));
    }
    win.setContentSize(viewWidth, viewHeight);
    await new Promise(r => setTimeout(r, 700));
    await fs.mkdir(output, { recursive: true });
    const demoArt = process.env.DEMO_ART === '0' ? '' : await fs.readFile(path.join(__dirname, 'theme-demo-art.js'), 'utf8');
    for (const theme of themes) {
      await win.webContents.executeJavaScript(`(() => { for (const d of document.querySelectorAll('dialog[open]')) d.close(); if (window.gSetTheme) gSetTheme(${JSON.stringify(theme)}); else document.body.dataset.gTheme = ${JSON.stringify(theme)}; })()`).catch(e => errors.push(String(e)));
      // Paint the stand-in artwork for this theme: the demo library can replace the game list (and with it
      // the artwork) at any point, so do it per theme rather than once at start-up.
      if (demoArt) await win.webContents.executeJavaScript(demoArt).catch(e => errors.push('art: ' + e));
      for (const [si, screen] of screens.entries()) {
        // hub-<id> opens a pivot hub; page-<settings page id> opens Settings on that page.
        const show = screen.startsWith('hub-') ? `(() => { showView('home'); window.gHub && gHub.go(${JSON.stringify(screen.slice(4))}); })()`
          : screen.startsWith('page-') ? `(() => { settingsDialog.showModal(); showSettingsPage(${JSON.stringify(screen.slice(5))}); })()`
          : SHOW[screen];
        await win.webContents.executeJavaScript(`(() => { for (const d of document.querySelectorAll('dialog[open]')) d.close(); ${show || `showView('home')`}; })()`).catch(e => errors.push(screen + ': ' + e));
        await new Promise(r => setTimeout(r, screen === 'boot' ? 1100 : screen === 'saver' ? 2600 : screen === 'store' ? 6000 : 1800));
        await fs.writeFile(path.join(output, `${theme}-${/^(nav[RLUD]|press|back)$/.test(screen) ? si + "-" : ""}${screen}.png`), (await win.webContents.capturePage()).toPNG());
      }
    }
    await fs.writeFile(path.join(output, 'errors.json'), JSON.stringify(errors, null, 2));
    app.exit(0);
  });
});
require('../src/main.cjs');
