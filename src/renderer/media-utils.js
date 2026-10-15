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
  function uniqueVideos(videos, { playableOnly = false } = {}) {
    const result = [], seen = new Map();
    for (const video of Array.isArray(videos) ? videos : []) {
      if (!video) continue;
      const title = String(video.title || '').toLowerCase().replace(/[®™]/g, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
      const keys = [video.stream && `stream:${mediaKey(video.stream)}`, video.preview && `preview:${mediaKey(video.preview)}`,
        title && !/^(trailer|video|preview)$/.test(title) && `title:${title}`].filter(Boolean);
      const match = keys.map(key => seen.get(key)).find(index => index !== undefined);
      const index = match ?? result.length;
      if (match === undefined) result.push(video);
      else if (!result[index].stream && video.stream) result[index] = video;
      for (const key of keys) seen.set(key, index);
    }
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
  const api = { mediaKey, uniqueVideos, uniqueScreenshots };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.launcherMedia = api;
})(typeof globalThis === 'object' ? globalThis : this);
