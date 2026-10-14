// Explicit live check: --start launches only the requested Advanced Warfare test mode.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createSteamLaunch } = require('../src/steam-launch.cjs');
(async () => {
  const targets = await (await fetch('http://127.0.0.1:8080/json')).json();
  const target = targets.find(t => t.title === 'SharedJSContext');
  if (!target) throw new Error('Steam local controls unavailable');
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let next = 1;
  const pending = new Map();
  socket.onmessage = event => {
    const reply = JSON.parse(event.data), waiting = pending.get(reply.id);
    if (!waiting) return;
    pending.delete(reply.id); clearTimeout(waiting.timer);
    if (reply.error || reply.result?.exceptionDetails) waiting.reject(new Error(reply.result?.exceptionDetails?.exception?.description || 'Steam evaluation failed'));
    else waiting.resolve(reply.result?.result?.value);
  };
  const evaluate = (expression, ms = 6000) => new Promise((resolve, reject) => {
    const id = next++;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Steam timed out')); }, ms);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } }));
  });
  const launch = createSteamLaunch({ evaluate });
  const game = { id: 'steam-209660', appId: '209660', title: 'Call of Duty: Advanced Warfare - Multiplayer' };
  const trace = { choices: await launch.prepare(game), states: [], newSteamWindows: [] };
  console.log('Launch choices:', trace.choices);
  try {
    if (process.argv.includes('--start')) {
      await launch.start(game, 1);
      const end = Date.now() + 60000;
      let last = '';
      while (Date.now() < end) {
        const state = await launch.poll(game.id);
        const key = JSON.stringify([state.task, state.details, state.error, state.request, state.ended]);
        if (key !== last) { trace.states.push(state); console.log(JSON.stringify({ task: state.task, detail: state.details, error: state.error, prompt: state.request, ended: state.ended })); last = key; }
        const current = await (await fetch('http://127.0.0.1:8080/json')).json();
        trace.newSteamWindows.push(...current.filter(t => !targets.some(old => old.id === t.id)).map(t => ({ title: t.title, url: t.url })));
        if (state.ended) break;
        if (state.request) { await launch.cancel(game.id); break; }
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    const output = path.resolve(__dirname, '../.visual-review/steam-launch');
    await fs.mkdir(output, { recursive: true });
    await fs.writeFile(path.join(output, 'live-review.json'), JSON.stringify(trace, null, 2));
    console.log('Saved live launch trace.');
  } finally { await launch.cancel(game.id).catch(() => {}); socket.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
