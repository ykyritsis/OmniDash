// Used both at the metadata boundary and when rendering older cached pages.
(function (root) {
  function mediaKey(value) {
    if (!value) return '';
    try {
      const url = new URL(value);
      if (!/^https?:$/.test(url.protocol)) return String(value);
      const host = /(^|\.)steamstatic\.com$/.test(url.hostname) ? 'steamstatic.com' : url.hostname;
      return host + url.pathname.replace(/\.(?:\d+x\d+)\.(jpg|png|webp)$/i, '.$1');
    } catch { return String(value); }
  }
  function trailerPreview(value) {
    // Older builds invented this larger Steam thumbnail, which returns 404 for
    // older trailers. Repair saved pages as well as newly fetched metadata.
    try {
      const url = new URL(value);
      if (/(^|\.)steamstatic\.com$/.test(url.hostname) && /\/movie\.600x338\.jpg$/i.test(url.pathname)) {
        url.pathname = url.pathname.replace(/600x338/i, '293x165');
        return url.href;
      }
    } catch { /* Preserve empty or local preview values. */ }
    return value;
  }
  function trailerStreamKey(value) {
    try {
      const url = new URL(value);
      const steam = /(^|\.)steamstatic\.com$/.test(url.hostname) && url.pathname.match(/^\/store_trailers\/(\d+)\/(\d+)\//);
      if (steam) return `steam-trailer:${steam[1]}:${steam[2]}`;
    } catch { /* Other streams use the normal URL identity. */ }
    return mediaKey(value);
  }
  function trailerCaption(title, gameTitle) {
    const clean = value => String(value || '').replace(/[®™©]/g, '').replace(/^official\s+/i, '').trim();
    let caption = clean(title), game = clean(gameTitle);
    if (game && caption.toLowerCase().startsWith(game.toLowerCase())) caption = caption.slice(game.length).replace(/^[\s:–—-]+/, '');
    return caption || 'Trailer';
  }
  function uniqueVideos(videos, { playableOnly = false } = {}) {
    const groups = [], seen = new Map();
    for (const input of Array.isArray(videos) ? videos : []) {
      if (!input) continue;
      const preview = trailerPreview(input.preview);
      const video = preview === input.preview ? input : { ...input, preview };
      const title = String(video.title || '').replace(/[®™©]/g, '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/^official\s+/, '');
      const keys = [video.stream && `stream:${trailerStreamKey(video.stream)}`, video.preview && `preview:${mediaKey(video.preview)}`,
        title && !/^(trailer|video|preview)$/.test(title) && `title:${title}`].filter(Boolean);
      const matches = [...new Set(keys.map(key => seen.get(key)).filter(Boolean))];
      const group = matches[0] || { video, keys: new Set(), removed: false };
      if (!matches.length) groups.push(group);
      for (const other of matches.slice(1)) {
        if (!group.video.stream && other.video.stream) group.video = other.video;
        other.removed = true;
        for (const key of other.keys) { group.keys.add(key); seen.set(key, group); }
      }
      if (!group.video.stream && video.stream) group.video = video;
      for (const key of keys) { group.keys.add(key); seen.set(key, group); }
    }
    const result = groups.filter(group => !group.removed).map(group => group.video);
    return playableOnly ? result.filter(video => video.stream) : result;
  }
  function uniqueScreenshots(images) {
    const seen = new Set();
    return (Array.isArray(images) ? images : []).filter(image => {
      const key = mediaKey(image);
      if (!key || seen.has(key)) return false;
      seen.add(key); return true;
    });
  }
  const api = { mediaKey, uniqueVideos, uniqueScreenshots, trailerPreview, trailerCaption };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.launcherMedia = api;
})(typeof globalThis === 'object' ? globalThis : this);
