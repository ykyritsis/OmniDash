const { BrowserWindow, session } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const { limitedText } = require('./player-profile.cjs');
const { parseBattleNetOwned, parseEaOwned, eaLibraryUrl, resolveEaInstall } = require('./launcher-libraries.cjs');
const EA_GRAPH = 'https://service-aggregation-layer.juno.ea.com/graphql';
const DEFINITIONS = {
  ea: { name:'EA app', login:'https://www.ea.com/login', home:'https://www.ea.com/sales/deals', domains:['ea.com'] },
  battlenet: { name:'Battle.net', login:'https://account.battle.net/oauth2/authorization/account-settings', home:'https://account.battle.net/overview', domains:['battle.net','blizzard.com'] }
};
function permittedAccountUrl(provider, value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && DEFINITIONS[provider]?.domains.some(domain => url.hostname === domain || url.hostname.endsWith('.' + domain)); }
  catch { return false; }
}
function createAccountLibraries(directory, getParent, demo = false, runtime = {BrowserWindow,session}) {
  const emit = (provider, phase, message, extra = {}) => runtime.onProgress?.({ provider, phase, message, ...extra });
  const sessions = new Map(), cache = new Map(), tokens = new Map(), pending = new Map(), lastStatus = new Map();
  let loginWindow = null, resetEpoch = 0;
  const file = provider => path.join(directory, `${provider}.json`);
  function definition(provider) {
    if (!Object.hasOwn(DEFINITIONS, provider)) throw Error('Unknown library');
    return DEFINITIONS[provider];
  }
  function accountSession(provider) {
    definition(provider);
    if (!sessions.has(provider)) {
      // Each publisher has its own Chromium cookie jar. No launcher preload,
      // Node access, or permission grants are ever exposed to these websites.
      const value = runtime.session.fromPartition(`persist:library-${provider}`);
      value.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
      value.setPermissionCheckHandler(() => false);
      value.on('will-download', event => event.preventDefault());
      if (provider === 'ea') value.webRequest.onBeforeSendHeaders({urls:[EA_GRAPH+'*']}, (details, callback) => {
        const header = Object.entries(details.requestHeaders).find(([key]) => key.toLowerCase() === 'authorization')?.[1];
        if (typeof header === 'string' && /^Bearer [A-Za-z0-9._~-]+$/.test(header)) tokens.set('ea', { value:header, at:Date.now() });
        callback({ requestHeaders:details.requestHeaders });
      });
      sessions.set(provider,value);
    }
    return sessions.get(provider);
  }
  async function cached(provider) {
    definition(provider);
    if (cache.has(provider)) return cache.get(provider);
    try {
      if ((await fs.stat(file(provider))).size > 16 * 1024 * 1024) throw Error('large');
      const data = JSON.parse(await fs.readFile(file(provider),'utf8'));
      if (data.version !== 1 || !Array.isArray(data.games) || data.games.length > 20000) throw Error('cache');
      cache.set(provider,data); return data;
    } catch { return null; }
  }
  async function save(provider, games, epoch) {
    if (epoch !== resetEpoch) return;
    const result = { version:1, games, at:Date.now() };
    await fs.mkdir(directory,{recursive:true});
    const temporary = file(provider)+'.tmp';
    await fs.writeFile(temporary,JSON.stringify(result));
    if (epoch !== resetEpoch) { await fs.rm(temporary,{force:true}); return; }
    await fs.rename(temporary,file(provider)); cache.set(provider,result);
  }
  function webWindow(provider, visible) {
    const def = definition(provider);
    const win = new runtime.BrowserWindow({ parent:getParent(), modal:visible, width:1060,height:780,show:false,autoHideMenuBar:true,
      title:`Sign in to ${def.name} · official website`, backgroundColor:'#171a1c',
      webPreferences:{ session:accountSession(provider), sandbox:true, nodeIntegration:false, contextIsolation:true, webSecurity:true, devTools:false } });
    const guard = (event,url) => { if (!permittedAccountUrl(provider,url)) event.preventDefault(); };
    win.webContents.on('will-navigate',guard);
    win.webContents.on('will-redirect',guard);
    win.webContents.setWindowOpenHandler(({url}) => { if(permittedAccountUrl(provider,url)) win.loadURL(url).catch(()=>{}); return {action:'deny'}; });
    win.webContents.on('will-attach-webview',event=>event.preventDefault());
    if (visible) win.once('ready-to-show',()=>{if(!win.isDestroyed())win.show();});
    return win;
  }
  async function requestJson(provider, url, init = {}) {
    const response = await accountSession(provider).fetch(url,{ ...init, signal:AbortSignal.timeout(12000), credentials:'include', redirect:'error' });
    return JSON.parse(await limitedText(response,8 * 1024 * 1024));
  }
  async function eaToken() {
    const existing=tokens.get('ea');
    if(existing && Date.now()-existing.at<15*60000) return existing.value;
    const win=webWindow('ea',false);
    try {
      win.loadURL(DEFINITIONS.ea.home).catch(()=>{});
      for(let i=0;i<20;i++) {
        await new Promise(resolve=>setTimeout(resolve,500));
        const token=tokens.get('ea');
        if(token && Date.now()-token.at<15000) return token.value;
        if(win.isDestroyed())break;
      }
      throw Error('sign-in-required');
    } finally { if(!win.isDestroyed())win.destroy(); }
  }
  async function fetchEa(authenticated) {
    const auth = await eaToken(), games = [], cursors = new Set();
    authenticated?.();
    let cursor='0';
    do {
      if(cursors.has(cursor) || cursors.size>=40) throw Error('Incomplete EA library. Try again later.');
      cursors.add(cursor);
      const page = parseEaOwned(await requestJson('ea',eaLibraryUrl(cursor),{headers:{Authorization:auth}}));
      games.push(...page.games); cursor=page.next;
    } while(cursor !== null);
    // Catalog data supplies the client content ID and registry check only.
    // A missing catalog response must not erase valid ownership information.
    for(let i=0;i<games.length;i+=50) try {
      const data=await requestJson('ea',EA_GRAPH,{method:'POST',headers:{'Content-Type':'application/json',Authorization:auth},body:JSON.stringify({
        operationName:'getLegacyCatalogDefs',query:'query getLegacyCatalogDefs($offerIds: [String!]!, $locale: Locale) { legacyOffers(offerIds: $offerIds, locale: $locale) { offerId: id contentId installCheckOverride } }',
        variables:{locale:'DEFAULT',offerIds:games.slice(i,i+50).map(game=>game.providerId)} })});
      for(const offer of data.data?.legacyOffers || []) {
        const game=games.find(game=>game.providerId===offer.offerId);
        if(!game)continue;
        if(/^[A-Za-z0-9:.\-_]{1,200}$/.test(String(offer.contentId || ''))) {
          game.launchUri=`origin2://game/launch/?offerIds=${encodeURIComponent(offer.contentId)}`;
          game.installUri=game.launchUri; game.clientOnly=false;
        }
        if(typeof offer.installCheckOverride==='string')game.installCheck=offer.installCheckOverride.slice(0,1000);
        Object.assign(game,await resolveEaInstall(game.installCheck));
      }
    } catch { /* Keep games visible with an explicit Open EA app action. */ }
    return [...new Map(games.map(game=>[game.id,game])).values()];
  }
  async function fetchBattleNet(authenticated) {
    const status = await requestJson('battlenet','https://account.battle.net/api/');
    if(status.authenticated!==true)throw Error('sign-in-required');
    authenticated?.();
    const owned=await requestJson('battlenet','https://account.battle.net/api/games-and-subs');
    const classics=await requestJson('battlenet','https://account.battle.net/api/classic-games').catch(()=>({}));
    return parseBattleNetOwned(owned,classics);
  }
  async function library(provider, force=false, authenticated) {
    definition(provider);
    if(demo)return {games:[],status:'not-connected'};
    if(pending.has(provider))return pending.get(provider);
    const work=(async()=>{
      const saved=await cached(provider), epoch=resetEpoch;
      if(!force && saved && Date.now()-saved.at<6*3600000) {
        const games=saved.games.map(game=>({...game,installed:false,installPath:undefined}));
        if(provider==='ea') for(const game of games) Object.assign(game,await resolveEaInstall(game.installCheck));
        return {games,status:'ready',at:saved.at};
      }
      try {
        const games = provider==='ea' ? await fetchEa(authenticated) : await fetchBattleNet(authenticated);
        if(epoch!==resetEpoch)return {games:[],status:'not-connected'};
        await save(provider,games,epoch);
        return {games,status:'ready',at:Date.now()};
      } catch {
        if(epoch!==resetEpoch)return {games:[],status:'not-connected'};
        return {games:saved?.games.map(game=>({...game,installed:false,installPath:undefined})) || [],status:saved?'cached-sign-in-required':'sign-in-required',at:saved?.at};
      }
    })();
    pending.set(provider,work);
    try { const result=await work;lastStatus.set(provider,result.status);return result; } finally { pending.delete(provider); }
  }
  async function connect(provider) {
    definition(provider);
    if(demo)throw Error('Account sign-in is disabled in demo mode.');
    if(loginWindow && !loginWindow.isDestroyed()) { loginWindow.focus(); throw Error('Finish the current sign-in first.'); }
    tokens.delete(provider);
    const win=loginWindow=webWindow(provider,true);
    emit(provider, 'waiting', `Waiting for ${definition(provider).name} sign-in. Complete sign-in in the window.`);
    return new Promise((resolve,reject)=>{
      let finished=false,checking=false,timer,timeout,lastAttempt=0;
      const end=(error,result)=>{
        if(finished)return;finished=true;clearInterval(timer);clearTimeout(timeout);
        if (error) resetEpoch++;
        if(!win.isDestroyed())win.destroy();loginWindow=null;
        getParent()?.focus?.();
        emit(provider, error ? 'error' : 'connected', error || `${definition(provider).name} connected. ${result.games.length} games found.`, { count: result?.games.length || 0 });
        if(error)reject(Error(error));else resolve(result);
      };
      async function check() {
        if(checking || finished || win.isDestroyed() || Date.now()-lastAttempt < 3000)return;
        const url=win.webContents.getURL();
        if(!permittedAccountUrl(provider,url))return;
        checking=true; lastAttempt=Date.now();
        try {
          let verified = false;
          const result=await library(provider,true, () => {
            if (finished) return;
            verified = true;
            win.hide?.(); getParent()?.focus?.();
            emit(provider, 'loading', `Signed in to ${definition(provider).name}. Reading your game library…`);
          });
          if (finished) return;
          if(result.status==='ready')end(null,result);
          else if (verified) end(`Signed in to ${definition(provider).name}, but its game library could not be read. Your saved games are still available. Try reconnecting later.`);
          else { if (!win.isDestroyed()) win.show?.(); emit(provider, 'waiting', `Waiting for ${definition(provider).name} sign-in. If you are signed in, the library will be checked again automatically.`); }
        }
        finally{checking=false;}
      }
      win.on('closed',()=>end('Sign-in cancelled. Your installed games are still available.'));
      win.webContents.on('did-finish-load',check);
      timer=setInterval(check,1000);
      timeout=setTimeout(()=>end('Sign-in timed out. You can try again from Game libraries.'),5*60000);
      win.loadURL(DEFINITIONS[provider].login).catch(()=>end('Could not open the official sign-in page.'));
    });
  }
  async function disconnect(provider) {
    definition(provider);resetEpoch++;
    cache.delete(provider);tokens.delete(provider);lastStatus.delete(provider);
    await pending.get(provider)?.catch(()=>{});
    await fs.rm(file(provider),{force:true}); await fs.rm(file(provider)+'.tmp',{force:true});
    if(!demo)await accountSession(provider).clearStorageData();
  }
  async function status(provider) {
    const value=await cached(provider);
    return {status:lastStatus.get(provider) || (value?'cached':'not-connected'),count:value?.games.length || 0,at:value?.at || 0};
  }
  return {connect,disconnect,library,status,cancelConnect: () => { if(loginWindow && !loginWindow.isDestroyed()) loginWindow.close(); }};
}
module.exports = {createAccountLibraries,permittedAccountUrl};
