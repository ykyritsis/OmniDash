const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {EventEmitter}=require('node:events');
const {createSteamFamilyLibrary,familyGames,tokenAccount,credentialFromCookies}=require('../src/steam-family.cjs');
const me='76561198000000001',other='76561198000000002';
const token=id=>`header.${Buffer.from(JSON.stringify({sub:id,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.signature`;
const apps=[{appid:10,name:'Shared game',owner_steamids:[other],rt_playtime:42,rt_last_played:100},
  {appid:20,name:'Owned game',owner_steamids:[me,other]},
  {appid:30,name:'Excluded',owner_steamids:[other],exclude_reason:2},
  {appid:40,name:'DLC',owner_steamids:[other],app_type:32},
  {appid:228980,name:'Steamworks common redistributables',owner_steamids:[other]},
  {appid:'unsafe/1',name:'Invalid',owner_steamids:[other]},
  {appid:50,name:'No owners'},
  {appid:10,name:'Shared game',owner_steamids:[other],rt_playtime:42,rt_last_played:100}];
assert.equal(tokenAccount(token(me)),me);assert.equal(tokenAccount('invalid'),'');
assert.deepEqual(credentialFromCookies([{name:'steamLoginSecure',value:encodeURIComponent(`${me}||${token(me)}`)}]),{steamId:me,token:token(me)});
assert.equal(credentialFromCookies([{name:'steamLoginSecure',value:'expired'}]).steamId,'');
const games=familyGames(apps,me);assert.equal(games.length,2);assert.equal(games[0].steamFamilyShared,true);assert.equal(games[0].steamLastPlayed,100000);assert.equal(games[1].steamOwned,true);
(async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'xbox-family-test-'));
  let signed=me,fail=false,calls=0,delay=null,cookieOnly=false;
  const browserSession={cookies:{get:async()=>cookieOnly?[{name:'steamLoginSecure',value:encodeURIComponent(`${signed}||${token(signed)}`)}]:[]},fetch:async(url)=>{
    calls++;
    if(fail)throw Error('offline');
    if(delay)await delay;
    const parsed=new URL(url);
    const body=parsed.pathname.includes('ajaxgetasyncconfig')?{webapi_token:cookieOnly?'':token(signed)}
      :parsed.pathname.includes('GetFamilyGroupForUser')?{response:{family_groupid:'1234'}}:{response:{apps}};
    if(parsed.hostname==='api.steampowered.com') {
      assert.equal(tokenAccount(parsed.searchParams.get('access_token')),signed);
      if(parsed.pathname.includes('GetSharedLibraryApps'))assert.equal(JSON.parse(parsed.searchParams.get('input_json')).include_excluded,false);
    }
    return {ok:true,text:async()=>JSON.stringify(body)};
  }};
  try {
    const loginDirectory=path.join(directory,'login');let authenticated=false,loginWindow=null,loginState=null;
    class MockWindow extends EventEmitter {
      constructor(options){super();loginWindow=this;this.destroyed=false;this.url='';this.webContents=new EventEmitter();this.webContents.session=options.webPreferences.session;this.webContents.getURL=()=>this.url;this.webContents.setWindowOpenHandler=()=>{};this.webContents.loadURL=async url=>{this.url=url;};}
      isDestroyed(){return this.destroyed;}hide(){}show(){}focus(){}setTitle(){}
      destroy(){if(!this.destroyed){this.destroyed=true;this.emit('closed');}}
    }
    const loginSession=new EventEmitter();loginSession.cookies={get:async()=>authenticated?[{name:'steamLoginSecure',value:encodeURIComponent(`${me}||${token(me)}`)}]:[]};loginSession.setPermissionRequestHandler=()=>{};loginSession.setPermissionCheckHandler=()=>{};loginSession.fetch=async url=>{const parsed=new URL(url);const body=parsed.pathname.includes('ajaxgetasyncconfig')?{webapi_token:authenticated?'':undefined}:parsed.pathname.includes('GetFamilyGroupForUser')?{response:{family_groupid:'1234'}}:{response:{apps}};return {ok:true,text:async()=>JSON.stringify(body)};};
    const loginFlow=createSteamFamilyLibrary(loginDirectory,()=>null,{sessionFor:()=>loginSession,Window:MockWindow,onProgress:data=>{loginState=data;}});
    const connecting=loginFlow.connect();for(let i=0;i<30&&!loginWindow;i++)await new Promise(resolve=>setTimeout(resolve,10));assert.ok(loginWindow,'Steam login window opens when no signed-in session exists');
    authenticated=true;loginWindow.url='https://store.steampowered.com/account/familymanagement';loginWindow.webContents.emit('did-finish-load');
    const loginResult=await connecting;assert.equal(loginResult.status,'ready');assert.equal(loginWindow.destroyed,true,'the Steam login window closes after authenticated Family library completion');assert.equal(loginState.phase,'connected');
    const family=createSteamFamilyLibrary(directory,()=>null,{sessionFor:()=>browserSession});
    assert.equal((await family.library(me)).status,'not-connected');assert.equal(calls,0);
    const imported=await family.library(me,true);assert.equal(imported.status,'ready');assert.equal(imported.games.length,2);
    cookieOnly=true;const cookieLibrary=await family.library(me,true);assert.equal(cookieLibrary.status,'ready');assert.equal(cookieLibrary.games.length,2,'authenticated session cookie can finish the Family connection when the points-summary token is empty');cookieOnly=false;
    const persisted=await fs.readFile(path.join(directory,'library.json'),'utf8');
    assert.ok(!persisted.includes('access_token')&&!persisted.includes('owner_steamids')&&!persisted.includes(token(me)));
    const before=calls;await family.library(me);assert.equal(calls,before);
    fail=true;const cached=await family.library(me,true);assert.equal(cached.status,'cached-unavailable');assert.equal(cached.games.length,2);
    assert.equal((await family.library(other)).games.length,0);
    fail=false;signed=other;assert.equal((await family.library(me,true)).games.length,0);assert.equal((await family.library(me)).games.length,0);
    signed=me;let release;delay=new Promise(resolve=>release=resolve);
    const refreshing=family.library(me,true);await new Promise(resolve=>setTimeout(resolve,15));const disconnect=family.disconnect();release();await disconnect;assert.equal((await refreshing).status,'cancelled');
    await assert.rejects(fs.access(path.join(directory,'library.json')));
    console.log('PASS Steam Family shared/owned/excluded games, Steam session scope, account isolation, offline cache, token privacy and disconnect race');
  }finally{await fs.rm(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
