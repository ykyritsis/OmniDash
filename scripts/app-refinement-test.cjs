const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const ratings = require('../src/region-ratings.cjs');
const media = require('../src/renderer/media-utils.js');
const { createSteamStoreLookup } = require('../src/steam-store-lookup.cjs');
const { createConsoleServices } = require('../src/console-services.cjs');
const fixtures = { esrb: { rating: 'm' }, pegi: { rating: '18' }, oflc: { rating: 'r18' }, nzoflc: { rating: 'r16' } };
async function run() {
  assert.equal(ratings.resolveCountry({ locale: 'en-AU' }), 'AU');
  assert.equal(ratings.resolveCountry({ region: 'NZ', country: 'AU' }), 'NZ');
  assert.equal(ratings.resolveCountry({ locale: 'en', timeZone: 'Australia/Sydney' }), 'AU');
  assert.equal(ratings.resolveCountry({locale:'en-US',timeZone:'Australia/Sydney'}),'AU','Display language must not override the player location');
  for (const [country, system, label] of [['AU','COB-AU','R18+'],['NZ','OFLC-NZ','R16'],['US','ESRB','M'],['GB','PEGI','18']]) {
    const rating = ratings.steamAgeRating({ ratings: fixtures }, country);
    assert.equal(rating.system, system); assert.equal(rating.label, label); assert.equal(rating.regionalFallback, false);
  }
  for (const label of ['g', 'pg', 'm', 'ma15', 'r18']) assert(ratings.steamAgeRating({ ratings: { oflc: { rating: label } } }, 'AU'));
  assert.equal(ratings.normalizeRating({label:'Mature',system:'COB-AU'}).label,'M');
  for(const [raw,label] of [['Australian Classification G','G'],['General0','G'],['Mature15','M'],['MatureAccompanied15','MA15+'],['Restricted15','MA15+'],['Restricted18','R18+'],['RefusedClassification','RC'],['RatingPending','CTC']])assert.equal(ratings.normalizeRating({label:raw,system:'COB-AU'}).label,label);
  assert.equal(ratings.normalizeRating({label:'Unknown label',system:'COB-AU'}),null);
  assert.equal(ratings.steamAgeRating({ratings:{dejus:{rating:'6',descriptors:'Violência fantasiosa'},steam_germany:{rating:'12',descriptors:'Fantasy-Gewalt'},igrs:{rating:'13',descriptors:'Kekerasan'}}},'AU'),null,'An unrelated board must not become an Australian fallback');
  assert.equal(ratings.steamAgeRating({required_age:2147483647},'AU'),null,'Do not display vendor sentinel ages');
  assert.equal(ratings.normalizeRating({system:'COB-AU',label:'MA15+',descriptors:['COB-AU:StrongViolence','Online Interactivity','Violência','Kekerasan']}).descriptors,'Strong Violence, Online Interactivity');
  assert.equal(ratings.normalizeRating({system:'COB-AU',label:'R18+',rating:'r18',required_age:'15'}).value,'18','The classification code wins over inconsistent store age-gate metadata');
  assert.equal(ratings.steamAgeRating({ ratings: { pegi: fixtures.pegi } }, 'AU').regionalFallback, true);
  assert.equal(ratings.steamAgeRating({ required_age: 18 }, 'AU').system, 'AGE');
  const local = ratings.steamAgeRating({ ratings: fixtures }, 'AU');
  assert.equal(ratings.chooseRating('AU', local, { system:'PEGI', label:'18' }).system, 'COB-AU');
  const xbox = { MarketProperties:[{ContentRatings:[{RatingSystem:'COB-AU',RatingId:'COB-AU:General0'}]}] };
  assert.equal(ratings.xboxAgeRating(xbox,'AU').label,'G');
  const video = (title, preview, stream) => ({title,preview,stream});
  const videos = [video('Reveal Trailer','https://store-images.s-microsoft.com/image/reveal?w=600',null),
    video('Reveal Trailer','https://store-images.s-microsoft.com/image/reveal?w=960',null),
    video('Reveal Trailer','https://s.steamstatic.com/reveal.jpg','https://video.akamai.steamstatic.com/reveal.m3u8'),
    video('Story Trailer','https://s.steamstatic.com/story.jpg','https://video.akamai.steamstatic.com/story.m3u8')];
  assert.equal(media.uniqueVideos(videos,{playableOnly:true}).length,2);
  assert.equal(media.uniqueVideos(videos,{playableOnly:true})[0].stream,videos[2].stream);
  assert.equal(media.uniqueScreenshots(['https://s.steamstatic.com/shot.1920x1080.jpg?t=1','https://s.steamstatic.com/shot.600x338.jpg?t=2']).length,1);
  let country='AU', clock=0, searches=0, batches=0, ids=[];
  const lookup=createSteamStoreLookup({getCountry:()=>country,now:()=>clock,request:async target=>{
    const url=new URL(target);
    await new Promise(r=>setTimeout(r,5));
    if(url.pathname.includes('storesearch')) {
      searches++; assert.equal(url.searchParams.get('cc'),country);
      return {ok:true,json:async()=>({items:[1,2,3].map(id=>({id,type:'app',name:`Game ${id}`,platforms:{windows:true}}))})};
    }
    batches++;const query=JSON.parse(url.searchParams.get('input_json'));ids.push(query.ids.map(item=>item.appid));
    return {ok:true,json:async()=>({response:{store_items:query.ids.filter(x=>x.appid!==3).map(x=>({appid:x.appid,success:1,type:x.appid===2?4:0,name:`Game ${x.appid}`,is_free:true,assets:{}}))}})};
  }});
  const [first,second]=await Promise.all([lookup.search(' Test '),lookup.search('test')]);
  assert.deepEqual(first,second);assert.deepEqual(first.map(item=>item.appId),['1','3'],'A partial enrichment must retain unknown search matches and remove confirmed DLC');
  assert.equal(searches,1);assert.equal(batches,1);
  await lookup.getItems(['1','2']);assert.equal(batches,1,'Opening a searched title reuses the item cache');
  country='US';await lookup.search('test');assert.equal(searches,2,'Caches must be market-specific');
  clock=16*60*1000;await lookup.getItems(['1']);assert.equal(batches,3,'Expired details refresh');
  country='AU';const overlapping=createSteamStoreLookup({getCountry:()=>country,request:async target=>{
    batches++;const query=JSON.parse(new URL(target).searchParams.get('input_json'));ids.push(query.ids.map(item=>item.appid));
    await new Promise(r=>setTimeout(r,5));return {ok:true,json:async()=>({response:{store_items:query.ids.map(x=>({appid:x.appid,success:1,type:0,is_free:true}))}})};
  }});
  ids=[];await Promise.all([overlapping.getItems(['10','11']),overlapping.getItems(['11','12'])]);
  assert.deepEqual(ids,[[10,11],[12]],'Overlapping requests share work per App ID');
  // Exercise the real game-page merge and disk-cache boundary without any network or user profile.
  const main=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8');
  const start=main.indexOf('const detailCacheKey ='),end=main.indexOf('async function fetchOwnedDlc');
  const requests=[];
  const context={ratings,...media,path,Date,Map,Set,URL,AbortSignal,process:{env:{NEBULA_DEMO:'1'}},
    steamCountry:()=>country,gameDetailCache:new Map(),gameDetailRequests:new Map(),
    settingsPath:()=>path.join(__dirname,'fixture/settings.json'),setTimeout:()=>0,clearTimeout:()=>{},
    fs:{readFile:async()=>JSON.stringify({'steam-476600':{at:Date.now(),data:{rating:{system:'PEGI',label:'18'}}}}),writeFile:async()=>{}},
    scheduleScreenshotCache:()=>{},parseSteamRequirements:()=>[],
    consoleServices:{findXboxProduct:async()=>({rating:{system:'PEGI',label:'18'},videos:videos.slice(0,2)})},
    fetchXboxCatalogDetails:async()=>({rating:{system:'PEGI',label:'18'},screenshots:[]}),
    fetch:async target=>{requests.push(String(target));return {ok:true,json:async()=>({'476600':{success:true,data:{name:'Call of Duty: WWII',ratings:fixtures,
      screenshots:[{path_full:'https://s.steamstatic.com/shot.1920x1080.jpg?t=1'},{path_full:'https://s.steamstatic.com/shot.1920x1080.jpg?t=2'}],
      movies:[{name:'Reveal Trailer',thumbnail:'https://s.steamstatic.com/reveal.jpg',hls_h264:'https://video.akamai.steamstatic.com/reveal.m3u8'}]}}})};}};
  vm.createContext(context);vm.runInContext(main.slice(start,end),context);
  const game={id:'steam-476600',appId:'476600',title:'Call of Duty: WWII',artwork:{}};
  const [details,repeated]=await Promise.all([context.fetchGameDetails(game),context.fetchGameDetails(game)]);
  assert.equal(details.rating.system,'COB-AU');assert.equal(details.rating.label,'R18+');assert.equal(details.screenshots.length,1);assert.equal(details.videos.length,1);
  assert.equal(requests.length,1,'Prefetch and page opening share fresh metadata');assert(requests[0].includes('cc=AU'));
  assert.equal(repeated.rating.system,'COB-AU');country='US';const other=await context.fetchGameDetails(game);assert.equal(other.rating.system,'ESRB');assert.equal(requests.length,2);
  // Xbox Store uses the player market for summary ratings and coalesces localized duplicate trailers.
  country='AU';let locale='';
  const service=createConsoleServices(path.join(__dirname,'fixture/catalog'),async target=>{
    locale=new URL(target).searchParams.get('locale');return {ok:true,json:async()=>({productSummaries:[{productId:'9NKX70BBCDRN',title:'Call of Duty: WWII',contentRating:{boardName:'COB-AU',rating:'Restricted',ratingAge:18},
      videos:videos.slice(0,2).map(v=>({title:v.title,purpose:'trailer',previewImage:{url:v.preview},url:'http://legacy/manifest'}))}]})};
  },{getCountry:()=>country});
  const result=await service.findXboxProduct('Call of Duty: WWII');assert.equal(locale,'en-AU');assert.equal(result.rating.label,'R18+');assert.equal(result.videos.length,1);
  country='US';await service.findXboxProduct('Call of Duty: WWII');assert.equal(locale,'en-US');
  let xboxSearchRequests=0;
  const sharedXbox=createConsoleServices(path.join(__dirname,'fixture/catalog'),async()=>{
    xboxSearchRequests++;await new Promise(r=>setTimeout(r,5));return {ok:true,json:async()=>({productSummaries:[]})};
  },{getCountry:()=>country});
  await Promise.all([sharedXbox.searchXboxStore('test'),sharedXbox.searchXboxStore('TEST')]);
  assert.equal(xboxSearchRequests,1,'Concurrent Store searches also share Xbox requests');
  console.log('PASS regional boards, honest fallback, WWII trailer deduplication, partial Steam search, request sharing, expiry, region caches and game-page metadata merge');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
