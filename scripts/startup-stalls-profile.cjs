// Start-up stall profiler: installs a long-task observer immediately after the BrowserWindow is
// created (before the page loads), then reports total main-thread blocking, the worst stalls and a
// coarse timeline. Written to .visual-review. Run with the Electron binary, not node.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const stamp = process.env.GARRISON_RUN || String(Date.now());
const output = path.resolve(__dirname, '../.visual-review', process.env.GARRISON_OUT || 'startup-stalls');
process.env.NEBULA_DEMO = '1';
process.env.NEBULA_REVIEW = '1';
process.env.NEBULA_DEMO_USER_DATA = path.join(output, 'profile-' + stamp);
if (process.env.GARRISON_GPU !== '1') app.disableHardwareAcceleration();

const installObserver = `
  window.__stallProbe = { tasks: [] };
  try {
    new PerformanceObserver(list => {
      for (const entry of list.getEntries()) {
        window.__stallProbe.tasks.push({
          startMs: Math.round(entry.startTime),
          durationMs: Math.round(entry.duration),
          attribution: (entry.attribution || []).map(a => a.name || a.containerType || '').filter(Boolean).join(',')
        });
      }
    }).observe({ entryTypes: ['longtask'] });
  } catch (error) { window.__stallProbe.error = String(error); }
`;

app.on('browser-window-created', (_event, win) => {
  const wc = win.webContents;
  // Runs before the document starts loading because navigation has not been requested yet.
  wc.executeJavaScript(installObserver).catch(() => {});
  wc.once('did-finish-load', async () => {
    try {
      await fs.mkdir(output, { recursive: true });
      await new Promise(r => setTimeout(r, 1200));
      const report = await wc.executeJavaScript(`(()=>{
        const nav = performance.getEntriesByType('navigation')[0] || {};
        const tasks = (window.__stallProbe && window.__stallProbe.tasks) || [];
        const totalBlocking = tasks.reduce((sum, t) => sum + Math.max(0, t.durationMs - 50), 0);
        return {
          probeError: window.__stallProbe && window.__stallProbe.error || null,
          domInteractiveMs: Math.round(nav.domInteractive || 0),
          domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd || 0),
          loadEventMs: Math.round(nav.loadEventEnd || 0),
          longTaskCount: tasks.length,
          totalBlockingMs: Math.round(totalBlocking),
          worst: tasks.slice().sort((a, b) => b.durationMs - a.durationMs).slice(0, 12),
          timeline: tasks.slice().sort((a, b) => a.startMs - b.startMs).map(t => t.startMs + '+' + t.durationMs)
        };
      })()`);
      await fs.writeFile(path.join(output, 'stalls-' + stamp + '.json'), JSON.stringify(report, null, 2));
      console.log(JSON.stringify(report, null, 2));
      app.exit(0);
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
});

require('../src/main.cjs');
