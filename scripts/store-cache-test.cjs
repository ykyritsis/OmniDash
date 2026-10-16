const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createConsoleServices} = require('../src/console-services.cjs');
const {createOwnershipIndex, titleKey} = require('../src/library-duplicates.cjs');
const main = fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8');
const deferred = () => {let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const flush = () => new Promise(resolve=>setImmediate(resolve));
function cacheFixture(saved = {}) {
  let clock = 1000000000, country = 'AU', fresh = 0, output;
  const context = {path,Date:class extends Date {static now(){return clock;}},gameDetailCache:new Map(),gameDetailRequests:new Map(),
    steamCountry:()=>country,settingsPath:()=>'/fixture/settings.json',setTimeout:()=>0,clearTimeout:()=>{},scheduleScreenshotCache:()=>{},
    fs:{readFile:async()=>JSON.stringify(saved),writeFile:async(_file,value)=>{output=value;}},
    fresh:async game=>{fresh++;return {title:game.title,metadataSource:'Steam Store'};}};
  vm.createContext(context);vm.runInContext(main.slice(main.indexOf('const detailCacheKey ='),main.indexOf('async function fetchOwnedDlc')),context);
  vm.runInContext('fetchGameDetailsFresh = (...args) => fresh(...args)',context);
  return {context,advance:ms=>clock+=ms,country:value=>country=value,calls:()=>fresh,disk:()=>vm.runInContext('detailDisk',context),now:()=>clock};
}
async function run() {
  const games=[{id:'steam',provider:'Steam',appId:'1',title:'DOOM™',installed:false},{id:'epic',provider:'Epic Games',appId:'1',title:'Doom',installed:true},
    {id:'other',provider:'Steam',appId:'2',title:'Another game'}, {id:'jp',provider:'Steam',title:'日本語'}, {id:'app',title:'Launcher',isApp:true}];
  let index=createOwnershipIndex(games);
  assert.equal(index.find({title:'Unowned game'}),undefined,'Missing product IDs must never claim ownership');
  assert.equal(index.find({title:''}),undefined);assert.equal(index.find({title:'中文'}),undefined,'Non-Latin titles must not all match');
  assert.equal(index.find({title:'日本語'}).id,'jp');assert.equal(index.find({title:'Doom'}).id,'epic','Installed copy wins title matches');
  assert.equal(index.find({provider:'Steam',appId:'1',title:'Doom'}).id,'steam','Exact store identity wins');
  assert.equal(index.find({provider:'Steam',appId:'99',title:'Another game'}),undefined,'Conflicting IDs stay distinct');
  assert.equal(index.find({title:'Doom Deluxe Edition'}),undefined);assert.equal(index.find({title:'Launcher'}),undefined);
  index=createOwnershipIndex(games,{duplicatePreferences:{[titleKey('Doom')]:'steam'}});assert.equal(index.find({title:'Doom'}).id,'steam');
  games[0].installed=true;games[1].title='Changed';index=createOwnershipIndex(games);assert.equal(index.find({title:'Doom'}).id,'steam');
  const priceSource=fs.readFileSync(path.join(__dirname,'../src/renderer/garrison.js'),'utf8');
  const price={Intl,Map};vm.createContext(price);vm.runInContext(priceSource.slice(priceSource.indexOf('const gPriceFormats'),priceSource.indexOf('function gStoreOwnership')),price);
  for(const invalid of [null,{}, {list:null},{list:NaN},{list:-1},{list:20,currency:'INVALID'}])assert.equal(price.gPrice(invalid),'');
  assert.equal(price.gPrice({list:0}),'Free');assert(price.gPrice({list:59.95,currency:'AUD'}).includes('59.95'));
  let requests=0, fail=true, country='AU';
  const pending=deferred();
  const summary={productId:'9NKX70BBCDRN',title:'Test',specificPrices:{purchaseable:[{}]},contentRating:{boardName:'COB-AU',rating:'Mature',ratingAge:15}};
  const service=createConsoleServices('/fixture',async target=>{requests++;assert(new URL(target).searchParams.get('locale').startsWith('en-'));await pending.promise;if(fail)throw Error('offline');return {ok:true,json:async()=>({productSummaries:[summary]})};},{getCountry:()=>country});
  const failed=service.findXboxProduct('Test');pending.resolve();assert.equal(await failed,null);fail=false;
  const [one,two]=await Promise.all([service.findXboxProduct('Test'),service.findXboxProduct('test')]);
  assert.equal(requests,2,'Failed metadata is retryable and concurrent matching requests share work');assert.equal(one,two);assert.equal(one.price,null,'Missing price must not mean Free');
  requests=0;await Promise.all([service.getXboxStore(),service.getXboxStore(),service.getXboxStore()]);assert.equal(requests,3,'Parallel callers share the three browse-list requests');
  country='US';const au=await service.findXboxProduct('Test','AU');assert.equal(au.rating.regionalFallback,false,'A captured request region survives a later settings change');
  let f=cacheFixture(), game={id:'game',title:'Test'};
  await Promise.all([f.context.fetchGameDetails(game),f.context.fetchGameDetails(game)]);assert.equal(f.calls(),1);
  f.country('US');await f.context.fetchGameDetails(game);assert.equal(f.calls(),2);
  for(let i=0;i<180;i++)await f.context.fetchGameDetails({id:'bounded-'+i,title:'Bounded'});
  assert.equal(f.context.gameDetailCache.size,160,'Main-process cache has a fixed working-set limit');
  f=cacheFixture({'v3:AU:game':{at:1000000000,data:{title:'Offline',metadataSource:'Local library'}}});
  await f.context.fetchGameDetails(game);assert.equal(f.calls(),0);f.advance(31000);assert.equal((await f.context.fetchGameDetails(game)).metadataSource,'Steam Store');assert.equal(f.calls(),1,'Empty offline details retry after thirty seconds, including disk hits');
  f=cacheFixture({'v3:AU:game':{at:1000000000-2*86400000,data:{title:'Saved page',metadataSource:'Steam Store'}}});
  f.context.fresh=async()=>({metadataSource:'Local library'});
  assert.equal((await f.context.fetchGameDetails(game)).title,'Saved page');await flush();assert.equal(f.disk()['v3:AU:game'].data.title,'Saved page','Outages preserve useful saved metadata');
  f=cacheFixture();const old=deferred(),newer=deferred();let count=0;f.context.fresh=()=>++count===1?old.promise:newer.promise;
  const first=f.context.fetchGameDetails(game);await flush();f.context.invalidateGameDetails('game');
  const next=f.context.fetchGameDetails(game);await flush();old.resolve({title:'Old',metadataSource:'Steam Store'});await first;
  assert.equal(f.context.gameDetailRequests.size,1,'Late obsolete request must not delete a newer pending request');
  assert.equal(f.context.gameDetailCache.size,0,'Invalidated requests must not refill the cache');
  newer.resolve({title:'New',metadataSource:'Steam Store'});await next;assert.equal(f.disk()['v3:AU:game'].data.title,'New');
  f.context.clearGameDetails();assert.equal(Object.keys(f.disk()).length,0);assert.equal(f.context.gameDetailCache.size,0);
  f=cacheFixture();const reading=deferred();f.context.fs.readFile=()=>reading.promise;const loading=f.context.fetchGameDetails(game);await flush();f.context.clearGameDetails();reading.resolve(JSON.stringify({'v3:AU:game':{at:f.now(),data:{title:'Old disk',metadataSource:'Steam Store'}}}));
  assert.equal((await loading).title,'Test','Reset during disk loading must discard the old file');
  const download=deferred(),artGame={id:'art',artwork:{tile:'original'}},writes=[];
  let current=true;
  const art={process:{env:{}},currentLibrary:[artGame],artworkCacheTask:Promise.resolve(),artworkCache:{cacheImage:()=>download.promise},writeSettings:async value=>writes.push(value)};
  vm.createContext(art);vm.runInContext(main.slice(main.indexOf('function scheduleScreenshotCache'),main.indexOf('const xboxAgeRating')),art);
  art.scheduleScreenshotCache(artGame,{screenshots:['https://example/shot']},()=>current);
  artGame.artwork={tile:'manual'};download.resolve('file:///shot');await art.artworkCacheTask;
  assert.equal(writes.length,0,'Late screenshot caching must not overwrite a manual artwork change');
  current=false;art.scheduleScreenshotCache(artGame,{screenshots:['https://example/shot']},()=>current);await art.artworkCacheTask;
  assert.equal(writes.length,0,'Reset must prevent pending screenshot settings writes');
  current=true;art.scheduleScreenshotCache(artGame,{screenshots:['https://example/shot']},()=>current);
  assert.equal(await art.artworkCacheTask,undefined,'Completed cache batches must release prior task results');assert.equal(writes.length,1);
  console.log('PASS accurate ownership, editions, preferred copies, safe prices, shared Xbox requests, retryable failures, regional isolation, bounded details, offline recovery and cache invalidation races');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
