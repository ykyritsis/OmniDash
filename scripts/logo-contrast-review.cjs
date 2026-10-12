// Checks real logo readability in the isolated demo, without opening a game.
const { app } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const output = path.resolve(__dirname, '../.visual-review');
process.env.NEBULA_DEMO = '1';
process.env.NEBULA_REVIEW = '1';
process.env.NEBULA_DEMO_USER_DATA = path.join(output, 'logo-profile');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
app.on('browser-window-created', (_, win) => {
  win.webContents.once('did-finish-load', async () => {
    try {
      await pause(6000);
      win.setContentSize(1920, 1080);
      await win.webContents.executeJavaScript(`(async()=>{
        const game=state.games.find(game=>game.id==='demo-1');
        game.artwork={...game.artwork,logo:'https://cdn.akamai.steamstatic.com/steam/apps/1551360/logo.png'};
        openGameDetails(game.id);
      })()`);
      await pause(6000);
      const result = await win.webContents.executeJavaScript(`(async()=>{
        const element=document.querySelector('#detail-logo');
        const url=element.getAttribute('src');
        const dark=await isDarkGameLogo(url);
        const sample=await new Promise(resolve=>{
          const image=new Image();image.crossOrigin='anonymous';
          image.onerror=()=>resolve({error:'CORS or image loading failure'});
          image.onload=()=>{try{
            const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;
            const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,128,64);
            const data=ctx.getImageData(0,0,128,64).data;let total=0,dark=0,transparent=0;
            for(let i=0;i<data.length;i+=4){if(data[i+3]<80){transparent++;continue;} const weight=data[i+3]/255;total+=weight;if(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722<62)dark+=weight;}
            resolve({darkRatio:dark/total,transparentRatio:transparent/(128*64)});
          }catch(error){resolve({error:error.message});}};image.src=url;
        });
        return {url,dark,sample,classes:element.className,filter:getComputedStyle(element).filter};
      })()`);
      console.log(JSON.stringify(result));
      if (!result.sample.error && (!result.dark || !result.classes.includes('dark-game-logo'))) throw Error('The dark Forza wordmark did not get its contrast treatment');
      await fs.mkdir(output,{recursive:true});
      await fs.writeFile(path.join(output,'logo-contrast.png'),(await win.webContents.capturePage()).toPNG());
      app.quit();
    } catch(error) { console.error(error);app.exit(1); }
  });
});
require('../src/main.cjs');
