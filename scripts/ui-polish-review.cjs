const { app, ipcMain } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const output = path.resolve(__dirname, '../.visual-review/ui-polish');
process.env.NEBULA_DEMO = '1'; process.env.NEBULA_REVIEW = '1';
process.env.NEBULA_DEMO_USER_DATA = path.join(output, 'profile');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.on('browser-window-created', (_, win) => {
  const errors = [];
  win.webContents.on('console-message', event => { if ((event.level === 'error' || event.level === 3) && !/net::ERR_|status of [45]\d\d/.test(event.message)) errors.push(event.message); });
  win.webContents.once('did-finish-load', async () => {
    const result = { sizes: [], keyboardCalls: 0 };
    try {
      await fs.mkdir(output, { recursive: true }); await pause(4000);
      const run = code => win.webContents.executeJavaScript(code);
      ipcMain.removeHandler('keyboard:show');
      ipcMain.handle('keyboard:show', () => { result.keyboardCalls++; return { shown: true, simulated: true }; });
      await run(`for(const d of document.querySelectorAll('dialog[open]'))d.close(); document.querySelector('#startup-screen').hidden=true; state.games.filter(g=>!g.isApp).forEach((g,i)=>{g.addedAt=Date.now()-i*1000;g.title=i===0?'EA SPORTS™ FC 27':i===1?'A longer game title that wraps onto two lines':g.title;g.controls='controller';}); renderLibrary(); renderHomeCollections(); showView('home'); true`);
      for (const [width, height] of [[1280,800],[1920,1080]]) {
        win.setContentSize(width, height); await pause(400);
        const report = await run(`(() => {
          const cards=[...document.querySelectorAll('[aria-labelledby="home-added-title"] .game-card')];
          return { gaps:cards.map(card=>{const text=card.querySelector('.g-card-text');return card.getBoundingClientRect().bottom-text.getBoundingClientRect().bottom-parseFloat(getComputedStyle(card).paddingBottom);}), clip:getComputedStyle(recentRow.querySelector('.game-card')).overflow, radius:getComputedStyle(recentRow.querySelector('.game-card')).borderRadius, customKeyboard:Boolean(document.querySelector('#controller-keyboard-dialog')) };
        })()`);
        assert.ok(report.gaps.length > 1);
        assert.ok(report.gaps.every(gap => Math.abs(gap) < 1), `extra card space: ${report.gaps}`);
        assert.equal(report.clip, 'hidden'); assert.notEqual(report.radius, '0px'); assert.equal(report.customKeyboard, false);
        await run(`setFocusedElement(recentRow.querySelector('.game-card'));document.querySelector('main').scrollTop=0;true`); await pause(400);
        await fs.writeFile(path.join(output, `selected-${width}.png`), (await win.webContents.capturePage()).toPNG());
        await run(`setFocusedElement(document.querySelector('[aria-labelledby="home-added-title"] .game-card'));true`); await pause(400);
        await fs.writeFile(path.join(output, `shelves-${width}.png`), (await win.webContents.capturePage()).toPNG());
        result.sizes.push({ width, height, ...report });
      }
      await run(`state.controllerClick=true;openConsoleSearch();state.controllerClick=false;true`); await pause(100);
      assert.equal(result.keyboardCalls, 1, 'controller search requests the native keyboard');
      assert.equal(await run('document.activeElement===librarySearch'), true);
      await run(`librarySearch.dispatchEvent(new PointerEvent('pointerup',{pointerType:'touch',bubbles:true}));true`); await pause(100);
      assert.equal(result.keyboardCalls, 2, 'touch uses the same native entry point');
      await run(`document.querySelector('#console-search-dialog').close();const field=document.createElement('input');field.type='email';field.id='test-native-email';field.className='focusable';document.body.append(field);field.dispatchEvent(new PointerEvent('pointerup',{pointerType:'pen',bubbles:true}));true`); await pause(100);
      assert.equal(result.keyboardCalls, 3, 'dynamic email fields use the native keyboard');
      await run(`const blocked=document.createElement('input');blocked.readOnly=true;document.body.append(blocked);blocked.dispatchEvent(new PointerEvent('pointerup',{pointerType:'touch',bubbles:true}));true`); await pause(100);
      assert.equal(result.keyboardCalls, 3, 'read-only fields do not request a keyboard');
      win.focus();
      await run(`window.testPad={id:'Xbox Controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[testPad]});focusForGamepad(testPad);setFocusedElement(document.querySelector('#test-native-email'));testPad.buttons[0]={pressed:true,value:1};pollGamepad();true`); await pause(100);
      assert.equal(result.keyboardCalls, 4, 'controller A opens the native keyboard on an email field');
      result.errors = errors; assert.deepEqual(errors, []);
      result.ok = true; await fs.writeFile(path.join(output, 'result.json'), JSON.stringify(result, null, 2)); app.exit(0);
    } catch(error) { await fs.writeFile(path.join(output, 'result.json'), JSON.stringify({...result,error:error.stack,errors},null,2));app.exit(1); }
  });
});
require('../src/main.cjs');
