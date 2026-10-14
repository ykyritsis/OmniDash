// Isolated demo profile. Synthetic presence is only injected into this visual test window.
const { app } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const output = path.resolve(__dirname, '../.visual-review/home-update');
process.env.NEBULA_DEMO = '1';
process.env.NEBULA_REVIEW = '1';
process.env.NEBULA_DEMO_USER_DATA = path.join(output, 'profile');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.on('browser-window-created', (_, win) => {
  const errors = [];
  win.webContents.on('console-message', event => { if ((event.level === 'error' || event.level === 3) && !/net::ERR_|status of 4\d\d|status of 5\d\d/.test(event.message)) errors.push(event.message); });
  win.webContents.once('did-finish-load', async () => {
    try {
      await fs.mkdir(output, { recursive: true });
      await pause(4000);
      const run = code => win.webContents.executeJavaScript(code);
      await run(`(async () => {
        for (const d of document.querySelectorAll('dialog[open]')) d.close();
        await window.launcher.saveSettings({onboardingComplete:true,startupAnimation:false});
        state.steamBannerDismissed = true;
        document.querySelector('#startup-screen').hidden = true;
        showView('home');
        state.games.filter(g => !g.isApp).forEach((g, i) => { g.addedAt = Date.now() - i * 1000; });
        renderHomeCollections();
        // Disable network refresh for this deterministic demo only.
        refreshGarrisonFriends = async () => {};
        state.gFriends = { status:'ready', online:7, friends: Array.from({length:7}, (_, i) => ({id:'7656119800000000'+i, name:['Alex','Jamie','Morgan','Riley','Taylor','Casey','Sam'][i], avatar:'assets/xbox.svg', state:i === 6 ? 'offline' : 'online', game:i === 5 ? '' : ['Halo Infinite','Forza Horizon 5','Sea of Thieves'][i % 3], gameId:i === 5 ? '' : ['1240440','1551360','1172620'][i % 3], lobby:''})) };
        renderPlayWithFriends();
      })()`);
      const reports = [];
      for (const [width, height] of [[1280, 800], [1920, 1080]]) {
        win.setContentSize(width, height);
        await pause(500);
        const report = await run(`(() => {
          const home = document.querySelector('#home-view');
          const recent = document.querySelector('#recent-row .game-card');
          const added = document.querySelector('[aria-labelledby="home-added-title"] .game-card');
          const art = document.querySelector('#g-friends-activity .g-friend-art');
          const rows = [recent, added, art.closest('.game-card')];
          home.style.setProperty('--g-home-row-scale', '1');
          const before = rows.map(e => e.getBoundingClientRect().width);
          home.style.removeProperty('--g-home-row-scale');
          const after = rows.map(e => e.getBoundingClientRect().width);
          const cards = [...document.querySelectorAll('#g-friends-activity .game-card')];
          return {before, after, ratios:after.map((n,i)=>n/before[i]), friends:cards.length, tops:cards.map(e=>e.offsetTop), artHeight:art.getBoundingClientRect().height,
            duplicate:!!document.querySelector('#g-play-with-friends'), afterText:getComputedStyle(added.querySelector('.g-card-text'),'::after').content,
            metadata:[...added.querySelectorAll('.g-card-text > :not(strong)')].map(e=>getComputedStyle(e).display), pageOverflow:document.querySelector('main').scrollWidth > innerWidth};
        })()`);
        await fs.writeFile(path.join(output, `measures-${width}.json`), JSON.stringify(report, null, 2));
        for (const ratio of report.ratios) assert.ok(Math.abs(ratio - 1.2) < 0.002, 'all home card widths must be 20% larger');
        assert.equal(report.friends, 5, 'only in-game friends appear');
        assert.equal(new Set(report.tops).size, 1, 'friends occupy a single horizontal row');
        assert.ok(report.artHeight > 100);
        assert.equal(report.duplicate, false);
        assert.equal(report.afterText, 'none');
        assert.ok(report.metadata.every(display => display === 'none'));
        assert.equal(report.pageOverflow, false);
        await run(`setFocusedElement(recentRow.querySelector('.game-card')); document.querySelector('main').scrollTop = 0;`);
        await pause(700);
        await fs.writeFile(path.join(output, `home-${width}.png`), (await win.webContents.capturePage()).toPNG());
        await run(`setFocusedElement(document.querySelector('[aria-labelledby="home-added-title"] .game-card'));`);
        await pause(750);
        await fs.writeFile(path.join(output, `rows-${width}.png`), (await win.webContents.capturePage()).toPNG());
        reports.push({ width, height, ...report });
      }
      const navigation = await run(`(() => {
        const band = document.querySelector('#g-friends-activity');
        setFocusedElement(band.querySelector('.focusable'));
        moveFocus('right');
        const moved = document.activeElement.dataset.friendId;
        state.gFriends.friends = state.gFriends.friends.filter(f => f.id !== moved);
        renderPlayWithFriends();
        const recovered = band.contains(document.activeElement);
        state.gFriends.friends.forEach(f => {f.game = ''; f.gameId = '';});
        renderPlayWithFriends();
        return {moved,recovered,hidden:band.hidden, focusRecovered:recentRow.contains(document.activeElement)};
      })()`);
      assert.equal(navigation.moved, '76561198000000001');
      assert.ok(navigation.recovered && navigation.hidden && navigation.focusRecovered);
      assert.deepEqual(errors, []);
      await fs.writeFile(path.join(output, 'results.json'), JSON.stringify({ reports, navigation, errors }, null, 2));
      console.log('PASS: 1280x800 and 1920x1080 home shelves, 20% sizing, title-only cards, in-game-only activity, navigation and focus recovery.');
      app.exit(0);
    } catch (error) {
      await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ error: error.stack, errors }, null, 2));
      console.error(error);
      app.exit(1);
    }
  });
});
require('../src/main.cjs');
