// Title matching for artwork and metadata lookups. A close spelling isn't enough: sequel numbers,
// roman numerals, years and words like "Remastered" decide which game it is, so they must agree.
function normalizeTitle(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Extra words that only describe an edition of the same game.
const EDITION_WORDS = new Set(['edition', 'standard', 'deluxe', 'ultimate', 'gold', 'premium', 'complete', 'goty', 'game', 'of', 'the', 'year',
  'digital', 'pc', 'windows', 'for', 'and', 'bundle', 'pack', 'collectors', 'collector', 's', 'launch', 'special', 'steam', 'version', 'microsoft', 'store', 'xbox', 'series', 'x', 'one']);
// Words that name a different release of the series.
const DISTINCT_WORDS = new Set(['remastered', 'remaster', 'remake', 'reloaded', 'redux', 'reforged', 'definitive', 'anniversary', 'origins', 'legends',
  'returns', 'reborn', 'zero', 'infinite', 'vanguard', 'beta', 'demo', 'playtest', 'vr', 'online', 'multiplayer', 'campaign', 'dlc', 'season', 'soundtrack']);
const ROMAN = /^(?:i{1,3}|iv|v|vi{1,3}|ix|x|xi{1,3}|xiv|xv)$/;

function titleTokens(value) {
  const words = normalizeTitle(value).split(' ').filter(Boolean);
  const years = words.filter(word => /^(19|20)\d{2}$/.test(word));
  // Roman numerals only count after the first word, and not in "Series X".
  const numbers = words.filter((word, index) => !/^(19|20)\d{2}$/.test(word)
    && (/^\d+$/.test(word) || (index > 0 && ROMAN.test(word) && words[index - 1] !== 'series')))
    .map(word => (word === '1' || word === 'i' ? null : word)).filter(Boolean);
  const distinct = words.filter(word => DISTINCT_WORDS.has(word));
  return { words, years, numbers, distinct };
}

function sameSet(a, b) {
  const left = [...new Set(a)].sort(), right = [...new Set(b)].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

// True when two titles name different games of the same series.
function titleConflict(query, candidate) {
  const a = titleTokens(query), b = titleTokens(candidate);
  if (!sameSet(a.numbers, b.numbers)) return true;
  if (a.years.length && b.years.length && !a.years.some(year => b.years.includes(year))) return true;
  if (!sameSet(a.distinct, b.distinct)) return true;
  return false;
}

function editDistanceSimilarity(wanted, actual) {
  const rows = Array.from({ length: wanted.length + 1 }, (_, row) => row);
  for (let column = 1; column <= actual.length; column++) {
    let diagonal = rows[0];
    rows[0] = column;
    for (let row = 1; row <= wanted.length; row++) {
      const previous = rows[row];
      rows[row] = Math.min(rows[row] + 1, rows[row - 1] + 1, diagonal + (wanted[row - 1] === actual[column - 1] ? 0 : 1));
      diagonal = previous;
    }
  }
  return 1 - rows[wanted.length] / Math.max(wanted.length, actual.length);
}

function titleMatchScore(query, candidate) {
  const wanted = normalizeTitle(query);
  const actual = normalizeTitle(candidate);
  if (!wanted || !actual) return 0;
  if (wanted === actual) return 100;
  if (titleConflict(query, candidate)) return 30;
  // Same title apart from a year or edition words, e.g. "Modern Warfare 3 (2011)" and "Modern Warfare 3".
  const strip = value => titleTokens(value).words.filter(word => !EDITION_WORDS.has(word) && !/^(19|20)\d{2}$/.test(word)).join(' ');
  const wantedCore = strip(query), actualCore = strip(candidate);
  if (wantedCore && wantedCore === actualCore) return 96;
  // A prefix only counts when the extra words are edition words; otherwise it's likely another game in the series.
  if (actual.startsWith(wanted) || wanted.startsWith(actual)) {
    const longer = actual.length > wanted.length ? actual : wanted, shorter = longer === actual ? wanted : actual;
    const extra = longer.slice(shorter.length).trim().split(' ').filter(Boolean);
    return extra.every(word => EDITION_WORDS.has(word) || /^(19|20)\d{2}$/.test(word)) ? 90 : 60;
  }
  if (actual.includes(wanted) || wanted.includes(actual)) return 62;
  const wantedWords = new Set(wanted.split(' '));
  const actualWords = new Set(actual.split(' '));
  const overlap = [...wantedWords].filter((word) => actualWords.has(word)).length / Math.max(wantedWords.size, actualWords.size);
  return Math.round(Math.max(overlap * 68, editDistanceSimilarity(wanted, actual) * 64));
}

// Titles whose cached artwork came from the old, looser matcher and should be checked again.
function titleNeedsRecheck(title) {
  const tokens = titleTokens(title);
  return Boolean(tokens.numbers.length || tokens.years.length || tokens.distinct.length);
}

module.exports = { normalizeTitle, titleMatchScore, titleConflict, titleNeedsRecheck };
