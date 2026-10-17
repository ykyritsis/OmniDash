// Static consistency audit for the renderer/main boundary.
// Reports: duplicate DOM ids, preload channels with no main handler, main handlers never exposed,
// renderer calls to preload members that do not exist, and unescaped HTML interpolation.
// Read-only: writes nothing. Run with: node scripts/audit-static.cjs
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const rendererDir = path.join(root, 'src', 'renderer');
const read = p => fs.readFileSync(p, 'utf8');
const lineOf = (text, index) => text.slice(0, index).split('\n').length;

const findings = { duplicateIds: [], preloadUnhandled: [], unexposedHandlers: [], missingPreloadMembers: [], unescapedHtml: [] };

// ---------------------------------------------------------------- duplicate DOM ids
const html = read(path.join(rendererDir, 'index.html'));
const idCounts = new Map();
for (const m of html.matchAll(/\sid="([^"]+)"/g)) {
  const line = lineOf(html, m.index);
  if (!idCounts.has(m[1])) idCounts.set(m[1], []);
  idCounts.get(m[1]).push(line);
}
for (const [id, lines] of idCounts) if (lines.length > 1) findings.duplicateIds.push({ id, lines });

// Ids referenced by JS but never present in the markup (typos / removed elements).
const htmlIds = new Set(idCounts.keys());
const rendererFiles = fs.readdirSync(rendererDir).filter(f => f.endsWith('.js') && !f.startsWith('vendor'));
const missingIds = [];
for (const file of rendererFiles) {
  const text = read(path.join(rendererDir, file));
  for (const m of text.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    if (!htmlIds.has(m[1])) missingIds.push({ file, id: m[1], line: lineOf(text, m.index) });
  }
}

// ---------------------------------------------------------------- ipc surface
const mainText = read(path.join(root, 'src', 'main.cjs'));
const handlerChannels = new Set([...mainText.matchAll(/ipcMain\.handle\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]));
const onChannels = new Set([...mainText.matchAll(/ipcMain\.on\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]));

const preloadText = read(path.join(root, 'src', 'preload.cjs'));
const exposed = new Set([...preloadText.matchAll(/ipcRenderer\.invoke\(\s*['"]([^'"]+)['"]/g)].map(m => m[1]));
for (const m of preloadText.matchAll(/ipcRenderer\.send\(\s*['"]([^'"]+)['"]/g)) exposed.add(m[1]);

for (const channel of exposed) if (!handlerChannels.has(channel) && !onChannels.has(channel)) findings.preloadUnhandled.push(channel);
for (const channel of handlerChannels) if (!exposed.has(channel)) findings.unexposedHandlers.push(channel);

// Members of the preload `api` object the renderer calls but which are never defined.
const apiMembers = new Set();
const apiBlock = preloadText.match(/const api\s*=\s*\{([\s\S]*?)\n\};/);
if (apiBlock) for (const m of apiBlock[1].matchAll(/^\s*([A-Za-z_$][\w$]*)\s*[:(]/gm)) apiMembers.add(m[1]);
const bridgeNames = [...new Set([...rendererFiles.map(f => read(path.join(rendererDir, f))).join('\n').matchAll(/\b(?:launcher|bridge|api|nebula|desktop)\s*\.\s*([A-Za-z_$][\w$]*)/g)].map(m => m[1]))];
// Only meaningful if we know the global name the preload exposes.
const globalName = (preloadText.match(/contextBridge\.exposeInMainWorld\(\s*['"]([^'"]+)['"]/) || [, null])[1];
const globalUses = globalName
  ? [...rendererFiles.map(f => ({ f, t: read(path.join(rendererDir, f)) })).flatMap(({ f, t }) =>
      [...t.matchAll(new RegExp(`\\b${globalName}\\s*\\.\\s*([A-Za-z_$][\\w$]*)`, 'g'))].map(m => ({ file: f, member: m[1], line: lineOf(t, m.index) })))]
  : [];
for (const use of globalUses) if (apiMembers.size && !apiMembers.has(use.member)) findings.missingPreloadMembers.push(use);

// ---------------------------------------------------------------- innerHTML from remote data
for (const file of [...rendererFiles.map(f => path.join(rendererDir, f)), path.join(root, 'src', 'main.cjs')]) {
  const text = read(file);
  const rel = path.relative(root, file);
  for (const m of text.matchAll(/\.innerHTML\s*=\s*([^;]{0,200});/g)) {
    const expr = m[1];
    // Flag only interpolations that look like remote/service payloads rather than local constants.
    if (/\$\{[^}]*(description|summary|news|review|achievement|name|title|author|content|text|message|error|url|src)[^}]*\}/i.test(expr)
      && !/(escape|esc|sanitiz|textContent|safe)/i.test(expr)) {
      findings.unescapedHtml.push({ file: rel, line: lineOf(text, m.index), snippet: expr.trim().slice(0, 140) });
    }
  }
}

const report = {
  counts: {
    duplicateIds: findings.duplicateIds.length,
    missingDomIds: missingIds.length,
    preloadChannelsWithoutHandler: findings.preloadUnhandled.length,
    handlersNeverExposed: findings.unexposedHandlers.length,
    missingPreloadMembers: findings.missingPreloadMembers.length,
    suspiciousInnerHtml: findings.unescapedHtml.length,
    ipcHandlers: handlerChannels.size,
    exposedChannels: exposed.size,
    preloadGlobal: globalName
  },
  ...findings,
  missingDomIds: missingIds
};
console.log(JSON.stringify(report, null, 2));
