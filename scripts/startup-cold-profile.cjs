// Cold-start resource detail: run with a fresh userData dir each time and report the resources that
// delay the load event, plus renderer startup phase timings. Written to .visual-review.
// Run: node_modules\electron\dist\electron.exe scripts\startup-cold-profile.cjs
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const stamp = process.env.GARRISON_RUN || String(Date.now());
const output = path.resolve(__dirname, '../.visual-review', process.env.GARRISON_OUT || 'startup-cold');
process.env.NEBULA_DEMO = '1';
process.env.NEBULA_REVIEW = '1';
process.env.NEBULA_DEMO_USER_DATA = path.join(output, 'profile-' + stamp);
if (process.env.GARRISON_GPU !== '1') app.disableHardwareAcceleration();

app.on('browser-window-created', (_event, win) => {
  const wc = win.webContents;
  wc.once('did-finish-load', async () => {
    try {
      await fs.mkdir(output, { recursive: true });
      // Let late images finish so we can see everything that was requested.
      await new Promise(r => setTimeout(r, 1500));
      const detail = await wc.executeJavaScript(`(()=>{
        const nav = performance.getEntriesByType('navigation')[0] || {};
        const res = performance.getEntriesByType('resource').map(e => ({
          name: e.name.replace(/^.*[\\\\/]/, '').slice(0, 80),
          type: e.initiatorType,
          startMs: Math.round(e.startTime),
          endMs: Math.round(e.responseEnd),
          durationMs: Math.round(e.duration)
        }));
        const byType = {};
        for (const r of res) { byType[r.type] = byType[r.type] || { count: 0, totalMs: 0 }; byType[r.type].count++; byType[r.type].totalMs += r.durationMs; }
        const slowest = [...res].sort((a, b) => b.durationMs - a.durationMs).slice(0, 15);
        const latest = [...res].sort((a, b) => b.endMs - a.endMs).slice(0, 15);
        return {
          domInteractiveMs: Math.round(nav.domInteractive || 0),
          domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd || 0),
          loadEventMs: Math.round(nav.loadEventEnd || 0),
          firstPaintMs: Math.round((performance.getEntriesByType('paint')[0] || {}).startTime || 0),
          resourceCount: res.length,
          byType, slowest, latest
        };
      })()`);
      await fs.writeFile(path.join(output, 'cold-' + stamp + '.json'), JSON.stringify(detail, null, 2));
      console.log('RUN ' + stamp + ' ' + JSON.stringify({
        domInteractiveMs: detail.domInteractiveMs,
        loadEventMs: detail.loadEventMs,
        resourceCount: detail.resourceCount,
        byType: detail.byType,
        slowest: detail.slowest.slice(0, 6),
        latest: detail.latest.slice(0, 6)
      }, null, 2));
      app.exit(0);
    } catch (error) {
      console.error(error);
      app.exit(1);
    }
  });
});

require('../src/main.cjs');
