// Time the renderer's hot paths against a large synthetic library. No real games launch.
const { app } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const output = path.resolve(__dirname, '../.visual-review', process.env.GARRISON_OUT || 'garrison-perf');
process.env.NEBULA_DEMO = '1';
process.env.NEBULA_REVIEW = '1';
process.env.NEBULA_DEMO_USER_DATA = path.join(output, 'profile');
const started = Date.now();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.on('browser-window-created', (_, win) => {
  win.webContents.once('did-finish-load', async () => {
    const loaded = Date.now() - started;
    try {
      await fs.mkdir(output, { recursive: true });
      await pause(4000);
      win.setContentSize(1920, 1080);
      const result = await win.webContents.executeJavaScript(`(async()=>{
        for(const d of document.querySelectorAll('dialog[open]'))d.close();
        const base=state.games.filter(g=>!g.isApp);
        const providers=['Steam','Epic Games','Xbox PC','EA app','Battle.net','Ubisoft Connect','GOG Galaxy'];
        state.games=[...state.games.filter(g=>g.isApp),...Array.from({length:1500},(_,i)=>({...base[i%base.length],id:'perf-'+i,title:base[i%base.length].title+' '+i,provider:providers[i%providers.length],installed:i%3!==0,playCount:i%5}))];
        const time=async(label,fn)=>{const t=performance.now();await fn();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return [label,Math.round(performance.now()-t)];};
        const out=[];
        out.push(await time('renderLibrary (1500)',()=>renderLibrary()));
        out.push(await time('showView library',()=>showView('library')));
        out.push(await time('renderLibraryView',()=>renderLibraryView()));
        out.push(await time('20x moveFocus in grid',()=>{setFocusedElement(libraryGrid.querySelector('.focusable'));for(let i=0;i<10;i++){moveFocus('right');moveFocus('down');}}));
        out.push(await time('showView home',()=>showView('home')));
        out.push(await time('20x moveFocus home',()=>{for(let i=0;i<10;i++){moveFocus('right');}for(let i=0;i<10;i++)moveFocus('down');}));
        out.push(await time('open game page',()=>openGameDetails(state.games.find(g=>!g.isApp).id)));
        out.push(['DOM nodes',document.getElementsByTagName('*').length]);
        out.push(['images',document.images.length]);
        return out;})()`);
      await fs.writeFile(path.join(output, 'perf.json'), JSON.stringify({ loadedMs: loaded, result }, null, 2));
      app.exit(0);
    } catch (error) {
      await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ error: error.stack }, null, 2));
      app.exit(1);
    }
  });
});
require(process.env.GARRISON_MAIN || '../src/main.cjs');
