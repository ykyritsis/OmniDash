const fs = require('node:fs/promises');
const path = require('node:path');
const { allowedStoreUrl } = require('./steam-shop.cjs');
const TTL = 6 * 60 * 60 * 1000;
const validSteamId = id => /^7656119\d{10}$/.test(String(id));

function tokenAccount(token) {
  try {
    if (typeof token !== 'string' || token.length > 12000) return '';
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    return validSteamId(claims.sub) && Number(claims.exp) * 1000 > Date.now() ? String(claims.sub) : '';
  } catch { return ''; }
}

function credentialFromCookies(cookies) {
  for (const cookie of Array.isArray(cookies) ? cookies : []) {
    if (cookie.name !== 'steamLoginSecure' || typeof cookie.value !== 'string') continue;
    try {
      const value = decodeURIComponent(cookie.value);
      const separator = value.indexOf('||');
      if (separator < 1) continue;
      const steamId = value.slice(0, separator), token = value.slice(separator + 2);
      if (validSteamId(steamId) && tokenAccount(token) === steamId) return { steamId, token };
    } catch { /* Ignore malformed cookies and continue to the next Steam domain. */ }
  }
  return { steamId: '', token: '' };
}

function familyGames(apps, steamId) {
  const games = new Map();
  for (const item of Array.isArray(apps) ? apps.slice(0, 30000) : []) {
    const appId = String(item.appid || '');
    const title = typeof item.name === 'string' ? item.name.trim().slice(0, 300) : '';
    const owners = Array.isArray(item.owner_steamids) ? item.owner_steamids.map(String).filter(validSteamId) : [];
    // Excluded shares, DLC, tools and other non-games are not launchable copies.
    if (!/^\d{1,10}$/.test(appId) || !title || !owners.length || Number(item.exclude_reason || 0) !== 0
      || (item.app_type != null && Number(item.app_type) !== 1) || appId === '228980') continue;
    const owned = owners.includes(steamId);
    games.set(appId, { id: `steam-${appId}`, appId, title, provider: 'Steam', installed: false,
      steamOwned: owned, steamFamilyShared: !owned,
      steamPlaytimeMinutes: Math.max(0, Number(item.rt_playtime) || 0),
      steamLastPlayed: Math.max(0, Number(item.rt_last_played) || 0) * 1000,
      addedAt: Math.max(0, Number(item.rt_time_acquired) || 0) * 1000,
      launchUri: `steam://rungameid/${appId}` });
  }
  return [...games.values()];
}

function createSteamFamilyLibrary(directory, parent, { demo = false, sessionFor, Window, onProgress = () => {} } = {}) {
  const emit = (phase, message, extra = {}) => onProgress({ provider: 'steam-family', phase, message, ...extra });
  const target = path.join(directory, 'library.json');
  const browserSession = () => sessionFor ? sessionFor() : require('electron').session.fromPartition('persist:steam-shop');
  let pending = null, login = null, generation = 0, lastStatus = '';
  async function read(expectedId = '') {
    try {
      if ((await fs.stat(target)).size > 12 * 1024 * 1024) return null;
      const saved = JSON.parse(await fs.readFile(target, 'utf8'));
      if (!validSteamId(saved.steamId) || (expectedId && saved.steamId !== expectedId) || !Array.isArray(saved.games) || saved.games.length > 30000) return null;
      return { steamId: saved.steamId, at: Number(saved.at) || 0, status:saved.status === 'no-family' ? 'no-family' : 'cached', games: saved.games.filter(game => /^\d{1,10}$/.test(game.appId) && typeof game.title === 'string')
        .map(game => ({ id: `steam-${game.appId}`, appId: game.appId, title: game.title.slice(0,300), provider: 'Steam', installed: false,
          steamOwned: game.steamOwned === true, steamFamilyShared: game.steamFamilyShared === true,
          steamPlaytimeMinutes: Number(game.steamPlaytimeMinutes) || 0, steamLastPlayed: Number(game.steamLastPlayed) || 0,
          addedAt: Number(game.addedAt) || 0, launchUri: `steam://rungameid/${game.appId}` })) };
    } catch { return null; }
  }
  async function json(url) {
    const response = await browserSession().fetch(url, { credentials: 'include', redirect: 'error', signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw Error(response.status === 401 || response.status === 403 ? 'sign-in-required' : 'unavailable');
    const text = await response.text();
    if (text.length > 10 * 1024 * 1024) throw Error('unavailable');
    try { return JSON.parse(text); } catch { throw Error('sign-in-required'); }
  }
  async function fetchLibrary(expectedId, authenticated) {
    // Use only the app's own Steam web session. No client credential files,
    // passwords or raw session tokens are read, saved or sent to the renderer.
    let token = '', steamId = '', configFailed = false;
    try {
      const config = await json('https://store.steampowered.com/pointssummary/ajaxgetasyncconfig');
      token = config.webapi_token || '';
      steamId = tokenAccount(token);
    } catch { configFailed = true; /* Some Steam sessions expose the web API token only in their auth cookie. */ }
    if (!steamId) {
      const cookies = await Promise.all(['https://store.steampowered.com', 'https://steamcommunity.com']
        .map(url => browserSession().cookies?.get({ url }).catch(() => []) || Promise.resolve([])));
      const credential = credentialFromCookies(cookies.flat());
      token = credential.token;
      steamId = credential.steamId;
    }
    if (!steamId) throw Error(configFailed ? 'unavailable' : 'sign-in-required');
    if (!token) {
      if (expectedId && steamId !== expectedId) throw Error('account-mismatch');
      authenticated?.();
      throw Error('family-token-unavailable');
    }
    if (expectedId && steamId !== expectedId) throw Error('account-mismatch');
    authenticated?.();
    async function api(method, input) {
      const url = new URL(`https://api.steampowered.com/IFamilyGroupsService/${method}/v1/`);
      url.searchParams.set('access_token', token);
      url.searchParams.set('input_json', JSON.stringify(input));
      const body = await json(url.href);
      if (!body.response || typeof body.response !== 'object') throw Error('unavailable');
      return body.response;
    }
    const family = await api('GetFamilyGroupForUser', { steamid: steamId, include_family_group_response: false });
    if (family.is_not_member_of_any_group || !/^\d+$/.test(String(family.family_groupid || '')) || String(family.family_groupid) === '0')
      return { steamId, games: [], status: 'no-family', at: Date.now() };
    const shared = await api('GetSharedLibraryApps', { family_groupid: String(family.family_groupid), include_own: true,
      include_excluded: false, include_non_games: false, language: 'english', max_apps: 30000 });
    if (!Array.isArray(shared.apps)) throw Error('unavailable');
    return { steamId, games: familyGames(shared.apps, steamId), status: 'ready', at: Date.now() };
  }
  async function library(expectedId = '', force = false, authenticated) {
    const epoch = generation;
    const cached = await read(expectedId);
    if (demo) return { games: [], status: 'not-connected' };
    if (!force && !cached) return { games: [], status: 'not-connected' };
    if (!force && /account-mismatch/.test(lastStatus)) return {games:[],status:lastStatus};
    if (!force && Date.now() - cached.at < TTL) return { ...cached, status: lastStatus || cached.status };
    if (pending) { await pending; return library(expectedId, false); }
    pending = (async () => {
      try {
        const result = await fetchLibrary(expectedId, authenticated);
        if (epoch !== generation) return { games: [], status: 'cancelled' };
        await fs.mkdir(directory, { recursive: true });
        const temporary = `${target}.tmp`;
        await fs.writeFile(temporary, JSON.stringify({ steamId: result.steamId, at: result.at, status:result.status, games: result.games }), 'utf8');
        if (epoch !== generation) { await fs.rm(temporary, { force:true }); return {games:[],status:'cancelled'}; }
        await fs.rename(temporary, target);
        lastStatus = result.status;
        return result;
      } catch (error) {
        if(epoch!==generation)return {games:[],status:'cancelled'};
        const status = ['sign-in-required','account-mismatch'].includes(error.message) ? error.message : 'unavailable';
        lastStatus = cached ? `cached-${status}` : status;
        // Never reuse an old account's shared library when a different account
        // is now signed into the app's Steam browser.
        return { ...(status === 'account-mismatch' ? {} : cached || {}), games: status === 'account-mismatch' ? [] : cached?.games || [], status: lastStatus };
      }
    })();
    try { return await pending; } finally { pending = null; }
  }
  async function status(expectedId = '') {
    const cached = await read(expectedId);
    return { status: cached ? lastStatus || cached.status : 'not-connected', count: cached?.games.filter(game=>game.steamFamilyShared).length || 0, at: cached?.at || 0 };
  }
  async function connect(expectedId = '') {
    emit('waiting', 'Waiting for Steam sign-in. Complete sign-in in the Steam window.');
    if (demo) throw Error('Steam sign-in is disabled in demo mode.');
    const connectEpoch=generation;
    const initial = await library(expectedId, true);
    if(connectEpoch!==generation)throw Error('Steam Family connection cancelled.');
    if (['ready','no-family'].includes(initial.status)) {emit('connected', initial.status === 'no-family' ? 'Steam connected. This account is not in a Steam Family.' : `Steam Family connected. ${initial.games.filter(game=>game.steamFamilyShared).length} shared games found.`);return initial;}
    if (login && !login.isDestroyed()) { login.focus(); throw Error('Finish the current Steam sign-in first.'); }
    const Constructor = Window || require('electron').BrowserWindow;
    const win = login = new Constructor({ width:1000,height:760,parent:parent(), title:'Connect Steam Family',autoHideMenuBar:true,
      backgroundColor:'#171a21',webPreferences:{ session:browserSession(), sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true } });
    const contents = win.webContents, session = contents.session;
    session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
    session.setPermissionCheckHandler(()=>false);
    const preventDownload = event => event.preventDefault();
    session.on('will-download', preventDownload);
    for (const eventName of ['will-navigate','will-redirect']) contents.on(eventName,(event,url)=>{ if(!allowedStoreUrl(url))event.preventDefault(); });
    contents.setWindowOpenHandler(({url})=>{if(allowedStoreUrl(url))contents.loadURL(url).catch(()=>{});return {action:'deny'};});
    return new Promise((resolve,reject)=>{
      let finished=false,checking=false,lastCheck=0,timer,timeout;
      const epoch=generation;
      const end=(error,result)=>{
        if(finished)return;finished=true;clearInterval(timer);clearTimeout(timeout);
        if(error)generation++;
        session.removeListener('will-download',preventDownload);
        if(!win.isDestroyed())win.destroy();login=null;
        parent()?.focus?.();
        emit(error ? 'error' : 'connected', error || (result.status === 'no-family' ? 'Steam connected. This account is not in a Steam Family.' : `Steam Family connected. ${result.games.filter(game => game.steamFamilyShared).length} shared games found.`));
        if(error)reject(Error(error));else resolve(result);
      };
      const check=async()=>{
        if(finished||checking||Date.now()-lastCheck<1000||!allowedStoreUrl(contents.getURL()))return;
        checking=true;lastCheck=Date.now();
        try {
          let verified = false;
          const result=await library(expectedId,true, () => { if(!finished){verified=true;win.hide?.();parent()?.focus?.();emit('loading','Signed in to Steam. Reading your Family library…');} });
          if(finished||epoch!==generation)return;
          if(['ready','no-family'].includes(result.status))end(null,result);
          else if(verified)end('Steam sign-in completed, but Steam did not provide a Family access token. Your saved games remain available. Reopen the Family connection and try again.');
          else if(/account-mismatch/.test(result.status)) { win.setTitle('Steam Family — sign in with your desktop Steam account');emit('waiting','Sign in with the same Steam account as your desktop Steam client.'); }
          else {win.show?.();emit('waiting','Waiting for Steam sign-in. The library will be checked again automatically.');}
        } finally { checking=false; }
      };
      win.on('closed',()=>end('Steam Family sign-in cancelled.'));
      contents.on('did-finish-load',check);
      contents.on('before-input-event',(event,input)=>{if(input.type==='keyDown'&&input.key==='Escape'){event.preventDefault();end('Steam Family sign-in cancelled.');}});
      timer=setInterval(check,2000);timeout=setTimeout(()=>end('Steam sign-in timed out. Try again in Game libraries.'),5*60000);
      contents.loadURL('https://store.steampowered.com/login/?redir=account%2Ffamilymanagement').catch(()=>end('Could not open Steam. Check your connection.'));
    });
  }
  async function disconnect() {
    generation++;lastStatus='';
    if(login&&!login.isDestroyed())login.close();
    if(pending)await pending;
    await fs.rm(target,{force:true});
  }
  return { library,status,connect,disconnect,cancelConnect: () => { if(login&&!login.isDestroyed())login.close(); } };
}

module.exports = { createSteamFamilyLibrary, familyGames, tokenAccount, credentialFromCookies };
