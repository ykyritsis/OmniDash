const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createSteamLaunch, normalizeChoices, stageStatus, launchPrompt } = require('../src/steam-launch.cjs');
function fixture() {
  const context = vm.createContext({ setTimeout, clearTimeout, console });
  vm.runInContext(`
    window = globalThis; interval = null; continued = []; cancelled = []; nativeStarts = []; handed = [];
    setInterval = fn => { interval = fn; return 1; }; clearInterval = () => { interval = null; };
    class Handler {
      ShowCloudIssueDialog() {}
      OnGameActionStart(...args) { nativeStarts.push(args); }
    }
    originalStart = Handler.prototype.OnGameActionStart;
    store = { m_mapGameActions: new Map(), AddActiveLaunch() {}, RemoveActiveLaunch() {}, HandleUnknownAction(d) { handed.push(d); } };
    function factory() { /* BShouldHandleGameActions m_bLaunchOptionContinued */ }
    function runtime() { return { store, Handler }; } runtime.m = { test: factory };
    webpackChunksteamui = { push: a => a[2](runtime) };
    SteamClient = { Apps: {
      GetLaunchOptionsForApp: async () => [{nIndex:0,strDescription:'#Steam_LaunchOption_Game'}, {nIndex:2,strDescription:'Exo Zombies'}],
      GetActiveGameActions: async () => [],
      RunGame: (app,args,index) => { runArgs = [app,args,index]; handler = new Handler(); handler.OnGameActionStart(7,app,'LaunchApp',0); store.m_mapGameActions.set(7,handler); },
      GetGameActionDetails: (id,callback) => callback({nGameActionID:id,gameid:'209660',strTaskName:window.__xboxPreviewLaunchV1.session.task}),
      ContinueGameAction: (id,value) => continued.push([id,value]), CancelGameAction: id => cancelled.push(id), CancelLaunch: id => cancelled.push(id),
      RaiseWindowForGame() {}, GetConflictingFileTimestamps: async () => ({rtLocalTime:100,rtRemoteTime:200}), LoadEula: async () => []
    } };
    task = (name, detail='') => handler.OnGameActionTaskChange('209660','LaunchApp',name,detail);
    request = (name, detail='') => handler.OnGameActionUserRequest('209660','LaunchApp',name,detail);
  `, context);
  return { context, launch: createSteamLaunch({ evaluate: expression => vm.runInContext(expression, context) }), run: code => vm.runInContext(code, context) };
}
(async () => {
  const game = { id: 'test', appId: '209660', title: 'Advanced Warfare' };
  assert.deepEqual(normalizeChoices([{ index: 2, label: 'Zombies' }, { index: 2 }, { index: -1 }], 'Game'), [{ index: 2, label: 'Zombies', vr: false }]);
  const { launch, run } = fixture();
  assert.equal((await launch.prepare(game))[0].label, game.title);
  await assert.rejects(launch.start(game, 1), /available launch modes/);
  await launch.start(game, 2, '-window');
  assert.equal(run('runArgs[2]'), 2);
  assert.equal(run('Handler.prototype.OnGameActionStart === originalStart'), true, 'restore global handler immediately');
  run("new Handler().OnGameActionStart(8,'999','LaunchApp',0)");
  assert.equal(run('nativeStarts.length'), 1, 'other games retain native behavior');
  await run("request('ShowLaunchOption')");
  assert.equal(run('continued[0][1]'), '2', 'preserve nonconsecutive Steam option IDs');
  run("task('RunningInstallScript','Installing DirectX')");
  let status = await launch.poll(game.id);
  assert.equal(status.ended, false);
  assert.equal(status.status.text, 'Installing required components');
  assert.equal(status.status.prompt, null, 'normal setup is not a failure prompt');
  await run("request('RunningInstallScript')");
  status = await launch.poll(game.id);
  await assert.rejects(launch.respond(game.id, 'old', 'IgnoreInstallError'), /expired/);
  await assert.rejects(launch.respond(game.id, status.request.id, 'KeepRemote'), /expired/);
  await launch.respond(game.id, status.request.id, 'IgnoreInstallError');
  assert.equal(run('continued.at(-1)[1]'), 'IgnoreInstallError');
  await run("request('SynchronizingCloud','cloudconflict')");
  status = await launch.poll(game.id);
  assert.ok(status.status.prompt.body.includes('replaces the other copy'));
  assert.equal(status.status.prompt.options[0].value, 'cancel');
  await launch.respond(game.id, status.request.id, 'KeepLocal');
  await run("request('ShowEula')");
  status = await launch.poll(game.id);
  assert.ok(!status.status.prompt.options.some(o => o.value === 'AcceptEula'), 'unreadable agreements cannot be accepted');
  run("task('Completed'); handler.OnGameActionEnd()");
  assert.equal((await launch.poll(game.id)).ended, true);
  await launch.cancel(game.id);
  assert.equal(run('cancelled.length'), 0, 'cancel after completion does not stop a running game');
  await launch.start(game, 0);
  await launch.cancel(game.id);
  assert.equal((await launch.poll(game.id)).task, 'Cancelled');
  await launch.start(game, 0);
  run("task('RunningInstallScript'); window.__xboxPreviewLaunchV1.session.lease = 0");
  await run('interval()');
  assert.equal(run('handed.length'), 1, 'disconnection returns the unfinished action to Steam');
  assert.equal(stageStatus({ task: 'DownloadingDepots', done: 25, total: 100 }).progress, 25);
  assert.equal(launchPrompt({ task: 'ShowEula', loading: true }), null);
  console.log('Steam launch tests passed: exact modes, scope, prerequisites, cloud prompts, cancellation and disconnect recovery.');
})().catch(error => { console.error(error); process.exitCode = 1; });
