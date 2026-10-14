// Public store art for a generic promotional demo library; no personal library data.
const fs=require('node:fs/promises'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const {createConsoleServices,mapProduct}=require('../src/console-services.cjs');
const root=path.resolve(__dirname,'../.visual-review/promo-v2');
const queries=['Forza Horizon 5','Minecraft','Halo Infinite','Cyberpunk 2077','ELDEN RING','Red Dead Redemption 2','Sea of Thieves','Gears 5','DOOM Eternal','Starfield','The Witcher 3','Hogwarts Legacy'];
(async()=>{
 await fs.mkdir(path.join(root,'art'),{recursive:true});
 const services=createConsoleServices({});
 const games=[];
 for(const [i,title] of queries.entries()){
  const steamIds={'DOOM Eternal':'782330','Cyberpunk 2077':'1091500','ELDEN RING':'1245620','Red Dead Redemption 2':'1174180','The Witcher 3':'292030','Hogwarts Legacy':'990080'};
  const results=steamIds[title]?[]:await services.searchXboxStore(title);
  let match=steamIds[title]?{title,artwork:{tile:`https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${steamIds[title]}/library_600x900.jpg`,tileIsSquare:false}}:results.find(g=>g.title.toLowerCase()===title.toLowerCase()) || (title==='Minecraft' ? results.find(g=>/java.*bedrock/i.test(g.title)&&!/(ultimate|deluxe)/i.test(g.title)) || results.find(g=>/java.*bedrock/i.test(g.title)):null) || results.find(g=>g.title.toLowerCase().includes(title.toLowerCase())&&!/(bundle|dlc|soundtrack|deluxe|premium)/i.test(g.title));
  const squareProducts={'DOOM Eternal':'9P5S26314HWQ','ELDEN RING':'9P3J32CTXLRZ','Red Dead Redemption 2':'BPSWGQBW7R3G'};
  if(squareProducts[title]){
   const response=await fetch(`https://displaycatalog.mp.microsoft.com/v7.0/products?bigIds=${squareProducts[title]}&market=US&languages=en-US`);
   const product=(await response.json()).Products?.[0];
   if(!product)throw Error('Missing square store product '+title);
   match=mapProduct(product);
   const squareBox=product.LocalizedProperties?.[0]?.Images?.find(image=>image.ImagePurpose==='BoxArt'&&image.Width===image.Height);
   if(squareBox){const url=new URL(squareBox.Uri.startsWith('//')?'https:'+squareBox.Uri:squareBox.Uri);url.searchParams.set('w','600');match.artwork.tile=url.href;match.artwork.tileIsSquare=true;}
   if(!match.artwork?.tileIsSquare)throw Error('Expected native square artwork for '+title);
  }
  if(!match?.artwork?.tile)throw Error('Missing artwork for '+title);
  const artwork={...match.artwork};
  for(const slot of ['tile','hero'])if(artwork[slot]){
   const response=await fetch(artwork[slot],{signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw Error('Artwork '+response.status+' '+title);
   const file=path.join(root,'art',`${i}-${slot}.jpg`);
   await fs.writeFile(file,Buffer.from(await response.arrayBuffer()));artwork[slot]=pathToFileURL(file).href;
  }
  artwork.grid=artwork.tile;artwork.wide=artwork.hero;
  games.push({id:'promo-'+i,title,provider:i===1?'Xbox PC':'Steam',appId:['1551360','','1240440','1091500','1245620','1174180','1172620','1097840','782330','1716740','292030','990080'][i],installed:true,controls:'controller',artwork,addedAt:Date.now()-((i+6)%queries.length)*86400000});
  console.log(title+' <- '+match.title);
 }
 await fs.writeFile(path.join(root,'games.json'),JSON.stringify(games,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
