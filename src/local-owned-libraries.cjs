// Owned (not necessarily installed) games that GOG Galaxy and Amazon Games keep in their own
// local databases. Both are opened read-only; nothing is written back to either client.
const path = require('node:path');
const fs = require('node:fs');

function openReadOnly(file) {
  if (!file || !fs.existsSync(file)) return null;
  const { DatabaseSync } = require('node:sqlite');
  return new DatabaseSync(file, { readOnly: true });
}
const cleanTitle = value => String(value || '').replace(/[\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200);

function gogDatabasePath() {
  return path.join(process.env.ProgramData || 'C:\\ProgramData', 'GOG.com', 'Galaxy', 'storage', 'galaxy-2.0.db');
}
function readGogOwned(file = gogDatabasePath()) {
  let db;
  try { db = openReadOnly(file); } catch { return { status: 'unreadable', games: [] }; }
  if (!db) return { status: 'not-installed', games: [] };
  try {
    const rows = db.prepare(`SELECT lr.releaseKey AS releaseKey, gpt.type AS type, gp.value AS value
      FROM LibraryReleases lr
      JOIN GamePieces gp ON gp.releaseKey = lr.releaseKey
      JOIN GamePieceTypes gpt ON gpt.id = gp.gamePieceTypeId
      WHERE lr.releaseKey LIKE 'gog\\_%' ESCAPE '\\' AND gpt.type IN ('title', 'originalTitle', 'originalImages')`).all();
    const byKey = new Map();
    for (const row of rows) {
      const entry = byKey.get(row.releaseKey) || {};
      let value = {};
      try { value = JSON.parse(row.value || '{}') || {}; } catch { /* Skip malformed pieces. */ }
      if (row.type === 'title' && value.title) entry.title = value.title;
      else if (row.type === 'originalTitle' && value.title && !entry.title) entry.title = value.title;
      else if (row.type === 'originalImages') entry.images = value;
      byKey.set(row.releaseKey, entry);
    }
    const games = [];
    for (const [key, entry] of byKey) {
      const id = key.slice(4), title = cleanTitle(entry.title);
      if (!/^\d{1,20}$/.test(id) || !title) continue;
      const image = url => /^https:\/\/[a-z0-9.-]*gog(-statics)?\.com\//i.test(String(url || '')) ? String(url) : '';
      const artwork = { tile: image(entry.images?.squareIcon), poster: image(entry.images?.verticalCover), hero: image(entry.images?.background) };
      games.push({ id: `gog-${id}`, provider: 'GOG Galaxy', providerId: id, title, installed: false, accountLibrary: 'gog',
        installUri: `goggalaxy://openGameView/${id}`, ...(artwork.tile || artwork.poster || artwork.hero ? { remoteArtwork: artwork } : {}) });
    }
    return { status: 'ready', games };
  } catch {
    return { status: 'unreadable', games: [] };
  } finally { db.close(); }
}

function amazonDatabasePath() {
  return path.join(process.env.LOCALAPPDATA || '', 'Amazon Games', 'Data', 'Games', 'Sql', 'GameProductInfo.sqlite');
}
function readAmazonOwned(file = amazonDatabasePath()) {
  let db;
  try { db = openReadOnly(file); } catch { return { status: 'unreadable', games: [] }; }
  if (!db) return { status: 'not-installed', games: [] };
  try {
    const games = [];
    for (const row of db.prepare('SELECT * FROM DbSet').all()) {
      const id = String(row.ProductIdStr || row.Id || ''), title = cleanTitle(row.ProductTitle);
      if (!/^[A-Za-z0-9._-]{1,120}$/.test(id) || !title) continue;
      games.push({ id: `amazon-${id}`, provider: 'Amazon Games', providerId: id, title, installed: false, accountLibrary: 'amazon',
        installUri: `amazon-games://play/${id}`, publisher: cleanTitle(row.ProductPublisher) || undefined });
    }
    return { status: 'ready', games };
  } catch {
    return { status: 'unreadable', games: [] };
  } finally { db.close(); }
}

module.exports = { readGogOwned, readAmazonOwned, gogDatabasePath, amazonDatabasePath };
