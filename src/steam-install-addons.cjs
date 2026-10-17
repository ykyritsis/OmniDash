// Install choices for Steam games: which DLC and which language pack to download.
//
// Steam splits a game into depots. The base game's depots are one group; each DLC that ships files has its
// own depots (marked with the DLC's app id); language packs are depots tagged with a language. Games like Call
// of Duty are large because of both. This module groups those depots, sizes each group, and turns the player's
// choices into the calls Steam's own DLC tab makes (SetDLCEnabled and SetAppCurrentLanguage).
const positive = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : 0;

// A DLC bigger than this is flagged, so the player notices before downloading it.
const BIG_ADDON_BYTES = 2e9;

const LANGUAGE_NAMES = {
  english: 'English', french: 'French', german: 'German', italian: 'Italian', spanish: 'Spanish - Spain', latam: 'Spanish - Latin America',
  portuguese: 'Portuguese', brazilian: 'Portuguese - Brazil', russian: 'Russian', polish: 'Polish', schinese: 'Chinese (Simplified)',
  tchinese: 'Chinese (Traditional)', japanese: 'Japanese', koreana: 'Korean', turkish: 'Turkish', arabic: 'Arabic', thai: 'Thai',
  dutch: 'Dutch', swedish: 'Swedish', danish: 'Danish', norwegian: 'Norwegian', finnish: 'Finnish', czech: 'Czech', hungarian: 'Hungarian',
  ukrainian: 'Ukrainian', greek: 'Greek', romanian: 'Romanian', bulgarian: 'Bulgarian', vietnamese: 'Vietnamese'
};
const languageLabel = code => LANGUAGE_NAMES[code] || (code ? code[0].toUpperCase() + code.slice(1) : '');

// The depot's own size, following "depotfromapp" to the app that owns the files when they're shared.
function depotManifest(id, depot, shared) {
  let source = depot;
  const visited = new Set();
  while (source?.depotfromapp && !visited.has(String(source.depotfromapp))) {
    visited.add(String(source.depotfromapp));
    source = shared?.[source.depotfromapp]?.depots?.[id];
  }
  const manifest = source?.manifests?.public;
  return manifest && typeof manifest === 'object' ? manifest : null;
}

// Group a game's depots into DLC and languages (Windows only). Returns Maps keyed by DLC app id and language code.
function groupDepots(info, shared = {}) {
  const dlc = new Map(), languages = new Map();
  for (const [id, depot] of Object.entries(info?.depots || {})) {
    if (!/^\d+$/.test(id) || !depot || typeof depot !== 'object') continue;
    const config = depot.config || {};
    if (config.oslist && !String(config.oslist).split(',').map(item => item.trim()).includes('windows')) continue;
    const manifest = depotManifest(id, depot, shared);
    const installBytes = positive(manifest?.size), downloadBytes = positive(manifest?.download);
    const dlcId = String(depot.dlcappid || config.dlcappid || '');
    const language = String(config.language || '').toLowerCase();
    if (/^\d+$/.test(dlcId)) {
      // A DLC ships shared files plus one copy of its voice/text per language; only one language is installed.
      const entry = dlc.get(dlcId) || { installBytes: 0, downloadBytes: 0, depotCount: 0, languages: {} };
      if (language) {
        const part = entry.languages[language] || { installBytes: 0, downloadBytes: 0 };
        part.installBytes += installBytes; part.downloadBytes += downloadBytes;
        entry.languages[language] = part;
      } else { entry.installBytes += installBytes; entry.downloadBytes += downloadBytes; }
      entry.depotCount += 1;
      dlc.set(dlcId, entry);
      continue;
    }
    if (!language) continue;
    const entry = languages.get(language) || { installBytes: 0, downloadBytes: 0, depotCount: 0 };
    entry.installBytes += installBytes; entry.downloadBytes += downloadBytes; entry.depotCount += 1;
    languages.set(language, entry);
  }
  return { dlc, languages };
}

// A DLC's size with one language: its shared files plus that language's files (English when it has none).
function dlcSize(sizes, language = 'english') {
  const part = sizes.languages?.[language] || sizes.languages?.english || null;
  return { installBytes: sizes.installBytes + (part?.installBytes || 0), downloadBytes: sizes.downloadBytes + (part?.downloadBytes || 0) };
}

// Everything the install sheet shows. `store` maps app id to { title, price }; `steamDlc` maps app id to
// { name, enabled, owned } from Steam's own DLC list when it can be read (null otherwise); `saved` is the player's
// last choice. Only DLC you own is listed: Steam can't download the rest, so it would only be noise.
function buildAddons({ groups, listedDlcIds = [], store = new Map(), steamDlc = null, saved = null, systemLanguage = 'english' }) {
  const languages = [...groups.languages].map(([code, sizes]) => ({ code, label: languageLabel(code), ...sizes })).sort((a, b) => a.label.localeCompare(b.label));
  const available = new Set(languages.map(item => item.code));
  const language = saved?.language && available.has(saved.language) ? saved.language : available.has(systemLanguage) ? systemLanguage : available.has('english') ? 'english' : languages[0]?.code || '';
  const ownedIds = steamDlc ? new Set([...steamDlc].filter(([, item]) => item.owned !== false).map(([id]) => id)) : null;
  const rows = [];
  for (const [appId, sizes] of groups.dlc) {
    const steam = steamDlc?.get(appId);
    if (!ownedIds?.has(appId)) continue;
    const size = dlcSize(sizes, language);
    if (!size.installBytes) continue;
    const chosen = saved?.dlc?.[appId];
    rows.push({
      appId, title: store.get(appId)?.title || steam?.name || `Add-on ${appId}`, price: '',
      installBytes: size.installBytes, downloadBytes: size.downloadBytes, owned: true,
      base: { installBytes: sizes.installBytes, downloadBytes: sizes.downloadBytes }, languageSizes: sizes.languages || {},
      // What Steam would do: install what's switched on in its DLC tab. A saved choice wins.
      checked: typeof chosen === 'boolean' ? chosen : steam.enabled !== false,
      big: size.installBytes >= BIG_ADDON_BYTES
    });
  }
  rows.sort((a, b) => b.installBytes - a.installBytes || a.title.localeCompare(b.title));
  const withFiles = new Set(rows.map(row => row.appId));
  return {
    dlc: rows,
    // Owned add-ons that add no files (cosmetic, or unlocked inside the base game): nothing to choose.
    noDownloadCount: ownedIds ? [...ownedIds].filter(id => !withFiles.has(id)).length : 0,
    languages: languages.length > 1 ? languages : [],
    language,
    englishInstallBytes: groups.languages.get('english')?.installBytes || 0
  };
}

// Extra space the choices add on top of the base game (which the size lookup counts with English only).
// A listed DLC's size for the language the player picked.
function rowSize(row, language) {
  return row.base ? dlcSize({ ...row.base, languages: row.languageSizes }, language || 'english') : { installBytes: row.installBytes, downloadBytes: row.downloadBytes };
}
function extraBytes(addons, selection) {
  let total = 0;
  for (const row of addons.dlc) if (selection.dlc[row.appId] ?? row.checked) total += rowSize(row, selection.language).installBytes;
  const picked = addons.languages.find(item => item.code === selection.language);
  if (picked && selection.language !== 'english') total += picked.installBytes - addons.englishInstallBytes;
  return Math.max(0, total);
}
function extraDownloadBytes(addons, selection) {
  let total = 0;
  for (const row of addons.dlc) if (selection.dlc[row.appId] ?? row.checked) total += rowSize(row, selection.language).downloadBytes;
  const picked = addons.languages.find(item => item.code === selection.language);
  if (picked && selection.language !== 'english') total += picked.downloadBytes;
  return total;
}

// The Steam calls that carry the choices out. Only add-ons the sheet listed are touched.
function planCalls(appId, selection, addons) {
  if (!/^\d{1,10}$/.test(String(appId))) throw new Error('Invalid Steam app.');
  const calls = [];
  for (const row of addons.dlc) {
    const enabled = selection.dlc?.[row.appId];
    if (typeof enabled === 'boolean' && row.owned !== false) calls.push({ type: 'dlc', appId: Number(appId), dlcAppId: Number(row.appId), enabled });
  }
  if (selection.language && addons.languages.some(item => item.code === selection.language)) calls.push({ type: 'language', appId: Number(appId), code: selection.language });
  return calls;
}

module.exports = { groupDepots, buildAddons, dlcSize, rowSize, extraBytes, extraDownloadBytes, planCalls, languageLabel, BIG_ADDON_BYTES };
