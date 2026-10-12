const path = require('node:path');
const ALLOWED_HOSTS = new Set(['store.steampowered.com', 'login.steampowered.com', 'steamcommunity.com']);
function allowedStoreUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && ALLOWED_HOSTS.has(url.hostname); } catch { return false; }
}
function storeDestination(value) {
  if (value === 'cart') return 'https://store.steampowered.com/cart/';
  if (value === 'login') return 'https://store.steampowered.com/login/';
  if (value === 'home') return 'https://store.steampowered.com/';
  if (/^\d{1,10}$/.test(String(value))) return `https://store.steampowered.com/app/${value}/`;
  throw Error('Choose a Steam game or Store destination.');
}
function createSteamShop(window, { WebContentsView, ipcMain }) {
  let view = null;
  let lastError = '';
  const notify = extra => {
    if (extra && Object.hasOwn(extra,'error')) lastError = extra.error;
    if (!window.isDestroyed()) window.webContents.send('shop:state', { open: !!view, loading: view?.webContents.isLoading() || false, canGoBack: view?.webContents.navigationHistory.canGoBack() || false, error:lastError, ...extra });
  };
  const resize = () => {
    if (!view || window.isDestroyed()) return;
    const { width, height } = window.getContentBounds();
    const zoom = window.webContents.getZoomFactor();
    const top = Math.round(96 * zoom), bottom = Math.round(44 * zoom);
    view.setBounds({ x:0, y:top, width, height:Math.max(1,height-top-bottom) });
  };
  const close = () => {
    if (!view) return;
    const old = view; view = null;
    lastError = '';
    window.contentView.removeChildView(old);
    old.webContents.close();
    notify();
    if (!window.isDestroyed()) window.webContents.focus();
  };
  const navigate = url => {
    if (!view || !allowedStoreUrl(url)) { notify({ error:'This link is outside Steam. It was not opened.' }); return; }
    view.webContents.loadURL(url).catch(() => notify({ error:'Steam could not be loaded. Check your connection and try again.' }));
  };
  function open(destination) {
    const url = storeDestination(destination);
    if (!view) {
      view = new WebContentsView({ webPreferences: {
        partition:'persist:steam-shop', preload:path.join(__dirname,'steam-shop-preload.cjs'),
        sandbox:true, contextIsolation:true, nodeIntegration:false, webSecurity:true, backgroundThrottling:true
      } });
      const contents = view.webContents;
      const storeSession = contents.session;
      storeSession.setPermissionRequestHandler((_contents,_permission,callback) => callback(false));
      storeSession.setPermissionCheckHandler(() => false);
      storeSession.on('will-download', preventDownload);
      contents.once('destroyed', () => storeSession.removeListener('will-download', preventDownload));
      contents.on('will-navigate', (event,target) => { if (!allowedStoreUrl(target)) { event.preventDefault(); notify({ error:'For security, this Store only opens Steam pages.' }); } });
      contents.on('will-redirect', (event,target) => { if (!allowedStoreUrl(target)) { event.preventDefault(); notify({ error:'This sign-in redirect is not a Steam page.' }); } });
      contents.setWindowOpenHandler(({url:target}) => { navigate(target); return { action:'deny' }; });
      contents.on('did-start-loading', () => notify({ error:'' }));
      contents.on('did-stop-loading', () => notify());
      contents.on('did-finish-load', () => {
        if (/^(access denied|forbidden|service unavailable)$/i.test(contents.getTitle().trim())) notify({error:'Steam is unavailable or is limiting requests. Please try again later.'});
      });
      contents.on('did-fail-load', (_event,code,_description,_url,isMainFrame) => { if(isMainFrame && code!==-3) notify({ error:'Steam could not be loaded. Check your connection and try again.' }); });
      contents.on('before-input-event', (event,input) => { if(input.type==='keyDown' && input.key==='Escape') { event.preventDefault(); close(); } });
      window.contentView.addChildView(view);
    }
    resize(); navigate(url); notify();
    view.webContents.focus();
    return true;
  }
  function preventDownload(event) { event.preventDefault(); notify({ error:'Install games through your library. File downloads are disabled in the Store.' }); }
  function command(action) {
    if(action==='close') close();
    else if(action==='back' && view?.webContents.navigationHistory.canGoBack()) view.webContents.navigationHistory.goBack();
    else if(action==='reload') view?.webContents.reload();
    else if(action==='focus') view?.webContents.focus();
  }
  const remoteCommand = (event, action) => { if(view && event.sender===view.webContents && action==='close') close(); };
  ipcMain.on('shop:remote-command',remoteCommand);
  window.on('resize',resize);
  window.on('close',close);
  window.once('closed',()=>ipcMain.removeListener('shop:remote-command',remoteCommand));
  return { open, command, close, resize };
}
module.exports = { createSteamShop, allowedStoreUrl, storeDestination };
