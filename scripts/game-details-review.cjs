// Offline regression review. No user profile, Steam mutation, or game launch.
const { app, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const output = path.resolve(__dirname, '../.visual-review/game-details-final');
process.env.NEBULA_DEMO = '1';
process.env.NEBULA_REVIEW = '1';
process.env.NEBULA_DEMO_USER_DATA = path.join(output, 'profile');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const sampleImage = i => 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540"><rect width="960" height="540" fill="${['#253b3d','#29334c','#4a3548'][i % 3]}"/><text x="50" y="280" fill="white" font-size="44" font-family="sans-serif">Gallery ${i + 1}</text></svg>`);
const errors = [];
let queue = [];
let completed = false;
const watchdog = setTimeout(() => { console.error('Game details review timed out'); app.exit(1); }, 90000);
app.on('browser-window-created', (_, win) => {
  win.webContents.setBackgroundThrottling(false);
  win.webContents.on('console-message', event => { if (event.level === 'error' || event.level === 3) errors.push(event.message); });
  win.webContents.once('did-finish-load', async () => {
    try {
      await fs.mkdir(output, { recursive: true });
      await pause(1500);
      const replace = (channel, handler) => { ipcMain.removeHandler(channel); ipcMain.handle(channel, handler); };
      replace('game:details', () => ({
        description: 'Explore an open world with friends and discover new challenges.',
        fullDescription: 'Explore an open world with friends and discover new challenges.\n\n' + 'Choose your route, discover new places and build your collection as you play. '.repeat(12),
        developer: 'Example Studios', publisher: 'Example Games', releaseDate: '9 November 2021',
        genres: ['Racing', 'Adventure'], playableOn: ['PC'], controllerSupport: 'controller',
        categories: ['Single-player', 'Online co-op', 'Steam achievements'], achievementCount: 54,
        screenshots: Array.from({ length: 10 }, (_, i) => sampleImage(i)), dlcStatus: 'none-listed', ageRating: '', supportedLanguageCount: 13
      }));
      replace('game:achievements', () => ({ status: 'unavailable', items: [] }));
      replace('steam:downloads', () => queue);
      replace('steam:install-status', () => completed ? { installed: true, state: 'ready', percent: 100 } : queue[0] || { installed: false, state: 'waiting' });
      const run = script => win.webContents.executeJavaScript(script);
      await run(`(async()=>{for(const d of document.querySelectorAll('dialog[open]'))d.close();await window.launcher.saveSettings({onboardingComplete:true,fullscreen:false,startupAnimation:false});document.querySelector('#startup-screen').hidden=true;state.useRandomScreenshotBackground=false;document.documentElement.classList.add('reduce-motion');scanLibrary=async()=>{};openGameDetails(state.games.find(g=>g.provider==='Steam'&&!g.isApp).id);})()`);
      for (let i = 0; i < 40; i++) {
        if (await run(`document.querySelectorAll('#detail-gallery button').length===10`)) break;
        await pause(100);
      }
      assert.equal(await run(`document.querySelectorAll('#detail-gallery button').length`), 10);
      const results = [];
      for (const [width, height] of [[1920,1080],[2560,1440],[1280,720],[1024,640]]) {
        win.setContentSize(width, height);
        await pause(150);
        await run(`document.querySelector('main').scrollTo({top:0,left:0,behavior:'instant'});setFocusedElement(document.querySelector('#detail-play'),{scroll:false})`);
        const sizes = await run(`(()=>{const s=e=>getComputedStyle(document.querySelector(e));return {width:innerWidth,play:parseFloat(s('#detail-play').fontSize),label:parseFloat(s('#detail-play > strong').fontSize),text:parseFloat(s('#detail-full-description').fontSize),overflow:document.querySelector('main').scrollWidth-document.querySelector('main').clientWidth};})()`);
        assert.equal(sizes.width, width);
        assert.equal(sizes.play, sizes.label, 'Play label must inherit the responsive size');
        assert.ok(sizes.overflow <= 1, 'Page must not overflow horizontally: ' + JSON.stringify(sizes));
        await fs.writeFile(path.join(output, `hero-${width}.png`), (await win.webContents.capturePage()).toPNG());
        const gallery = await run(`(async()=>{const strip=document.querySelector('#detail-gallery'),items=[...strip.querySelectorAll('button')];strip.scrollLeft=0;setFocusedElement(items[0]);for(let i=1;i<items.length;i++){moveFocus('right');await new Promise(r=>setTimeout(r,20));}await new Promise(r=>setTimeout(r,100));const b=strip.getBoundingClientRect(),f=document.activeElement.getBoundingClientRect();return {last:document.activeElement===items.at(-1),scroll:strip.scrollLeft,page:document.querySelector('main').scrollLeft,body:document.body.scrollLeft,root:document.documentElement.scrollLeft,visible:f.left>=b.left-1&&f.right<=b.right+1,modal:document.querySelector('#gallery-dialog')?.open||false};})()`);
        assert.ok(gallery.last && gallery.visible && gallery.scroll > 0, 'Gallery focus must follow to the final screenshot: ' + JSON.stringify(gallery));
        assert.equal(gallery.page + gallery.body + gallery.root, 0);
        assert.equal(gallery.modal, false);
        await run(`document.querySelector('.detail-info').scrollIntoView({block:'start',behavior:'instant'});document.querySelector('main').scrollBy({top:-180,behavior:'instant'})`);
        await fs.writeFile(path.join(output, `details-${width}.png`), (await win.webContents.capturePage()).toPNG());
        results.push({ ...sizes, gallery });
      }
      win.setContentSize(1920,1080);
      const smooth = await run(`(async()=>{document.documentElement.classList.remove('reduce-motion');const strip=document.querySelector('#detail-gallery'),items=[...strip.querySelectorAll('button')];setFocusedElement(items.at(-1));await new Promise(r=>setTimeout(r,550));for(let i=1;i<items.length;i++){moveFocus('left');await new Promise(r=>setTimeout(r,30));}await new Promise(r=>setTimeout(r,700));const b=strip.getBoundingClientRect(),f=document.activeElement.getBoundingClientRect();return {first:document.activeElement===items[0],visible:f.left>=b.left-1&&f.right<=b.right+1,page:document.querySelector('main').scrollLeft,scroll:strip.scrollLeft,box:[b.left,b.right],item:[f.left,f.right],width:innerWidth};})()`);
      assert.ok(smooth.first && smooth.visible && smooth.page === 0, 'Smooth gallery focus must remain inside the strip: ' + JSON.stringify(smooth));
      const game = await run(`state.games.find(g=>g.id===state.detailGameId)`);
      queue = [{ appId: game.appId, title: game.title, installed: false, state: 'downloading', downloaded: 740, total: 1000, percent: 74, rate: 8e7, live: true }];
      await run(`gPollDownloads()`);
      assert.match(await run(`document.querySelector('#detail-play').textContent`), /74%/);
      await run(`performAction('detail-play',document.querySelector('#detail-play'))`);
      await pause(150);
      assert.equal(await run(`state.view==='library'&&state.libraryQueue`), true, 'Installing must open Queue');
      assert.match(await run(`document.querySelector('#library-grid').textContent`), /74%/);
      await run(`openGameDetails(${JSON.stringify(game.id)})`);
      await pause(150);
      completed = true;
      queue = [];
      await run(`gPollDownloads()`);
      assert.equal(await run(`installTracking.has(${JSON.stringify(game.id)})`), false);
      assert.equal(await run(`document.querySelector('#detail-play').textContent.trim()`), 'Play');
      assert.equal(await run(`document.querySelector('#detail-play').classList.contains('g-installing')`), false);
      assert.deepEqual(errors, []);
      await fs.writeFile(path.join(output,'results.json'), JSON.stringify({ results, smooth, queue: '74% → Queue → completed → Play', errors }, null, 2));
      console.log('PASS responsive Play typography, gallery controller focus without page drift, Queue navigation and install completion');
      clearTimeout(watchdog);
      app.exit(0);
    } catch (error) {
      await fs.writeFile(path.join(output,'failure.json'), JSON.stringify({ error: error.stack, errors }, null, 2));
      console.error(error);
      app.exit(1);
    }
  });
});
require('../src/main.cjs');
