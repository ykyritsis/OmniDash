// Runs in Steam's existing local SharedJSContext. Only the launch requested by this
// launcher is claimed; unrelated Steam launches keep Steam's normal UI and handlers.
// Steam's internal API can change. Capability checks fail closed before RunGame.
function steamLaunchClient(command, input = {}) {
  const key = '__xboxPreviewLaunchV1';
  const api = window.SteamClient?.Apps;
  if (!api?.GetLaunchOptionsForApp || !api?.RunGame || !api?.GetGameActionDetails) throw new Error('Steam launch controls are unavailable. Restart Steam and try again.');
  let bridge = window[key];
  if (!bridge) {
    let runtime;
    const chunks = window.webpackChunksteamui;
    if (!chunks?.push) throw new Error('This Steam client does not support in-app launches.');
    chunks.push([[`xbox-preview-launch-${Date.now()}`], {}, require => { runtime = require; }]);
    let store, handler;
    for (const [id, factory] of Object.entries(runtime?.m || {})) {
      const source = String(factory);
      if (!source.includes('BShouldHandleGameActions') && !source.includes('m_bLaunchOptionContinued')) continue;
      for (const value of Object.values(runtime(id))) {
        if (value?.m_mapGameActions instanceof Map && typeof value.HandleUnknownAction === 'function') store = value;
        if (typeof value === 'function' && Object.hasOwn(value.prototype || {}, 'ShowCloudIssueDialog') && Object.hasOwn(value.prototype, 'OnGameActionStart')) handler = value;
      }
    }
    if (!store || !handler || !Object.getOwnPropertyDescriptor(handler.prototype, 'OnGameActionStart')?.writable) throw new Error('This Steam version cannot hand launch prompts to the launcher yet.');
    bridge = window[key] = { store, handler, session: null, restore: null, timer: null };
  }
  const appId = String(input.appId || '');
  const options = async () => {
    const raw = await api.GetLaunchOptionsForApp(Number(appId));
    if (!Array.isArray(raw)) throw new Error('Steam did not return launch choices.');
    return raw.map(option => ({ index: option.nIndex, label: option.strDescription, gameName: option.strGameName, type: option.eType, vr: Boolean(option.bIsVRLaunchOption) }));
  };
  const readDetails = actionId => new Promise(resolve => {
    let timeout;
    const finish = data => { clearTimeout(timeout); clearTimeout(deadline); resolve(data); };
    const deadline = setTimeout(() => finish(null), 2500);
    timeout = setTimeout(async () => {
      // Steam can miss a callback during startup. Its active-action list also
      // contains the details needed to restore the native prompt handler.
      try { finish((await api.GetActiveGameActions()).find(action => action.nGameActionID === actionId) || null); }
      catch { finish(null); }
    }, 1200);
    try { api.GetGameActionDetails(actionId, finish); } catch { finish(null); }
  });
  const restore = () => { bridge.restore?.(); bridge.restore = null; clearInterval(bridge.timer); bridge.timer = null; };
  if (command === 'prepare') return options();
  if (command === 'start') return (async () => {
    if (bridge.session && !bridge.session.ended && Date.now() < bridge.session.lease) throw new Error('A Steam game is already starting.');
    const choices = await options();
    if (!choices.some(option => option.index === input.index)) throw new Error('That launch choice has changed. Choose it again.');
    const active = await api.GetActiveGameActions();
    if (active.some(action => String(action.gameid) === appId)) throw new Error('Steam is already preparing this game.');
    restore();
    const session = bridge.session = { appId, token: input.token, index: input.index, actionId: 0, task: 'Starting', details: '', request: null, error: '', ended: false, lease: Date.now() + 15000 };
    const prototype = bridge.handler.prototype;
    const original = prototype.OnGameActionStart;
    const wrapper = function (id, gameId, action, source) {
      if (String(gameId) !== appId || action !== 'LaunchApp' || bridge.session !== session || Date.now() > session.lease) return original.apply(this, arguments);
      session.actionId = id;
      this.m_nGameActionID = id;
      this.m_gameid = gameId;
      bridge.store.AddActiveLaunch(gameId, id);
      this.OnGameActionTaskChange = (_game, _action, task, details) => {
        session.task = task; session.details = String(details || ''); session.request = null;
        this.m_strTaskName = task;
      };
      this.OnGameActionUserRequest = async (_game, _action, task, details) => {
        session.task = task; session.details = String(details || '');
        if (task === 'ShowLaunchOption') { api.ContinueGameAction(id, String(session.index)); return; }
        // Steam's controller/Deck onboarding interstitial is presentation-only. Steam
        // still owns licensing, install scripts, cloud checks and process creation.
        if (task === 'CreatingProcess' || task === 'ShowInterstitials') { api.ContinueGameAction(id, task); return; }
        const request = session.request = { task, details: String(details || ''), id: `${id}:${task}:${Date.now()}` };
        if (task === 'ShowEula') {
          request.loading = true;
          try {
            const licenses = await api.LoadEula(Number(appId));
            const documents = [];
            if (!Array.isArray(licenses) || !licenses.length || licenses.length > 12) throw new Error('No agreements available');
            for (const license of licenses) {
              const url = new URL(license.url.replace(/^http:/, 'https:'));
              if (url.protocol !== 'https:' || !/(^|\.)steampowered\.com$/.test(url.hostname)) throw new Error('Unsupported agreement host');
              url.searchParams.set('json', '1');
              const response = await fetch(url.href, { credentials: 'include', signal: AbortSignal.timeout(8000) });
              if (!response.ok) throw new Error('Agreement unavailable');
              const data = await response.json();
              if (!data.content || data.content.length > 500000) throw new Error('Agreement unavailable');
              const doc = new DOMParser().parseFromString(data.content.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<\/p>/gi, '\n\n</p>'), 'text/html');
              doc.querySelectorAll('script,style').forEach(node => node.remove());
              documents.push(doc.body.textContent.trim());
            }
            if (session.request === request) { request.licenses = licenses.map(({ id, version }) => ({ id, version })); request.licenseText = documents.join('\n\n────────\n\n'); }
          } catch { request.licenseError = true; }
          finally { request.loading = false; }
        }
        if (task === 'SynchronizingCloud' && details === 'cloudconflict') {
          try { request.timestamps = await api.GetConflictingFileTimestamps(Number(appId)); } catch { /* Dates are optional. */ }
        }
      };
      this.OnGameActionShowError = (_game, _action, error, details) => { session.error = String(details || error || 'Steam could not launch this game.'); };
      this.OnGameActionShowUI = () => {};
      this.OnGameActionEnd = () => {
        session.ended = true;
        session.request = null;
        bridge.store.RemoveActiveLaunch(gameId);
        if (session.task === 'Completed') api.RaiseWindowForGame?.(gameId);
        if (bridge.session === session) restore();
      };
      // The normal manager owns this instance from here. Restore the prototype at once.
      bridge.restore?.(); bridge.restore = null;
    };
    prototype.OnGameActionStart = wrapper;
    bridge.restore = () => { if (prototype.OnGameActionStart === wrapper) prototype.OnGameActionStart = original; };
    bridge.timer = setInterval(async () => {
      if (bridge.session !== session) return;
      if (session.ended) { restore(); return; }
      if (Date.now() < session.lease) return;
      // Launcher disconnected: hand the unfinished action back to Steam instead of
      // leaving a hidden prompt or changing any global Steam preference.
      restore();
      session.ended = true;
      if (session.actionId) {
        const details = await readDetails(session.actionId);
        if (details && !['Completed', 'Cancelled', 'Failed'].includes(details.strTaskName)) {
          bridge.store.m_mapGameActions.delete(session.actionId);
          bridge.store.HandleUnknownAction(details);
        } else if (!details && session.task !== 'Completed') api.CancelGameAction(session.actionId);
      }
    }, 1000);
    try { api.RunGame(appId, String(input.arguments || ''), input.index, 0); }
    catch (error) { session.ended = true; restore(); throw error; }
    return { accepted: true, token: session.token };
  })();
  const session = bridge.session;
  if (!session || session.appId !== appId || session.token !== input.token) throw new Error('That launch is no longer active.');
  session.lease = Date.now() + 15000;
  if (command === 'poll') return (async () => {
    if (session.actionId && !session.ended) {
      const details = await readDetails(session.actionId);
      if (details) {
        session.details = String(details.strTaskDetails || session.details || '');
        session.done = Number(details.strNumDone) || 0;
        session.total = Number(details.strNumTotal) || 0;
      }
    }
    return { ...session, lease: undefined };
  })();
  if (command === 'cancel') {
    if (!session.ended) {
      if (session.actionId) api.CancelGameAction(session.actionId); else api.CancelLaunch(appId);
      session.task = 'Cancelled'; session.ended = true; session.request = null;
    }
    restore();
    return true;
  }
  if (command === 'respond') {
    if (session.ended || session.request?.id !== input.requestId) throw new Error('That launch prompt has expired.');
    if (input.value === 'AcceptEula') {
      if (!session.request.licenses?.length || !session.request.licenseText) throw new Error('The agreement is not ready.');
      for (const license of session.request.licenses) api.MarkEulaAccepted(Number(appId), license.id, license.version);
      api.ContinueGameAction(session.actionId, 'ShowEula');
      session.request = null;
      return true;
    }
    api.ContinueGameAction(session.actionId, String(input.value));
    session.request = null;
    return true;
  }
  if (command === 'handoff') return (async () => {
    const details = await readDetails(session.actionId);
    if (!details) throw new Error('Steam did not return the launch details. Try again or cancel the launch.');
    restore(); session.ended = true; session.handoff = true;
    if (details) { bridge.store.m_mapGameActions.delete(session.actionId); bridge.store.HandleUnknownAction(details); }
    return true;
  })();
  throw new Error('Unknown Steam launch operation.');
}
module.exports = { steamLaunchClient };
