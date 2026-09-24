// Display-only helpers (small enough for the browser bundle).

const US_STATE_ABBR = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT',
  delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
  kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI',
  minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH',
  'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
  oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
  tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV',
  wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC', 'puerto rico': 'PR',
};

/** Short display string for a list of locations. */
export function displayLocations(locations, max = 2) {
  const list = (locations || []).filter(Boolean);
  if (list.length === 0) return 'Location not listed';
  const shown = list.slice(0, max).map(shortenLocation);
  const more = list.length - shown.length;
  return more > 0 ? `${shown.join('; ')} +${more} more` : shown.join('; ');
}

/** "Austin, Texas, United States" -> "Austin, TX"; "Toronto, Ontario, Canada" stays as is. */
export function shortenLocation(loc) {
  let s = String(loc || '').trim();
  s = s.replace(/,\s*(United States of America|United States|USA|US)\s*$/i, '');
  const parts = s.split(',').map((p) => p.trim());
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].toLowerCase();
    if (US_STATE_ABBR[last]) parts[parts.length - 1] = US_STATE_ABBR[last];
    s = parts.join(', ');
  }
  return s;
}
