// Greenhouse Job Board API: GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
// Public and unauthenticated per Greenhouse's docs. `content` is entity-escaped HTML.

import { greenhouseContentToText, isoDate, oneLine } from '../text.mjs';
import { normalizeLocations, detectRegions, detectWorkplace } from '../location.mjs';

export const id = 'greenhouse';
export const prefix = 'gh';

export function listUrl(token) {
  return `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true`;
}

export function jobCount(data) {
  return Array.isArray(data && data.jobs) ? data.jobs.length : 0;
}

function employmentFromMetadata(metadata) {
  if (!Array.isArray(metadata)) return '';
  for (const m of metadata) {
    if (!m || typeof m.name !== 'string') continue;
    if (/employment|job type|position type|type of (?:role|position|employment)|worker type/i.test(m.name)) {
      const v = Array.isArray(m.value) ? m.value.join(' ') : m.value;
      if (typeof v === 'string') return v;
    }
  }
  return '';
}

/** Parse a Greenhouse jobs response into normalized postings. */
export function parse(data, company) {
  const jobs = Array.isArray(data && data.jobs) ? data.jobs : [];
  const out = [];
  for (const j of jobs) {
    if (!j || j.id == null || !j.title || !j.absolute_url) continue;
    const rawLocations = [];
    if (j.location && j.location.name) rawLocations.push(j.location.name);
    if (!rawLocations.length && Array.isArray(j.offices)) {
      for (const o of j.offices) if (o && (o.location || o.name)) rawLocations.push(o.location || o.name);
    }
    const locations = normalizeLocations(rawLocations);
    const officeCountry = Array.isArray(j.offices) && j.offices[0] ? j.offices[0].location : null;
    out.push({
      source: id,
      token: company.token,
      source_id: String(j.id),
      id: `${prefix}:${company.token}:${j.id}`,
      company: company.useApiName && j.company_name ? String(j.company_name) : company.name,
      company_slug: company.slug,
      category: company.category || '',
      title: oneLine(j.title),
      url: j.absolute_url,
      locations,
      regions: detectRegions(locations, officeCountry),
      workplace: detectWorkplace(locations, null, null),
      employmentType: employmentFromMetadata(j.metadata),
      department: Array.isArray(j.departments) && j.departments[0] ? j.departments[0].name || '' : '',
      posted: isoDate(j.first_published) || null,
      updated: isoDate(j.updated_at) || null,
      description: greenhouseContentToText(j.content),
      pay: '',
    });
  }
  return out;
}
