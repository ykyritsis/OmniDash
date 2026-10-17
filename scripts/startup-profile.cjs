// Startup profiler: measures launcher start-up with no synthetic library, in demo mode.
// Reports process/Electron phase timings, renderer navigation+paint timings, how many separate
// resources the renderer loads, and the first-render cost. Writes JSON to .visual-review.
// Run: node_modules\electron\dist\electron.exe scripts\startup-profile.cjs
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const t0 = Number(process.env.GARRISON_T0 || 0) || Date.now();
const output = path.resolve(__dirname, '../.visual-review', process.env.GARRISON_OUT || 'startup-profile');
process.env.NEBULA_DEMO = '1';
process.env.NEBULA_REVIEW = '1';
process.env.NEBULA_DEMO_USER_DATA = path.join(output, 'profile');

const marks = { processStartAt: t0 };
mark('mainModuleLoaded');

function mark(name) { marks[name] = Date.now(); }
const since = name => (marks[name] ? marks[name] - marks.processStartAt : null);

if (process.env.GARRISON_GPU !== '1') app.disableHardwareAcceleration();

app.whenReady().then(() => { mark('appReady'); });
app.on('browser-window-created', (_event, win) => {
  mark('windowCreated');
  const wc = win.webContents;

  wc.on('did-start-loading', () => mark('didStartLoading'));
  wc.on('dom-ready', () => mark('domReady'));
  wc.on('did-finish-load', () => mark('didFinishLoad'));

  wc.once('did-finish-load', async () => {
    try {
      await fs.mkdir(output, { recursive: true });
      // Wait for the launcher's own first paint to settle, then ask the renderer how long it took.
      const rendererTiming = await wc.executeJavaScript(`(()=>{
        const nav = performance.getEntriesByType('navigation')[0] || {};
        const paint = performance.getEntriesByType('paint') || [];
        const firstPaint = paint.find(p => p.name === 'first-paint');
        const firstContentfulPaint = paint.find(p => p.name === 'first-contentful-paint');
        const resources = performance.getEntriesByType('resource');
        const byType = {};
        for (const r of resources) byType[r.initiatorType] = (byType[r.initiatorType] || 0) + 1;
        return {
          domInteractiveMs: Math.round(nav.domInteractive || 0),
          domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd || 0),
          loadEventEndMs: Math.round(nav.loadEventEnd || 0),
          firstPaintMs: firstPaint ? Math.round(firstPaint.startTime) : null,
          firstContentfulPaintMs: firstContentfulPaint ? Math.round(firstContentfulPaint.startTime) : null,
          resourceCount: resources.length,
          resourceByType: byType,
          transferredKb: Math.round(resources.reduce((sum, r) => sum + (r.transferSize || 0), 0) / 1024),
          decodedBodyKb: Math.round(resources.reduce((sum, r) => sum + (r.decodedBodySize || 0), 0) / 1024),
          scriptTags: document.querySelectorAll('script[src]').length,
          styleSheets: document.styleSheets.length,
          domNodes: document.getElementsByTagName('*').length,
          readyState: document.readyState
        };
      })()`);

      const processMetrics = app.getAppMetrics().map(m => ({
        type: m.type, pid: m.pid,
        cpuPercent: Math.round((m.cpu && m.cpu.percentCPUUsage || 0) * 10) / 10,
        workingSetMb: Math.round((m.memory && m.memory.workingSetSize || 0) / 1024)
      }));

      const result = {
        wallClock: {
          processStartToAppReadyMs: since('appReady'),
          processStartToWindowCreatedMs: since('windowCreated'),
          processStartToDomReadyMs: since('domReady'),
          processStartToDidFinishLoadMs: since('didFinishLoad')
        },
        rendererTiming,
        processMetrics,
        mainHeapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024)
      };
      await fs.writeFile(path.join(output, 'startup.json'), JSON.stringify(result, null, 2));
      console.log(JSON.stringify(result, null, 2));
      // Second sample: how long a repeat renderer navigation takes from cache.
      const repeat = await wc.executeJavaScript(`(async()=>{
        const t=performance.now();
        await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>requestAnimationFrame(r))));
        return Math.round(performance.now()-t);
      })()`);
      console.log(JSON.stringify({ threeFrameMs: repeat }));
      app.exit(0);
    } catch (error) {
      await fs.writeFile(path.join(output, 'failure.json'), JSON.stringify({ error: error.stack }, null, 2));
      console.error(error);
      app.exit(1);
    }
  });
});

require('../src/main.cjs');
mark('mainRegistered');
