// Keep the player's market and the rating board separate from the UI language.
const ESRB_AGES = { ec: '3', e: '6', e10: '10', t: '13', m: '17', ao: '18' };
const countryFromLocale = locale => {
  try { return new Intl.Locale(locale).region || ''; } catch { return ''; }
};
function resolveCountry({ region = 'auto', country = '', locale = '', timeZone = '' } = {}) {
  if (/^[A-Z]{2}$/.test(region)) return region;
  if (/^[A-Z]{2}$/.test(country)) return country;
  const localized = countryFromLocale(locale);
  if (localized) return localized;
  if (timeZone.startsWith('Australia/')) return 'AU';
  if (timeZone === 'Pacific/Auckland' || timeZone === 'Pacific/Chatham') return 'NZ';
  return 'US';
}
function ratingSystem(value) {
  const name = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return ({ OFLC: 'COB-AU', COBAU: 'COB-AU', ACB: 'COB-AU', AUSTRALIANCLASSIFICATION: 'COB-AU',
    CLASSIFICATIONBOARD: 'COB-AU', NZOFLC: 'OFLC-NZ', OFLCNZ: 'OFLC-NZ',
    DEJUS: 'DJCTQ', CLASSIND: 'DJCTQ', KGRB: 'GRAC', GRB: 'GRAC', CRL: 'CSRR' })[name] || name;
}
function preferredRatingSystems(country = 'US') {
  const primary = ({ AU: 'COB-AU', NZ: 'OFLC-NZ', US: 'ESRB', CA: 'ESRB', MX: 'ESRB', DE: 'USK',
    JP: 'CERO', BR: 'DJCTQ', KR: 'GRAC', TW: 'CSRR', ZA: 'FPB', ID: 'IGRS' })[country] || 'PEGI';
  return [...new Set([primary, 'PEGI', 'ESRB', 'USK'])];
}
function normalizeRating(entry, system = entry?.system) {
  if (!entry) return null;
  system = ratingSystem(system);
  const raw = String(entry.rating || entry.label || entry.RatingId || '').split(':').pop().trim();
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  let label = raw, value = String(entry.value ?? entry.required_age ?? entry.ratingAge ?? '').replace(/\D/g, '');
  if (system === 'COB-AU') {
    label = /^ma(?:15)?$|^matureaccompanied/.test(key) ? 'MA15+' : /^r/.test(key) ? 'R18+' : /^pg|parental/.test(key) ? 'PG'
      : /^g|general/.test(key) ? 'G' : /^m|mature/.test(key) ? 'M' : key === 'ctc' ? 'CTC' : raw;
    // Xbox uses the descriptive label "Restricted" for R18+.
    if (/restricted/i.test(raw) && value === '15') label = 'MA15+';
    value ||= /18/.test(label) ? '18' : /15/.test(label) ? '15' : '';
  } else if (system === 'ESRB') {
    label = /^(everyone10|e10)/.test(key) ? 'E10+' : /^everyone|^e$/.test(key) ? 'E' : /^teen|^t$/.test(key) ? 'T'
      : /^mature|^m$/.test(key) ? 'M' : /^adultsonly|^ao$/.test(key) ? 'AO' : raw.toUpperCase();
    value ||= ESRB_AGES[label.toLowerCase().replace('+','')] || '';
    value ||= ESRB_AGES[key] || '';
  } else if (system === 'PEGI' || system === 'USK') {
    value ||= raw.replace(/\D/g, ''); label = value || raw;
  } else { value ||= raw.replace(/\D/g, ''); label = raw.toUpperCase(); }
  const descriptors = entry.descriptors ?? entry.RatingDescriptors ?? '';
  return { ...entry, system, label, value,
    descriptors: (Array.isArray(descriptors) ? descriptors.map(x => String(x).split(':').pop().replace(/([a-z])([A-Z])/g, '$1 $2')).join(', ') : String(descriptors)).replace(/\s*[\r\n]+\s*/g, ', ').trim() };
}
function chooseRating(country, ...candidates) {
  const ratings = candidates.flat().map(r => normalizeRating(r)).filter(Boolean);
  const order = preferredRatingSystems(country);
  const rating = order.map(system => ratings.find(r => r.system === system)).find(Boolean) || ratings[0];
  return rating ? { ...rating, regionalFallback: rating.system !== order[0] } : null;
}
function steamAgeRating(item, country) {
  const ratings = Object.entries(item?.ratings || {}).map(([system, entry]) => normalizeRating(entry, system));
  const selected = chooseRating(country, ratings);
  if (selected) return selected;
  const age = Number(item?.required_age) || 0;
  return age ? { system: 'AGE', value: String(age), label: `${age}+`, descriptors: '', regionalFallback: true } : null;
}
function xboxAgeRating(product, country) {
  return chooseRating(country, (product?.MarketProperties || []).flatMap(market => market.ContentRatings || [])
    .map(entry => normalizeRating(entry, entry.RatingSystem)));
}
module.exports = { resolveCountry, ratingSystem, preferredRatingSystems, normalizeRating, chooseRating, steamAgeRating, xboxAgeRating };
