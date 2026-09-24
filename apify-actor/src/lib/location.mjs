// Location normalization: split multi-location strings, detect regions and remote status.

const US_STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
  CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
  IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas',
  UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia',
  WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia', PR: 'Puerto Rico',
};
const US_STATE_NAMES = Object.values(US_STATES).filter((n) => n !== 'Washington');
const CA_PROVINCES = ['Ontario', 'Quebec', 'Québec', 'British Columbia', 'Alberta', 'Manitoba', 'Nova Scotia', 'New Brunswick', 'Newfoundland', 'Saskatchewan', 'Prince Edward Island'];
const CA_ABBR = ['ON', 'QC', 'BC', 'AB', 'MB', 'NS', 'NB', 'NL', 'PE', 'SK'];
const CA_CITIES = ['Toronto', 'Vancouver', 'Montreal', 'Montréal', 'Waterloo', 'Ottawa', 'Calgary', 'Kitchener', 'Edmonton', 'Burnaby', 'Markham'];
const US_CITIES = [
  'San Francisco', 'Bay Area', 'Silicon Valley', 'Seattle', 'Boston', 'Austin', 'Los Angeles', 'New York',
  'NYC', 'Chicago', 'Denver', 'Houston', 'Dallas', 'Pittsburgh', 'San Jose', 'San Diego', 'Palo Alto',
  'Mountain View', 'Sunnyvale', 'Santa Clara', 'Hawthorne', 'Redmond', 'Long Beach', 'Torrance',
  'El Segundo', 'Costa Mesa', 'Atlanta', 'Phoenix', 'Detroit', 'Ann Arbor', 'Huntsville', 'Cape Canaveral',
  'Albuquerque', 'Livermore', 'Starbase', 'McGregor', 'Boulder', 'Salt Lake City', 'Portland',
  'Washington, D.C', 'Washington DC', 'Arlington', 'Irvine', 'Fremont', 'Milpitas', 'South San Francisco',
];
const EU_TERMS = [
  'United Kingdom', 'UK', 'England', 'Scotland', 'Wales', 'London', 'Cambridge, UK', 'Oxford', 'Bristol',
  'Germany', 'Deutschland', 'Munich', 'München', 'Berlin', 'Hamburg', 'Frankfurt', 'Stuttgart', 'France',
  'Paris', 'Toulouse', 'Netherlands', 'Amsterdam', 'Eindhoven', 'Delft', 'Ireland', 'Dublin', 'Cork',
  'Spain', 'Madrid', 'Barcelona', 'Italy', 'Milan', 'Rome', 'Sweden', 'Stockholm', 'Gothenburg',
  'Switzerland', 'Zurich', 'Zürich', 'Geneva', 'Lausanne', 'Poland', 'Warsaw', 'Krakow', 'Kraków',
  'Belgium', 'Brussels', 'Leuven', 'Denmark', 'Copenhagen', 'Finland', 'Helsinki', 'Norway', 'Oslo',
  'Austria', 'Vienna', 'Czech', 'Prague', 'Portugal', 'Lisbon', 'Luxembourg', 'Estonia', 'Romania',
  'Greece', 'Hungary', 'Budapest', 'Europe', 'EMEA', 'EU',
];
const ASIA_TERMS = [
  'India', 'Bangalore', 'Bengaluru', 'Hyderabad', 'Pune', 'Chennai', 'Noida', 'Taiwan', 'Taipei',
  'Hsinchu', 'Japan', 'Tokyo', 'Osaka', 'Korea', 'Seoul', 'China', 'Shanghai', 'Beijing', 'Shenzhen',
  'Hong Kong', 'Singapore', 'Vietnam', 'Ho Chi Minh', 'Hanoi', 'Malaysia', 'Penang', 'Kuala Lumpur',
  'Philippines', 'Manila', 'Thailand', 'Bangkok', 'Indonesia', 'APAC',
];
const OTHER_TERMS = [
  'Australia', 'Sydney', 'Melbourne', 'Brisbane', 'Auckland', 'New Zealand', 'Israel', 'Tel Aviv', 'Haifa',
  'Mexico', 'Guadalajara', 'Brazil', 'São Paulo', 'Argentina', 'Chile', 'Costa Rica', 'UAE', 'Dubai',
  'Abu Dhabi', 'Saudi', 'Qatar', 'Turkey', 'South Africa', 'Egypt', 'Nigeria', 'Kenya',
];

const reWord = (terms) => new RegExp(`(^|[^A-Za-z])(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![A-Za-z])`, 'i');
const reWordCase = (terms) => new RegExp(`(^|[^A-Za-z])(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?![A-Za-z])`);

const RE_US_COUNTRY = /(^|[^A-Za-z])(United States( of America)?|USA|U\.S\.A?\.?|US)(?![A-Za-z])/;
const RE_US_STATE_ABBR = new RegExp(`,\\s*(${Object.keys(US_STATES).join('|')})(?![A-Za-z])`);
const RE_US_STATE_NAME = reWord(US_STATE_NAMES);
const RE_WASHINGTON_STATE = /(^|[^A-Za-z])Washington(?!\s*,?\s*D\.?C)(?![A-Za-z])/i;
const RE_US_CITY = reWord(US_CITIES);
const RE_CANADA = /(^|[^A-Za-z])Canada(?![A-Za-z])/i;
const RE_CA_PROV = reWord(CA_PROVINCES);
const RE_CA_ABBR = new RegExp(`,\\s*(${CA_ABBR.join('|')})(?![A-Za-z])`);
const RE_CA_CITY = reWord(CA_CITIES);
const RE_EU = reWordCase(EU_TERMS.filter((t) => t === t.toUpperCase()));
const RE_EU_WORDS = reWord(EU_TERMS.filter((t) => t !== t.toUpperCase()));
const RE_ASIA = reWord(ASIA_TERMS);
const RE_OTHER = reWord(OTHER_TERMS);
const RE_REMOTE = /\b(remote|anywhere|work from home|wfh|distributed)\b/i;
const RE_HYBRID = /\bhybrid\b/i;

/** Split combined location strings like "Austin, TX; San Jose, CA" or "Hawthorne, CA | Redmond, WA". */
export function splitLocations(value) {
  if (!value) return [];
  return String(value)
    .split(/\s*(?:;|\||•|\s\/\s|\s+or\s+|\n)\s*/i)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

/** Normalize and de-duplicate a list of raw location strings (preserves first-seen order). */
export function normalizeLocations(values) {
  const out = [];
  const seen = new Set();
  for (const v of values || []) {
    for (const part of splitLocations(v)) {
      const clean = part.replace(/^[-–—,\s]+|[-–—,\s]+$/g, '');
      const key = clean.toLowerCase();
      if (!clean || seen.has(key)) continue;
      seen.add(key);
      out.push(clean);
    }
  }
  return out;
}

function countryHintRegion(hint) {
  if (!hint) return null;
  const h = String(hint).trim().toLowerCase();
  if (['us', 'usa', 'united states', 'united states of america', 'u.s.', 'u.s.a.'].includes(h)) return 'us';
  if (['ca', 'can', 'canada'].includes(h)) return 'ca';
  if (/^(gb|uk|de|fr|nl|ie|es|it|se|ch|pl|be|dk|fi|no|at|cz|pt|lu|ee|ro|gr|hu)$/.test(h) ||
      /(kingdom|germany|france|netherlands|ireland|spain|italy|sweden|switzerland|poland|belgium|denmark|finland|norway|austria|czech|portugal)/.test(h)) return 'eu';
  if (/^(in|tw|jp|kr|cn|hk|sg|vn|my|ph|th|id)$/.test(h) ||
      /(india|taiwan|japan|korea|china|singapore|vietnam|malaysia|philippines|thailand|indonesia)/.test(h)) return 'asia';
  return 'other';
}

/** Region of a single location string: 'us' | 'ca' | 'eu' | 'asia' | 'other' | null (unknown / remote-only). */
export function regionOf(loc) {
  const s = String(loc || '');
  if (!s) return null;
  if (RE_CANADA.test(s) || RE_CA_PROV.test(s) || (RE_CA_ABBR.test(s) && !RE_US_COUNTRY.test(s)) || RE_CA_CITY.test(s)) return 'ca';
  if (RE_US_COUNTRY.test(s) || RE_US_STATE_ABBR.test(s) || RE_US_STATE_NAME.test(s) || RE_US_CITY.test(s) || RE_WASHINGTON_STATE.test(s)) return 'us';
  if (RE_EU.test(s) || RE_EU_WORDS.test(s)) return 'eu';
  if (RE_ASIA.test(s)) return 'asia';
  if (RE_OTHER.test(s)) return 'other';
  return null;
}

/** Regions for a role (sorted, unique). Falls back to a country hint from the ATS. */
export function detectRegions(locations, countryHint) {
  const set = new Set();
  for (const l of locations || []) {
    const r = regionOf(l);
    if (r) set.add(r);
  }
  if (set.size === 0) {
    const r = countryHintRegion(countryHint);
    if (r) set.add(r);
  }
  const order = ['us', 'ca', 'eu', 'asia', 'other'];
  return order.filter((r) => set.has(r));
}

/**
 * Workplace type from ATS hints and location text.
 * @param {string[]} locations
 * @param {string|null} hint - ATS value: 'remote'|'hybrid'|'onsite'|'on-site'|'OnSite'|'Remote'|'Hybrid'|'unspecified'
 * @param {boolean|null} isRemote - Ashby isRemote
 */
export function detectWorkplace(locations, hint, isRemote) {
  const h = String(hint || '').toLowerCase().replace(/[^a-z]/g, '');
  if (h === 'remote' || isRemote === true) return 'remote';
  if (h === 'hybrid') return 'hybrid';
  const text = (locations || []).join(' | ');
  if (RE_REMOTE.test(text)) return 'remote';
  if (RE_HYBRID.test(text)) return 'hybrid';
  if (h === 'onsite') return 'onsite';
  return (locations || []).length ? 'onsite' : 'unknown';
}

export { displayLocations, shortenLocation } from './locdisplay.mjs';
