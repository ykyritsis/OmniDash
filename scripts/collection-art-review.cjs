const { app, ipcMain, nativeImage } = require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),output=path.join(root,'.visual-review/collection-art');
const requested={publisher:['EA','Ubisoft','Activision','Warner Bros. Games','Bethesda','Devolver Digital','SEGA','Capcom','2K','tinyBuild','Xbox Game Studios','THQ Nordic','Deep Silver','Square Enix'],series:['Call of Duty','Resident Evil','Assassin’s Creed','Sonic','Tom Clancy’s','Hitman','LEGO','Metal Gear','Far Cry','Batman: Arkham','Need for Speed','Battlefield']};
process.env.NEBULA_DEMO='1';process.env.NEBULA_REVIEW='1';process.env.NEBULA_DEMO_USER_DATA=path.join(output,'profile');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
setTimeout(()=>{console.error('Artwork review timed out');app.exit(1);},90000).unref();
app.on('browser-window-created',(_,win)=>win.webContents.once('did-finish-load',async()=>{
  try {
    await fs.mkdir(output,{recursive:true});await pause(1800);win.setFullScreen(false);
    const manifest=vm.runInNewContext((await fs.readFile(path.join(root,'src/renderer/collection-artwork.js'),'utf8'))+';collectionArtwork');
    const record=JSON.parse(await fs.readFile(path.join(root,'docs/collection-artwork-prompts.json'),'utf8'));
    const files=Object.entries(manifest).flatMap(([kind,names])=>Object.entries(names).map(([name,file])=>({kind,name,file})));
    const textFallbacks=record.textFallbacks||[];
    assert.equal(files.length+textFallbacks.length,26);
    for(const [kind,names] of Object.entries(requested))for(const name of names)assert(manifest[kind][name]||textFallbacks.some(e=>e.kind===kind&&e.name===name),`Unaccounted artwork: ${name}`);
    let bytes=0;
    for(const entry of files) {
      const file=path.join(root,'src/renderer',entry.file),img=nativeImage.createFromPath(file);assert(!img.isEmpty(),`Missing artwork for ${entry.name}`);
      bytes+=(await fs.stat(file)).size;
      const size=img.getSize(),ratio=size.width/size.height;
      assert(Math.abs(ratio-(entry.kind==='publisher'?2/3:16/9))<.01,'Wrong artwork aspect ratio: '+entry.name);
    }
    let logoRequests=0;ipcMain.removeHandler('art:publisher-logo');ipcMain.handle('art:publisher-logo',()=>{logoRequests++;return null;});
    const run=code=>win.webContents.executeJavaScript(code);
    await run(`document.querySelectorAll('dialog[open]').forEach(d=>d.close());document.querySelector('#startup-screen').hidden=true;state.soundEffects=false;state.shuffleHomeScreenshots=false;document.documentElement.classList.add('reduce-motion');scanLibrary=async()=>{};
      const requested=${JSON.stringify(requested)};state.games=[...requested.publisher.flatMap((publisher,i)=>[1,2].map(n=>({id:'pub-'+i+'-'+n,title:publisher+' sample '+n,publisher,provider:'PC',installed:true,artwork:{}}))),...requested.series.flatMap((series,i)=>[1,2].map(n=>({id:'series-'+i+'-'+n,title:series+' '+n,publisher:requested.publisher[i],provider:'PC',installed:true,artwork:{}})))];state.duplicateMode='all';renderLibrary();showView('home');`);
    assert.equal(await run(`document.querySelectorAll('#home-publishers .has-artwork').length`),Object.keys(manifest.publisher).length);
    assert.equal(await run(`document.querySelectorAll('#home-series .has-artwork').length`),Object.keys(manifest.series).length);
    for(const entry of textFallbacks)assert.equal(await run(`gCollectionCard(${JSON.stringify(entry.kind)},${JSON.stringify(entry.name)},[{},{}]).includes('<img')`),false,'Pending art must use clean text');
    assert.equal(await run(`gPublisherCard('Unknown Studio',[{},{}]).includes('<img')`),false);
    assert.equal(await run(`document.querySelectorAll('#home-publishers .g-publisher-logo,#home-series .g-series-logo').length`),0);
    for(const [width,height] of [[1920,1080],[1280,800],[1024,640]]) {
      win.setContentSize(width,height);
      for(const kind of ['publishers','series']) {
        await run(`setFocusedElement(document.querySelector('#home-${kind} .focusable'));`);await pause(450);
        await run(`Promise.all([...document.querySelectorAll('#home-${kind} img')].map(i=>{i.loading='eager';return i.decode();}))`);
        assert.equal(await run(`document.querySelector('main').scrollWidth<=document.querySelector('main').clientWidth+1`),true);
        await fs.writeFile(path.join(output,kind+'-'+width+'.png'),(await win.webContents.capturePage()).toPNG());
        await run(`(()=>{const card=document.activeElement,collection=card.dataset.collection;renderHomeCollections();if(document.activeElement.dataset.collection!==collection)throw Error('Collection refresh lost focus');moveFocus('right');if(!document.activeElement.dataset.collection)throw Error('D-pad cannot reach collection artwork');})()`);
      }
    }
    for(const kind of ['publisher','series']) {
      const cards=files.filter(a=>a.kind===kind).map(a=>({name:a.name,url:nativeImage.createFromPath(path.join(root,'src/renderer',a.file)).toDataURL()}));
      const encoded=await run(`(async()=>{const cards=${JSON.stringify(cards)},portrait=${kind==='publisher'},columns=portrait?7:3,w=portrait?200:440,h=portrait?300:248,gap=20,cellH=h+38;const c=document.createElement('canvas'),ctx=c.getContext('2d');c.width=columns*(w+gap)+gap;c.height=Math.ceil(cards.length/columns)*(cellH+gap)+gap;ctx.fillStyle='#151516';ctx.fillRect(0,0,c.width,c.height);for(const [n,card]of cards.entries()){const img=new Image();img.src=card.url;await img.decode();const x=gap+(n%columns)*(w+gap),y=gap+Math.floor(n/columns)*(cellH+gap);ctx.drawImage(img,x,y,w,h);ctx.fillStyle='#f5f5f5';ctx.font='16px Arial';ctx.fillText(card.name,x,y+h+24,w);}return c.toDataURL('image/png').split(',')[1];})()`);
      await fs.writeFile(path.join(output,kind+'-contact.png'),Buffer.from(encoded,'base64'));
    }
    assert.equal(logoRequests,0);await fs.writeFile(path.join(output,'result.json'),JSON.stringify({ok:true,publishers:Object.keys(manifest.publisher).length,series:Object.keys(manifest.series).length,textFallbacks,bytes,logoRequests},null,2));
    console.log(`PASS ${files.length} bundled artworks, ${textFallbacks.length} text fallbacks, branding, offline decoding, collection navigation, focus preservation and desktop/handheld layout (${(bytes/1048576).toFixed(2)} MB)`);app.exit(0);
  } catch(error) {console.error(error);await fs.writeFile(path.join(output,'failure.png'),(await win.webContents.capturePage()).toPNG());app.exit(1);}
}));
require('../src/main.cjs');
