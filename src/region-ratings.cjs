// Keep the player's market and the rating board separate from the UI language.
const ESRB_AGES = { ec: '3', e: '6', e10: '10', t: '13', m: '17', ao: '18' };
const countryFromLocale = locale => {
  try { return new Intl.Locale(locale).region || ''; } catch { return ''; }
};
function resolveCountry({ region = 'auto', country = '', locale = '', timeZone = '' } = {}) {
  if (/^[A-Z]{2}$/.test(region)) return region;
  if (/^[A-Z]{2}$/.test(country)) return country;
  if (timeZone.startsWith('Australia/')) return 'AU';
  if (timeZone === 'Pacific/Auckland' || timeZone === 'Pacific/Chatham') return 'NZ';
  const localized = countryFromLocale(locale);
  if (localized) return localized;
  return 'US';
}
function ratingSystem(value) {
  const name = String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  return ({ OFLC: 'COB-AU', COBAU: 'COB-AU', ACB: 'COB-AU', AUSTRALIANCLASSIFICATION: 'COB-AU',
    AUSTRALIANCLASSIFICATIONBOARD:'COB-AU', AUSTRALIA:'COB-AU', OFLCAUSTRALIA:'COB-AU', CLASSIFICATIONBOARD: 'COB-AU', NZOFLC: 'OFLC-NZ', OFLCNZ: 'OFLC-NZ',
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
  const raw = String(entry.label || entry.rating || entry.RatingId || '').split(':').pop().replace(/^(?:Australian Classification(?: Board)?|ACB|COB-AU|OFLC)\s*/i,'').trim();
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[^a-z0-9]/g, '');
  let label = raw, value = String(entry.value ?? entry.required_age ?? entry.ratingAge ?? '').replace(/\D/g, '');
  if (system === 'COB-AU') {
    label = /^(?:ma(?:15)?|matureaccompanied(?:15)?)$/.test(key) ? 'MA15+'
      : key==='restricted15'||key==='restricted'&&value==='15' ? 'MA15+'
      : /^(?:r(?:18)?|restricted(?:18)?)$/.test(key) ? 'R18+'
      : /^(?:pg|parentalguidance(?:\d+)?)$/.test(key) ? 'PG'
      : /^(?:g|general(?:0)?)$/.test(key) ? 'G'
      : /^(?:m(?:15)?|mature(?:15)?)$/.test(key) ? 'M'
      : /^(?:ctc|checktheclassification|ratingpending)$/.test(key) ? 'CTC'
      : /^(?:rc|refusedclassification)$/.test(key) ? 'RC' : '';
    if(!label)return null;
    value=({G:'0',PG:'',M:'15','MA15+':'15','R18+':'18',CTC:'',RC:''})[label];
  } else if (system === 'ESRB') {
    label = /^(everyone10|e10)/.test(key) ? 'E10+' : /^everyone|^e$/.test(key) ? 'E' : /^teen|^t$/.test(key) ? 'T'
      : /^mature|^m$/.test(key) ? 'M' : /^adultsonly|^ao$/.test(key) ? 'AO' : /^earlychildhood|^ec$/.test(key) ? 'EC' : /^(rp|ratingpending)$/.test(key)?'RP':'';
    if(!label)return null;value=ESRB_AGES[label.toLowerCase().replace('+','')] || '';
  } else if (system === 'PEGI' || system === 'USK') {
    value=raw.replace(/\D/g,'')||value;
    if(!(system==='PEGI'?['3','7','12','16','18']:['0','6','12','16','18']).includes(value))return null;
    label=value;
  } else { value ||= raw.replace(/\D/g, ''); label = raw.toUpperCase(); }
  const descriptors = entry.descriptors ?? entry.RatingDescriptors ?? '';
  return { ...entry, system, label, value,
    descriptors: englishAdvice(descriptors),interactive:englishAdvice(entry.interactive ?? entry.interactive_elements ?? entry.RatingInteractiveElements ?? '') };
}
// Stores sometimes return a board's own language despite an English request.
// Retain recognized English consumer advice, never guess a classification from
// another board or display untranslated provider text as local advice.
const ADVICE_WORDS=new Set(('a an and or of the to with in for at by may contain contains not rated online interactions interactivity interact users purchases game games chance based paid loot boxes random items very mild moderate strong high impact intensity intense extreme graphic realistic stylized animated cartoon fantasy violence blood gore gory dismemberment cruelty horror scary fear scenes images themes mature adult sexual sex sexuality suggestive content nudity partial simulated gambling real money drugs drug alcohol tobacco use reference references coarse bad offensive language lyrics humour humor crude comic mischief discrimination prejudice unrestricted unrestrictedness no youth all ages ages activity competitive elements experiences gaming sharing location internet access uncensored profanity violence').split(' '));
function englishAdvice(value){
  return [...new Set((Array.isArray(value)?value:[value]).flatMap(item=>String(item||'').split(/[\r\n,;]+/)).map(text=>text.split(':').pop().replace(/([a-z])([A-Z])/g,'$1 $2').replace(/&amp;/g,'&').replace(/<[^>]*>/g,'').trim()).filter(text=>{
    const words=text.toLowerCase().replace(/[&/()+.\-\d]/g,' ').trim().split(/\s+/);return text&&words.every(word=>ADVICE_WORDS.has(word));
  }))].join(', ');
}
function chooseRating(country, ...candidates) {
  const ratings = candidates.flat().map(r => normalizeRating(r)).filter(Boolean);
  const order = preferredRatingSystems(country);
  const rating = order.map(system => ratings.find(r => r.system === system)).find(Boolean) || ratings.find(r=>r.system==='AGE');
  return rating ? { ...rating, regionalFallback: rating.system !== order[0] } : null;
}
function steamAgeRating(item, country) {
  const ratings = Object.entries(item?.ratings || {}).map(([system, entry]) => normalizeRating(entry, system));
  const selected = chooseRating(country, ratings);
  if (selected) return selected;
  const age = Number(item?.required_age) || 0;
  return Number.isInteger(age)&&age>0&&age<=21 ? { system: 'AGE', value: String(age), label: `${age}+`, descriptors: '', regionalFallback: true } : null;
}
function xboxAgeRating(product, country) {
  return chooseRating(country, (product?.MarketProperties || []).flatMap(market => market.ContentRatings || [])
    .map(entry => normalizeRating(entry, entry.RatingSystem)));
}
module.exports = { resolveCountry, ratingSystem, preferredRatingSystems, normalizeRating, chooseRating, steamAgeRating, xboxAgeRating };
