// A game's own screenshots and clips: Steam's screenshot folder for the game, and Xbox Game Bar captures,
// which are named "<game title> <date> <time>". Listing is read-only; opening a file goes through the main
// process, and only files this module listed can be opened.
const fs = require('node:fs/promises');
const path = require('node:path');

const IMAGE = /\.(png|jpe?g|webp|bmp)$/i, VIDEO = /\.(mp4|mkv|webm|mov)$/i;
const DATE_RIGHT_AFTER_TITLE = /^[\s_-]+(\d{4}[-_.]\d{1,2}[-_.]\d{1,2}|\d{1,2}[-_.]\d{1,2}[-_.]\d{4})/;

// A Game Bar file belongs to a game when the title is followed straight away by a date, so "Forza Horizon"
// does not claim "Forza Horizon 5 2026-10-17 12-00-00.png".
function matchesGameTitle(fileName, title) {
  const base = String(fileName).replace(/\.[^.]+$/, '').replace(/[™®©]/g, '');
  const wanted = String(title || '').replace(/[™®©]/g, '').trim();
  if (wanted.length < 3 || !base.toLowerCase().startsWith(wanted.toLowerCase())) return false;
  return DATE_RIGHT_AFTER_TITLE.test(base.slice(wanted.length));
}

async function filesIn(directory, fsImpl) {
  try { return await fsImpl.readdir(directory, { withFileTypes: true }); } catch { return []; }
}
async function describe(file, source, fsImpl) {
  const kind = IMAGE.test(file) ? 'image' : VIDEO.test(file) ? 'video' : '';
  if (!kind) return null;
  try { const stat = await fsImpl.stat(file); return { path: file, name: path.basename(file), kind, source, at: stat.mtimeMs, size: stat.size }; } catch { return null; }
}

// Newest first, capped. `steamRoots` are Steam install folders; `captureDirs` are Game Bar capture folders.
async function listCaptures({ title, appId, steamRoots = [], captureDirs = [], limit = 24, fsImpl = fs }) {
  const found = [];
  if (/^\d{1,10}$/.test(String(appId || ''))) {
    for (const root of steamRoots) {
      for (const account of await filesIn(path.join(root, 'userdata'), fsImpl)) {
        if (!account.isDirectory() || !/^\d+$/.test(account.name)) continue;
        const folder = path.join(root, 'userdata', account.name, '760', 'remote', String(appId), 'screenshots');
        for (const entry of await filesIn(folder, fsImpl)) if (entry.isFile()) found.push(describe(path.join(folder, entry.name), 'Steam', fsImpl));
      }
    }
  }
  for (const directory of captureDirs) {
    for (const entry of await filesIn(directory, fsImpl)) if (entry.isFile() && matchesGameTitle(entry.name, title)) found.push(describe(path.join(directory, entry.name), 'Game Bar', fsImpl));
  }
  return (await Promise.all(found)).filter(Boolean).sort((a, b) => b.at - a.at).slice(0, limit);
}

module.exports = { listCaptures, matchesGameTitle };
