// Smart collections in the Filter menu: groups the launcher builds from what it already knows about each game.
// The rules are plain functions so they can be tested without a window.
const gSmartCollections = [
  ['unplayed', 'Not played yet'], ['recent-added', 'Recently added'], ['played-lots', 'Played a lot (20 h+)'],
  ['big', 'Large installs (50 GB+)'], ['coop', 'Co-op games'], ['solo', 'Single-player']
];
const gSmartKeys = new Set(gSmartCollections.map(([key]) => key));
const G_DAY = 24 * 60 * 60 * 1000;

function gSmartMatch(game, key, now = Date.now(), lastPlayed = () => 0) {
  if (!game || game.isApp) return false;
  const minutes = Number(game.steamPlaytimeMinutes) || 0;
  const categories = (game.steamCategories || []).join(' ');
  if (key === 'unplayed') return minutes === 0 && !(game.playCount > 0) && !lastPlayed(game);
  if (key === 'recent-added') return game.installed !== false && Number(game.addedAt) > 0 && now - Number(game.addedAt) < 30 * G_DAY;
  if (key === 'played-lots') return minutes >= 20 * 60;
  if (key === 'big') return game.installed !== false && Number(game.sizeOnDisk) >= 50e9;
  if (key === 'coop') return /co-op/i.test(categories);
  if (key === 'solo') return /single-player/i.test(categories);
  return false;
}

if (typeof matchesCollection === 'function') {
  const smartBase = matchesCollection;
  matchesCollection = function (game, collection) {
    return gSmartKeys.has(collection)
      ? gSmartMatch(game, collection, Date.now(), typeof lastPlayedAt === 'function' ? lastPlayedAt : undefined)
      : smartBase(game, collection);
  };
  window.gSmartCollections = gSmartCollections;
  // The library keeps the chosen collection only if the (hidden) collection list has it as an option.
  const select = document.querySelector('#library-collection');
  if (select) for (const [key, label] of gSmartCollections) if (![...select.options].some(option => option.value === key)) select.add(new Option(label, key));
}
if (typeof module !== 'undefined') module.exports = { gSmartCollections, gSmartMatch };
