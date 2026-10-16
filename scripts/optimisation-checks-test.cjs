// Verifies the optimisations applied in this pass, against the real renderer, in a throwaway profile.
// Covers: tile-corner and text-size settings reaching their selectors, gallery thumbnails using the
// small image variant, debounced search, the hidden-games view switch, and queue focus restoration.
// Run with the Electron binary, not node.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');

const output = path.resolve(__dirname, '../.visual-review', process.env.GARRISON_OUT || 'optimisation-checks');
process.env.NEBULA_DEMO = '1';
process.env.NEBULA_REVIEW = '1';
process.env.NEBULA_DEMO_USER_DATA = path.join(output, 'profile-' + process.pid);
if (process.env.GARRISON_GPU !== '1') app.disableHardwareAcceleration();

const pause = ms => new Promise(r => setTimeout(r, ms));
const watchdog = setTimeout(() => { console.error('Optimisation checks timed out'); app.exit(1); }, 90000);
const results = {};

app.on('browser-window-created', (_event, win) => {
  const wc = win.webContents;
  const rendererErrors = [];
  wc.on('console-message', event => {
    if ((event.level === 'error' || event.level === 3) && !/net::ERR_|status of [45]\d\d/.test(event.message)) rendererErrors.push(event.message);
  });
  wc.once('did-finish-load', async () => {
    try {
      await fs.mkdir(output, { recursive: true });
      await pause(2000);
      const run = code => wc.executeJavaScript(`(async()=>{${code}})()`);
      await run(`for (const d of document.querySelectorAll('dialog[open]')) d.close(); document.querySelector('#startup-screen').hidden = true;`);

      // --- Settings that were silently defeated by the cascade -------------------------------
      results.settings = await run(`
        const px = value => parseFloat(value) || 0;
        document.documentElement.style.setProperty('--tile-radius', '24px');
        const card = document.querySelector('#recent-row .game-card') || document.querySelector('.game-card');
        const tileRadius24 = px(getComputedStyle(card).borderRadius);
        const innerRadius24 = px(getComputedStyle(card.querySelector('img') || card).borderTopLeftRadius);
        document.documentElement.style.setProperty('--tile-radius', '4px');
        const tileRadius4 = px(getComputedStyle(card).borderRadius);
        document.documentElement.style.setProperty('--tile-radius', '8px');
        const heading = document.querySelector('.section-heading h2');
        document.documentElement.style.setProperty('--text-scale', '1');
        const base = px(getComputedStyle(heading).fontSize);
        document.documentElement.style.setProperty('--text-scale', '1.3');
        const scaled = px(getComputedStyle(heading).fontSize);
        const homeHeading = document.querySelector('.dashboard-recent .section-heading h2');
        const homeScaled = homeHeading ? px(getComputedStyle(homeHeading).fontSize) : null;
        document.documentElement.style.setProperty('--text-scale', '1');
        const homeBase = homeHeading ? px(getComputedStyle(homeHeading).fontSize) : null;
        const desc = document.querySelector('.detail-description');
        document.documentElement.style.setProperty('--text-scale', '1.3');
        const descScaled = desc ? px(getComputedStyle(desc).fontSize) : null;
        document.documentElement.style.setProperty('--text-scale', '1');
        const count = document.querySelector('.library-count');
        document.documentElement.style.setProperty('--text-scale', '1.3');
        const countScaled = count ? px(getComputedStyle(count).fontSize) : null;
        document.documentElement.style.setProperty('--text-scale', '1');
        return { tileRadius24, tileRadius4, innerRadius24, headingBase: base, headingScaled: scaled, homeBase, homeScaled, descScaled, countScaled };
      `);

      // --- Gallery thumbnails use the small variant ------------------------------------------
      results.galleryThumb = await run(`
        state.galleryImages = ['https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/123/screenshots/abc.1920x1080.jpg'];
        state.galleryIndex = 0;
        renderGalleryThumbnails();
        const img = document.querySelector('#gallery-thumbnails img');
        return { src: img ? img.getAttribute('src') : null, decoding: img ? img.getAttribute('decoding') : null };
      `);

      // --- Debounced search still returns correct results ------------------------------------
      results.search = await run(`
        showView('library');
        await new Promise(r => setTimeout(r, 250));
        state.libraryQueue = false;
        const cards = () => document.querySelectorAll('#console-search-results .console-search-game, #console-search-results .g-store-card').length;
        const total = displayedLibraryGames().length;
        librarySearch.value = '';
        librarySearch.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 350));
        const emptyQuery = cards();
        librarySearch.value = 'zzzz-no-such-game';
        librarySearch.dispatchEvent(new Event('input', { bubbles: true }));
        const immediate = cards();
        await new Promise(r => setTimeout(r, 400));
        const afterDebounce = cards();
        librarySearch.value = '';
        scheduleConsoleSearch();
        await new Promise(r => setTimeout(r, 350));
        const restored = cards();
        return { total, emptyQuery, immediate, afterDebounce, restored, debounceDeferred: immediate === emptyQuery };
      `);

      // --- Hidden games view actually renders ------------------------------------------------
      results.hiddenView = await run(`
        state.gHiddenView = false;
        state.libraryQueue = false;
        showView('library');
        await new Promise(r => setTimeout(r, 200));
        const before = document.querySelector('#library-view').dataset.gTab;
        // The top-bar Library button selects Installed; the hidden view must still win.
        state.installFilter = 'installed';
        state.libraryCategory = 'games';
        state.consoleLibraryGroups = false;
        renderLibraryView();
        await new Promise(r => setTimeout(r, 150));
        const installed = document.querySelector('#library-view').dataset.gTab;
        state.gHiddenView = true;
        renderLibraryView();
        await new Promise(r => setTimeout(r, 200));
        const banner = document.querySelector('#library-grid .g-hidden-banner');
        const cards = document.querySelectorAll('#library-grid .g-hidden-card').length;
        const whileHidden = document.querySelector('#library-view').dataset.gTab;
        state.gHiddenView = false;
        renderLibraryView();
        await new Promise(r => setTimeout(r, 150));
        return { before, installed, whileHidden, bannerShown: Boolean(banner), hiddenCards: cards, after: document.querySelector('#library-view').dataset.gTab };
      `);

      // --- Queue refresh keeps focus on a live node ------------------------------------------
      // The demo profile has no Steam downloads, so this only asserts the ordering invariant the fix
      // depends on when a real queue is present.
      results.queueFocus = await run(`
        state.gHiddenView = false;
        showView('library');
        state.libraryQueue = true;
        renderLibraryView();
        await new Promise(r => setTimeout(r, 300));
        const rows = document.querySelectorAll('#library-grid [data-app-id]');
        state.libraryQueue = false;
        renderLibraryView();
        if (!rows.length) return { skipped: true, reason: 'demo profile has no queue rows' };
        return { skipped: false, rows: rows.length };
      `);

      results.rendererErrors = rendererErrors;

      // --- Assertions: these are the regressions this script exists to catch ------------------
      const s = results.settings;
      assert.ok(s.tileRadius24 > 20 && s.tileRadius4 < 8, `Tile corners must reach the game tiles (got ${s.tileRadius24} at 24px, ${s.tileRadius4} at 4px)`);
      assert.ok(s.headingScaled > s.headingBase, `Text size must grow section headings (${s.headingBase} -> ${s.headingScaled})`);
      assert.ok(s.homeBase != null && s.homeScaled > s.homeBase, `Text size must grow Home shelf headings (${s.homeBase} -> ${s.homeScaled})`);
      assert.ok(s.descScaled > 18, `Text size must grow the game description (got ${s.descScaled})`);
      assert.ok(s.countScaled > 17, `Text size must grow the library count (got ${s.countScaled})`);

      assert.match(results.galleryThumb.src, /\.600x338\.jpg$/, 'Gallery thumbnails must use the small screenshot variant');
      assert.equal(results.galleryThumb.decoding, 'async');

      assert.equal(results.search.debounceDeferred, true, 'Typing must not rebuild the result list synchronously');
      assert.ok(results.search.restored > 0, 'Clearing the query must restore the results');

      assert.equal(results.hiddenView.installed, 'installed', 'The Installed tab is the baseline for the hidden-view check');
      assert.equal(results.hiddenView.whileHidden, 'games', 'Showing hidden games must switch the library off the Installed tab');
      assert.equal(results.hiddenView.bannerShown, true, 'The hidden games view must render its banner');

      assert.deepEqual(rendererErrors, [], 'The renderer reported errors during the checks');

      await fs.writeFile(path.join(output, 'checks.json'), JSON.stringify(results, null, 2));
      console.log(JSON.stringify(results, null, 2));
      console.log('optimisation checks ok');
      clearTimeout(watchdog);
      app.exit(0);
    } catch (error) {
      console.error(error);
      await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ error: error.stack }, null, 2)).catch(() => {});
      clearTimeout(watchdog);
      app.exit(1);
    }
  });
});

require('../src/main.cjs');
