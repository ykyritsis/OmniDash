const { randomUUID } = require('node:crypto');
const { steamLaunchClient } = require('./steam-launch-client.cjs');
const STAGES = {
  Starting: 'Preparing to launch', ConnectingToSteam: 'Connecting to Steam', RequestingLicense: 'Checking game ownership',
  UpdatingAppInfo: 'Checking game information', UpdatingAppTicket: 'Preparing Steam authentication',
  DownloadingDepots: 'Downloading required game updates', DownloadingWorkshop: 'Updating Workshop content',
  ProcessingInstallScript: 'Preparing first-time setup', RunningInstallScript: 'Installing required components',
  SynchronizingCloud: 'Syncing Steam Cloud saves', SynchronizingStats: 'Syncing Steam stats', SynchronizingControllerConfig: 'Preparing controller support',
  ProcessingShaderCache: 'Preparing shaders', VerifyingFiles: 'Verifying game files', UpdatingDRM: 'Preparing the game',
  WaitingPrevProcess: 'Waiting for the previous game session to close', CreatingProcess: 'Starting the game',
  WaitingGameWindow: 'Waiting for the game window', Completed: 'Game ready', Cancelled: 'Launch cancelled',
  DelayLaunch: 'Waiting for Steam', ShowLaunchOption: 'Choose what to launch', ShowEula: 'Waiting for a license agreement'
};
function normalizeChoices(raw, title) {
  const seen = new Set();
  return (Array.isArray(raw) ? raw : []).filter(option => Number.isSafeInteger(option.index) && option.index >= 0 && !seen.has(option.index) && seen.add(option.index)).map(option => {
    const labels = { '#Steam_LaunchOption_Game': title, '#Steam_LaunchOption_SafeMode': 'Safe mode', '#Steam_LaunchOption_Config': 'Configuration', '#Steam_LaunchOption_Launch': title };
    let label = String(option.label || option.gameName || title).trim();
    if (label.startsWith('#')) label = labels[label] || `${title}${option.vr ? ' (VR)' : ''} — option ${option.index + 1}`;
    return { index: option.index, label: label.slice(0, 200), vr: Boolean(option.vr) };
  });
}
function launchPrompt(request) {
  if (!request) return null;
  const cancel = { value: 'cancel', label: 'Cancel launch' };
  let title, body, options;
  switch (request.task) {
    case 'RunningInstallScript':
      title = 'A required component could not be installed';
      body = 'Steam could not finish first-time setup. You can cancel and retry, or try launching anyway.';
      options = [cancel, { value: 'IgnoreInstallError', label: 'Try launching anyway' }]; break;
    case 'SynchronizingCloud': case 'SynchronizingControllerConfig':
      title = 'Steam Cloud needs your attention';
      body = 'Steam could not safely finish syncing. Cancel to keep your saves unchanged, or review the details in Steam.';
      options = [cancel, { value: 'steam', label: 'Review in Steam' }];
      if (request.details === 'cloudconflict') {
        const date = value => value > 0 ? new Date(value * 1000).toLocaleString() : 'date unavailable';
        const noun = request.task === 'SynchronizingControllerConfig' ? 'controller settings' : 'saves';
        title = `Choose which ${noun} to keep`;
        body = `This PC and Steam Cloud have different ${noun}. Your choice replaces the other copy.\nThis PC: ${date(request.timestamps?.rtLocalTime)}\nSteam Cloud: ${date(request.timestamps?.rtRemoteTime)}`;
        options = [cancel, { value: 'KeepLocal', label: `Use this PC’s ${noun}` }, { value: 'KeepRemote', label: `Use Steam Cloud’s ${noun}` }];
      } else if (['syncfailed', 'pendingcloudsessions'].includes(request.details)) {
        body = 'Steam could not sync the latest saves. Playing now may use older progress and create a save conflict.';
        options = [cancel, { value: request.details === 'syncfailed' ? 'IgnoreCloud' : 'IgnorePendingCloudSessions', label: 'Play without syncing' }];
      }
      break;
    case 'ShowEula':
      if (request.loading) return null;
      title = 'Game license agreement';
      body = request.licenseText || 'The publisher’s agreement could not be loaded here. You can retry the launch or review it in Steam.';
      options = [cancel, request.licenseText ? { value: 'AcceptEula', label: 'Accept and continue' } : { value: 'steam', label: 'Review in Steam' }];
      break;
    case 'KickingOtherSession':
      title = 'This game is running on another device'; body = 'Continuing will end that Steam session so you can play here.';
      options = [cancel, { value: 'KickOtherSession', label: 'Play on this PC' }]; break;
    case 'ShowGameArgs':
      title = 'Launch with these arguments?'; body = request.details;
      options = [{ value: 'ShowGameArgs', label: 'Launch game' }, cancel]; break;
    case 'ShowInterstitials':
      title = 'Steam has a launch notice'; body = 'Review Steam’s notice before continuing.';
      options = [cancel, { value: 'steam', label: 'Review notice in Steam' }]; break;
    case 'ProcessingShaderCache':
      title = 'Preparing shaders'; body = 'You can wait for compilation to finish, or skip it for this launch. Skipping may cause stuttering in the game.';
      options = [{ value: 'dismiss', label: 'Keep waiting' }, { value: 'SkipShaders', label: 'Skip this time' }, cancel]; break;
    default:
      title = request.task === 'ShowEula' ? 'This game has a license agreement' : 'Steam needs your attention';
      body = request.task === 'ShowEula' ? 'Review and accept the publisher’s agreement to finish first-time setup.' : 'Steam needs an additional decision before it can launch this game.';
      options = [cancel, { value: 'steam', label: 'Review in Steam' }];
  }
  return { id: request.id, title, body, options, license: request.task === 'ShowEula' && Boolean(request.licenseText) };
}
function stageStatus(snapshot) {
  const details = String(snapshot.details || '').replace(/<[^>]*>/g, '').trim().slice(0, 300);
  return {
    text: STAGES[snapshot.task] || 'Preparing the game', detail: details,
    progress: snapshot.total > 0 ? Math.max(0, Math.min(100, Math.floor(snapshot.done / snapshot.total * 100))) : null,
    prompt: launchPrompt(snapshot.request)
  };
}
function createSteamLaunch({ evaluate }) {
  const launches = new Map();
  const call = (command, input) => evaluate(`(${steamLaunchClient.toString()})(${JSON.stringify(command)}, ${JSON.stringify(input)})`, 6000);
  async function prepare(game) {
    return normalizeChoices(await call('prepare', { appId: String(game.appId) }), game.title);
  }
  async function start(game, index, args = '') {
    const choices = await prepare(game);
    if (!choices.some(choice => choice.index === index)) throw new Error('Choose one of Steam’s available launch modes.');
    const session = { appId: String(game.appId), token: randomUUID(), startedAt: Date.now(), snapshot: null, dismissed: '' };
    const result = await call('start', { ...session, index, arguments: args });
    if (!result?.accepted) throw new Error('Steam did not accept the launch.');
    launches.set(game.id, session);
    return session;
  }
  async function poll(gameId) {
    const session = launches.get(gameId);
    if (!session) return null;
    const snapshot = await call('poll', { appId: session.appId, token: session.token });
    session.snapshot = snapshot;
    const status = stageStatus(snapshot);
    if (status.prompt?.id === session.dismissed) status.prompt = null;
    return { ...snapshot, status };
  }
  async function cancel(gameId) {
    const session = launches.get(gameId);
    if (!session) return false;
    await call('cancel', { appId: session.appId, token: session.token });
    return true;
  }
  async function respond(gameId, requestId, value) {
    const session = launches.get(gameId);
    if (!session) throw new Error('That launch has ended.');
    const snapshot = await poll(gameId);
    const prompt = launchPrompt(snapshot.request);
    if (snapshot.ended || prompt?.id !== requestId || !prompt.options.some(option => option.value === value)) throw new Error('That launch prompt has expired.');
    if (value === 'cancel') return cancel(gameId);
    if (value === 'dismiss') { session.dismissed = requestId; return true; }
    if (value === 'steam') { await call('handoff', { appId: session.appId, token: session.token }); return { handoff: true }; }
    return call('respond', { appId: session.appId, token: session.token, requestId, value });
  }
  return { prepare, start, poll, cancel, respond, has: id => launches.has(id), forget: id => launches.delete(id) };
}
module.exports = { normalizeChoices, launchPrompt, stageStatus, createSteamLaunch };
