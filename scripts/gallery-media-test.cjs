const assert = require('node:assert/strict');
const media = require('../src/renderer/media-utils.js');
const fixtures = require('./fixtures/steam-trailers.json');
for (const game of fixtures) {
  const cached = game.videos.map(video => ({ ...video, preview: video.preview.replace('293x165', '600x338') }));
  const before = JSON.stringify(cached);
  const result = media.uniqueVideos([...cached, ...game.videos], { playableOnly: true });
  assert.equal(result.length, 6, `${game.title}: preserve six distinct trailers`);
  assert.deepEqual(result.map(video => video.preview), game.videos.map(video => video.preview));
  assert.equal(new Set(result.map(video => video.stream)).size, 6);
  assert.equal(new Set(result.map(video => media.trailerCaption(video.title, game.title))).size, 6);
  assert.equal(JSON.stringify(cached), before, 'Repair must not mutate cached source objects');
  const first = game.videos[0];
  const variant = { ...first, title: 'Alternate title', preview: '', stream: first.stream.replace('video.akamai.', 'video.fastly.').replace('hls_264_master', 'hls_av1_master') };
  assert.equal(media.uniqueVideos([first, variant]).length, 1, 'Steam CDN/codec variants refer to the same trailer');
}
const video = (title, preview, stream) => ({ title, preview, stream });
const bridged = [video('Reveal', 'https://example.com/a.jpg', ''), video('Launch', 'https://example.com/b.jpg', 'https://example.com/b.m3u8'), video('Reveal', 'https://example.com/b.jpg', ''), video('Launch', '', '')];
assert.deepEqual(media.uniqueVideos(bridged, { playableOnly: true }), [bridged[1]], 'Cross-source aliases merge transitively and retain a playable stream');
assert.equal(media.uniqueVideos([video('Trailer', '', 'https://example.com/1'), video('Trailer', '', 'https://example.com/2')]).length, 2, 'Generic labels must not collapse distinct videos');
assert.equal(media.uniqueVideos([video('Official Reveal™ Trailer', '', 'https://example.com/1'), video('Reveal Trailer', '', 'https://example.com/2')]).length, 1);
assert.equal(media.trailerPreview('https://example.com/movie.600x338.jpg'), 'https://example.com/movie.600x338.jpg');
assert.equal(media.trailerPreview(''), '');
assert.equal(media.trailerCaption('Official Call of Duty®: Ghosts — Launch Trailer', 'Call of Duty: Ghosts'), 'Launch Trailer');
assert.equal(media.trailerCaption('', ''), 'Trailer');
console.log('PASS Ghosts/Infinite Warfare cached previews, distinct trailers, CDN variants, transitive duplicates, playable preference and captions');
