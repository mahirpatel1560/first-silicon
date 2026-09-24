import * as greenhouse from './greenhouse.mjs';
import * as lever from './lever.mjs';
import * as ashby from './ashby.mjs';
import { fetchJson, defaultSleep } from './http.mjs';

export const ATS = { greenhouse, lever, ashby };
export const ATS_IDS = Object.keys(ATS);

/**
 * Fetch one board. `source` is either { mode: 'live', ...httpOpts } or
 * { mode: 'fixtures', readFixture: async (ats, token) => json|null }.
 * @returns {Promise<{ok, status, error?, count, postings}>}
 */
export async function fetchBoard(company, source) {
  const mod = ATS[company.ats];
  if (!mod) return { ok: false, status: 0, error: `unknown_ats:${company.ats}`, count: 0, postings: [] };
  let res;
  if (source.mode === 'fixtures') {
    const data = await source.readFixture(company.ats, company.token);
    res = data == null ? { ok: false, status: 404, error: 'not_found' } : { ok: true, status: 200, data };
  } else {
    res = await fetchJson(mod.listUrl(company.token), source);
  }
  if (!res.ok) return { ok: false, status: res.status, error: res.error, count: 0, postings: [] };
  let postings;
  try {
    postings = mod.parse(res.data, company);
  } catch (err) {
    return { ok: false, status: res.status, error: `parse_error:${err && err.message}`, count: 0, postings: [] };
  }
  return { ok: true, status: res.status, count: mod.jobCount(res.data), postings };
}

export { fetchJson, defaultSleep };
