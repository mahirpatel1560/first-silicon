// Lever Postings API: GET https://api.lever.co/v0/postings/{site}?mode=json
// Published postings are publicly viewable per Lever's postings-api README. Site names are case-sensitive.

import { htmlToText, isoDate, oneLine, normalizeWhitespace } from '../text.mjs';
import { normalizeLocations, detectRegions, detectWorkplace } from '../location.mjs';

export const id = 'lever';
export const prefix = 'lv';

export function listUrl(token) {
  return `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`;
}

export function jobCount(data) {
  return Array.isArray(data) ? data.length : 0;
}

function payFrom(p) {
  const r = p && p.salaryRange;
  if (r && Number.isFinite(r.min) && Number.isFinite(r.max)) {
    const unit = /hour/i.test(r.interval || '') ? '/hr' : /month/i.test(r.interval || '') ? '/mo' : /year|annual/i.test(r.interval || '') ? '/yr' : '';
    const cur = r.currency && r.currency !== 'USD' ? `${r.currency} ` : '$';
    const fmt = (n) => (n >= 1000 && unit !== '/hr' ? `${Math.round(n / 1000)}K` : String(Math.round(n * 100) / 100));
    return `${cur}${fmt(r.min)}–${fmt(r.max)}${unit}`.slice(0, 60);
  }
  return '';
}

/** Parse a Lever postings array into normalized postings. */
export function parse(data, company) {
  const list = Array.isArray(data) ? data : [];
  const out = [];
  for (const p of list) {
    if (!p || !p.id || !p.text || !(p.hostedUrl || p.applyUrl)) continue;
    const cat = p.categories || {};
    const rawLocations = Array.isArray(cat.allLocations) && cat.allLocations.length ? cat.allLocations : [cat.location].filter(Boolean);
    const locations = normalizeLocations(rawLocations);
    const listText = Array.isArray(p.lists)
      ? p.lists.map((l) => `${l && l.text ? l.text : ''}\n${htmlToText(l && l.content ? l.content : '')}`).join('\n')
      : '';
    const description = normalizeWhitespace(
      [p.descriptionPlain || htmlToText(p.description || ''), listText, p.additionalPlain || htmlToText(p.additional || '')]
        .filter(Boolean)
        .join('\n'),
    );
    out.push({
      source: id,
      token: company.token,
      source_id: String(p.id),
      id: `${prefix}:${company.token}:${p.id}`,
      company: company.name,
      company_slug: company.slug,
      category: company.category || '',
      title: oneLine(p.text),
      url: p.hostedUrl || p.applyUrl,
      locations,
      regions: detectRegions(locations, p.country),
      workplace: detectWorkplace(locations, p.workplaceType, null),
      employmentType: cat.commitment || '',
      department: cat.department || cat.team || '',
      posted: isoDate(p.createdAt) || null,
      updated: isoDate(p.updatedAt) || null,
      description,
      pay: payFrom(p),
    });
  }
  return out;
}
