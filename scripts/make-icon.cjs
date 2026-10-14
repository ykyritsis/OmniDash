// Makes the launcher's icon: the Xbox mark in blue on a dark rounded tile. Writes build/icon.svg and build/icon.png.
// Run once with: electron scripts/make-icon.cjs
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const mark = require('node:fs').readFileSync(path.join(root, 'src/renderer/assets/xbox.svg'), 'utf8');
const inner = mark.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/fill="#fff"/g, 'fill="url(#blue)"');
// The mark is 334 × 322 in its own units; fit it into 150 px, centred on the 256 px tile.
const scale = 150 / 334;
const x = 128 - (190 + 167) * scale, y = 128 - (0 + 161) * scale;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16202f"/><stop offset="1" stop-color="#070b12"/></linearGradient>
    <linearGradient id="blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5cc8ff"/><stop offset="1" stop-color="#1579e8"/></linearGradient>
  </defs>
  <rect width="256" height="256" rx="58" fill="url(#tile)"/>
  <rect x="1" y="1" width="254" height="254" rx="57" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2"/>
  <g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(5)})">${inner}</g>
</svg>`;

app.whenReady().then(async () => {
  await fs.writeFile(path.join(root, 'build/icon.svg'), svg, 'utf8');
  const win = new BrowserWindow({ width: 256, height: 256, show: false, frame: false, useContentSize: true, webPreferences: { offscreen: true } });
  await win.loadURL(`data:text/html,<body style="margin:0;background:transparent">${encodeURIComponent(svg)}</body>`);
  await new Promise(resolve => setTimeout(resolve, 300));
  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 256, height: 256 });
  await fs.writeFile(path.join(root, 'build/icon.png'), image.toPNG());
  console.log('wrote build/icon.svg and build/icon.png');
  app.exit(0);
});
