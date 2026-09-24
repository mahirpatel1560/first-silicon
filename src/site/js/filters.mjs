// Pure filtering logic shared by the browser app and unit tests.

import { RESTRICTIVE_FLAGS, DISCIPLINE_LABELS, FLAG_LABELS, CLASS_YEAR_LABELS } from '../../lib/labels.mjs';

export const DEFAULT_STATE = Object.freeze({ q: '', d: '', cy: '', t: '', loc: '', cf: false, nw: false });
export const CY_VALUES = ['fs', 'open', 'jplus'];
export const LOC_VALUES = ['remote', 'us', 'ca', 'intl'];

export function parseState(search) {
  const p = new URLSearchParams(search || '');
  const d = p.get('d') || '';
  const cy = p.get('cy') || '';
  const loc = p.get('loc') || '';
  return {
    q: (p.get('q') || '').slice(0, 80),
    d: Object.prototype.hasOwnProperty.call(DISCIPLINE_LABELS, d) ? d : '',
    cy: CY_VALUES.includes(cy) ? cy : '',
    t: (p.get('t') || '').slice(0, 24),
    loc: LOC_VALUES.includes(loc) ? loc : '',
    cf: p.get('cf') === '1',
    nw: p.get('new') === '1',
  };
}

export function serializeState(s) {
  const p = new URLSearchParams();
  if (s.q) p.set('q', s.q);
  if (s.d) p.set('d', s.d);
  if (s.cy) p.set('cy', s.cy);
  if (s.t) p.set('t', s.t);
  if (s.loc) p.set('loc', s.loc);
  if (s.cf) p.set('cf', '1');
  if (s.nw) p.set('new', '1');
  const q = p.toString();
  return q ? `?${q}` : '';
}

export function isActive(s) {
  return Boolean(s.q || s.d || s.cy || s.t || s.loc || s.cf || s.nw);
}

export function daysBetween(a, b) {
  const da = Date.parse(`${String(a).slice(0, 10)}T00:00:00Z`);
  const db = Date.parse(`${String(b).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(da) || Number.isNaN(db)) return NaN;
  return Math.round((db - da) / 86400000);
}

/** Same rule as pipeline.isNew: first seen in the last `days` days and (if dated) posted within 2 x `days`. */
export function isNewJob(job, today, days = 7) {
  const age = daysBetween(job.first_seen, today);
  if (!(Number.isFinite(age) && age >= 0 && age < days)) return false;
  if (!job.posted) return true;
  const postedAge = daysBetween(job.posted, today);
  return !Number.isFinite(postedAge) || postedAge <= 2 * days;
}

export function isCitizenshipFree(job) {
  return !(job.flags || []).some((f) => RESTRICTIVE_FLAGS.includes(f));
}

function haystack(job) {
  if (job._hay) return job._hay;
  const parts = [
    job.title,
    job.company,
    ...(job.locations || []),
    ...(job.disciplines || []).map((d) => (DISCIPLINE_LABELS[d] ? `${DISCIPLINE_LABELS[d].short} ${DISCIPLINE_LABELS[d].label}` : d)),
    ...(job.terms || []),
    job.type === 'co-op' ? 'co-op coop' : 'internship intern',
    job.workplace,
    CLASS_YEAR_LABELS[job.class_year] || '',
    ...(job.flags || []).map((f) => FLAG_LABELS[f] || f),
  ];
  const hay = parts.join(' ').toLowerCase();
  Object.defineProperty(job, '_hay', { value: hay, enumerable: false });
  return hay;
}

export function textMatch(job, q) {
  const tokens = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const hay = haystack(job);
  return tokens.every((t) => hay.includes(t));
}

export function matches(job, s, today, newDays = 7) {
  if (s.d && !(job.disciplines || []).includes(s.d)) return false;
  if (s.cy === 'fs' && job.class_year !== 'fs') return false;
  if (s.cy === 'open' && job.class_year === 'jplus') return false;
  if (s.cy === 'jplus' && job.class_year !== 'jplus') return false;
  if (s.t) {
    if (s.t === 'coop') {
      if (job.type !== 'co-op') return false;
    } else if (s.t === 'none') {
      if ((job.terms || []).length) return false;
    } else if (!(job.terms || []).includes(s.t)) return false;
  }
  if (s.loc === 'remote' && job.workplace !== 'remote') return false;
  if (s.loc === 'us' && !(job.regions || []).includes('us')) return false;
  if (s.loc === 'ca' && !(job.regions || []).includes('ca')) return false;
  if (s.loc === 'intl') {
    const r = job.regions || [];
    if (!r.some((x) => x !== 'us' && x !== 'ca')) return false;
  }
  if (s.cf && !isCitizenshipFree(job)) return false;
  if (s.nw && !isNewJob(job, today, newDays)) return false;
  if (s.q && !textMatch(job, s.q)) return false;
  return true;
}

export function applyFilters(jobs, s, today, newDays = 7) {
  return (jobs || []).filter((j) => matches(j, s, today, newDays));
}

/** Facet counts for select options. */
export function facets(jobs) {
  const disc = {};
  const terms = {};
  let coop = 0;
  let noterm = 0;
  for (const j of jobs || []) {
    for (const d of j.disciplines || []) disc[d] = (disc[d] || 0) + 1;
    for (const t of j.terms || []) terms[t] = (terms[t] || 0) + 1;
    if (j.type === 'co-op') coop++;
    if (!(j.terms || []).length) noterm++;
  }
  const seasonOrder = { Winter: 0, Spring: 1, Summer: 2, Fall: 3 };
  const termList = Object.entries(terms)
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => {
      const [sa, ya] = a.term.split(' ');
      const [sb, yb] = b.term.split(' ');
      return Number(ya) - Number(yb) || seasonOrder[sa] - seasonOrder[sb];
    });
  return { disciplines: disc, terms: termList, coop, noterm };
}
