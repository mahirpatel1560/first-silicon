// Ashby public job posting API:
// GET https://api.ashbyhq.com/posting-api/job-board/{JOB_BOARD_NAME}?includeCompensation=true

import { htmlToText, isoDate, oneLine } from '../text.mjs';
import { normalizeLocations, detectRegions, detectWorkplace } from '../location.mjs';

export const id = 'ashby';
export const prefix = 'ab';

export function listUrl(token) {
  return `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}?includeCompensation=true`;
}

export function jobCount(data) {
  return Array.isArray(data && data.jobs) ? data.jobs.filter((j) => j && j.isListed !== false).length : 0;
}

function idFromUrl(url) {
  const m = String(url || '').match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  return m ? m[1] : null;
}

/** Parse an Ashby job-board response into normalized postings. */
export function parse(data, company) {
  const jobs = Array.isArray(data && data.jobs) ? data.jobs : [];
  const out = [];
  for (const j of jobs) {
    if (!j || !j.title || !j.jobUrl || j.isListed === false) continue;
    const sid = j.id || idFromUrl(j.jobUrl);
    if (!sid) continue;
    const secondary = Array.isArray(j.secondaryLocations) ? j.secondaryLocations.map((s) => s && s.location).filter(Boolean) : [];
    const locations = normalizeLocations([j.location, ...secondary].filter(Boolean));
    const country = j.address && j.address.postalAddress ? j.address.postalAddress.addressCountry : null;
    const comp = j.compensation || {};
    const pay = String(comp.scrapeableCompensationSalarySummary || comp.compensationTierSummary || '').slice(0, 60);
    out.push({
      source: id,
      token: company.token,
      source_id: String(sid),
      id: `${prefix}:${company.token}:${sid}`,
      company: company.name,
      company_slug: company.slug,
      category: company.category || '',
      title: oneLine(j.title),
      url: j.jobUrl,
      locations,
      regions: detectRegions(locations, country),
      workplace: detectWorkplace(locations, j.workplaceType, j.isRemote),
      employmentType: j.employmentType || '',
      department: j.department || j.team || '',
      posted: isoDate(j.publishedAt) || null,
      updated: null,
      description: j.descriptionPlain || htmlToText(j.descriptionHtml || ''),
      pay: j.shouldDisplayCompensationOnJobPostings === false ? '' : pay,
    });
  }
  return out;
}
