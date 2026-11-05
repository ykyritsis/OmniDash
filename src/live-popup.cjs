// Pop-ups over a running game (achievement unlocked, a friend coming online, a download finishing), the way a
// console shows them: a small window that sits above the game, never takes focus or clicks, and leaves after a few
// seconds. It shows over borderless and windowed games; a game in exclusive full screen draws over everything.
// Each console family has its own shape and place: Xbox's pill at the bottom centre, PlayStation's card at the top
// left, Nintendo's white banner at the top right.
const { BrowserWindow, screen } = require('electron');

const FAMILY = { series: 'xbox', one: 'xbox', helix: 'xbox', aero: 'xbox', x360: 'xbox', ps3: 'ps', ps4: 'ps', ps5: 'ps', wii: 'nin', '3ds': 'nin' };
const ICONS = {
  achievement: '<path d="M7 4h10v3a5 5 0 0 1-10 0V4Zm-3 1h3v2a3 3 0 0 1-3-3Zm16 0h-3v2a3 3 0 0 0 3-3ZM10 14h4v3h3v3H7v-3h3v-3Z"/>',
  friend: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1-4.5 4.2-6.5 8-6.5s7 2 8 6.5H4Z"/>',
  download: '<path d="M11 3h2v9.6l3.3-3.3 1.4 1.4L12 16.4 6.3 10.7l1.4-1.4L11 12.6V3ZM5 18h14v2H5v-2Z"/>'
};
const esc = text => String(text ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

function page({ kind, title, detail, family }) {
  const css = {
    xbox: `body{justify-content:center;align-items:flex-end}.t{height:64px;max-width:520px;padding:0 26px 0 8px;border-radius:32px;background:#1f1f1f;box-shadow:0 10px 30px rgba(0,0,0,.5);animation:x .5s cubic-bezier(.2,.8,.2,1) both}.i{width:48px;height:48px;border-radius:50%;background:#107c10}@keyframes x{0%{clip-path:circle(32px at 40px 50%);opacity:0}30%{clip-path:circle(32px at 40px 50%);opacity:1}100%{clip-path:circle(150% at 40px 50%)}}`,
    ps: `body{justify-content:flex-start;align-items:flex-start}.t{height:70px;max-width:460px;padding:0 22px 0 12px;border-radius:10px;background:rgba(20,22,30,.94);box-shadow:0 10px 30px rgba(0,0,0,.5);animation:p .4s ease-out both}.i{width:46px;height:46px;border-radius:8px;background:#0070d1}@keyframes p{from{transform:translateX(-30px);opacity:0}to{transform:none;opacity:1}}`,
    nin: `body{justify-content:flex-end;align-items:flex-start}.t{height:66px;max-width:460px;padding:0 22px 0 10px;border-radius:33px;background:#fff;color:#333;box-shadow:0 8px 24px rgba(0,0,0,.3);animation:n .4s ease-out both}.t small{color:#777!important}.i{width:46px;height:46px;border-radius:50%;background:#2ab6e8}@keyframes n{from{transform:translateY(-20px);opacity:0}to{transform:none;opacity:1}}`
  }[family];
  return `<!doctype html><meta charset="utf-8"><style>
    html,body{margin:0;height:100%;background:transparent;overflow:hidden;font-family:"Segoe UI Variable Text","Segoe UI",system-ui,sans-serif;user-select:none;cursor:none}
    body{display:flex;padding:18px;box-sizing:border-box}
    .t{display:flex;align-items:center;gap:14px;color:#fff;box-sizing:border-box}
    .i{display:grid;place-items:center;flex:none}.i svg{width:26px;height:26px;fill:#fff}
    .c{display:grid;gap:2px;min-width:0}.c strong{font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .c small{font-size:13px;color:rgba(255,255,255,.75);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .out{transition:opacity .35s ease,transform .35s ease;opacity:0;transform:translateY(8px)}
    ${css}</style>
    <div class="t" id="t"><span class="i"><svg viewBox="0 0 24 24">${ICONS[kind] || ICONS.achievement}</svg></span><span class="c"><strong>${esc(title)}</strong>${detail ? `<small>${esc(detail)}</small>` : ''}</span></div>
    <script>
      try { const c = new AudioContext(), t = c.currentTime;
        [${family === 'ps' ? '880,1320' : family === 'nin' ? '1046,1568' : '988,1480'}].forEach((f, n) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = f; g.gain.setValueAtTime(.0001, t + n * .09); g.gain.exponentialRampToValueAtTime(.05, t + n * .09 + .01); g.gain.exponentialRampToValueAtTime(.0001, t + n * .09 + .5); o.connect(g).connect(c.destination); o.start(t + n * .09); o.stop(t + n * .09 + .55); });
      } catch {}
      setTimeout(() => document.getElementById('t').classList.add('out'), 5200);
    </script>`;
}

function createLivePopup() {
  const queue = [];
  let busy = false, win = null, idleTimer = 0;
  // One hidden window, reused for every pop-up and closed after a minute with nothing to show.
  function surface() {
    if (win && !win.isDestroyed()) return win;
    win = new BrowserWindow({
      width: 560, height: 110, frame: false, transparent: true, resizable: false, movable: false, focusable: false, skipTaskbar: true,
      alwaysOnTop: true, hasShadow: false, show: false, backgroundColor: '#00000000',
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false, autoplayPolicy: 'no-user-gesture-required' }
    });
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setIgnoreMouseEvents(true);
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.on('closed', () => { win = null; });
    return win;
  }
  async function next() {
    if (busy || !queue.length) return;
    busy = true;
    clearTimeout(idleTimer);
    const item = queue.shift();
    const family = FAMILY[item.theme] || 'xbox';
    try {
      const area = screen.getPrimaryDisplay().workArea;
      const width = 560, height = 110;
      const x = family === 'xbox' ? area.x + Math.round((area.width - width) / 2) : family === 'ps' ? area.x + 24 : area.x + area.width - width - 24;
      const y = family === 'xbox' ? area.y + area.height - height - 40 : area.y + 24;
      const view = surface();
      view.setBounds({ x, y, width, height });
      await view.loadURL(`data:text/html;charset=utf-8;base64,${Buffer.from(page({ ...item, family }), 'utf8').toString('base64')}`);
      if (!view.isDestroyed()) view.showInactive();
      await new Promise(resolve => setTimeout(resolve, 5800));
      if (!view.isDestroyed()) view.hide();
    } catch { /* A pop-up is optional. */ }
    busy = false;
    if (queue.length) setTimeout(next, 250);
    else idleTimer = setTimeout(() => { if (win && !win.isDestroyed()) win.destroy(); }, 60000);
  }
  return {
    show(item) {
      if (!item?.title) return;
      if (queue.length > 4) queue.shift();
      queue.push({ kind: String(item.kind || 'achievement'), title: String(item.title).slice(0, 80), detail: String(item.detail || '').slice(0, 120), theme: String(item.theme || 'series') });
      next();
    }
  };
}

module.exports = { createLivePopup, popupPage: page };
