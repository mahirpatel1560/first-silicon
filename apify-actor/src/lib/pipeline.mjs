// Pure pipeline steps: classify -> filter -> dedupe -> merge with previous run -> counts.

import { classify, RESTRICTIVE_FLAGS } from './classify.mjs';
import { hashId, daysBetween } from './text.mjs';

export const STALE_CARRY_DAYS = 7; // keep roles from a temporarily failing board for at most this long
export const CLOSED_LOG_DAYS = 60;

export function normalizeTitle(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9+#]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function roleKey(companySlug, title) {
  return `${companySlug}|${normalizeTitle(title)}`;
}

export function roleId(companySlug, title) {
  return `r${hashId(roleKey(companySlug, title))}`;
}

/** Classify postings and keep hardware internships/co-ops. Returns roles (pre-dedupe) + counters. */
export function selectRoles(postings, { now }) {
  const stats = { postings_seen: 0, internships_seen: 0, hardware_internships: 0 };
  const roles = [];
  for (const p of postings) {
    stats.postings_seen++;
    const c = classify(
      { title: p.title, description: p.description, employmentType: p.employmentType, category: p.category },
      { now },
    );
    if (!c.is_internship) continue;
    stats.internships_seen++;
    if (!c.is_hardware) continue;
    stats.hardware_internships++;
    roles.push({
      id: roleId(p.company_slug, p.title),
      company: p.company,
      company_slug: p.company_slug,
      title: p.title,
      url: p.url,
      ats: p.source,
      locations: p.locations,
      regions: p.regions,
      workplace: p.workplace,
      type: c.type,
      terms: c.terms,
      year_hint: c.year_hint,
      disciplines: c.disciplines,
      class_year: c.class_year,
      flags: c.flags,
      hw_score: c.hw_score,
      posted: p.posted,
      updated: p.updated,
      snippet: c.snippet,
      pay: p.pay || '',
      source_ids: [`${p.source}:${p.token}:${p.source_id}`],
    });
  }
  return { roles, stats };
}

const CY_RANK = { fs: 2, jplus: 1, unspecified: 0 };
const WP_RANK = { remote: 3, hybrid: 2, onsite: 1, unknown: 0 };
const uniq = (a) => [...new Set(a)];

/** Merge duplicates (same company + normalized title) across locations and boards. */
export function dedupeRoles(roles) {
  const byId = new Map();
  for (const r of roles) {
    const prev = byId.get(r.id);
    if (!prev) {
      byId.set(r.id, { ...r, also: 0 });
      continue;
    }
    // Primary posting: the earliest posted (stable), ties broken by URL.
    const rDate = r.posted || '9999';
    const pDate = prev.posted || '9999';
    const rIsPrimary = rDate < pDate || (rDate === pDate && r.url < prev.url);
    const primary = rIsPrimary ? r : prev;
    const merged = {
      ...primary,
      locations: uniq([...(rIsPrimary ? r.locations : prev.locations), ...(rIsPrimary ? prev.locations : r.locations)]),
      regions: uniq([...prev.regions, ...r.regions]).sort(),
      workplace: WP_RANK[r.workplace] > WP_RANK[prev.workplace] ? r.workplace : prev.workplace,
      terms: uniq([...prev.terms, ...r.terms]),
      disciplines: uniq([...prev.disciplines, ...r.disciplines]).filter((d, _, all) => d !== 'general' || all.length === 1),
      class_year: CY_RANK[r.class_year] > CY_RANK[prev.class_year] ? r.class_year : prev.class_year,
      snippet: CY_RANK[r.class_year] > CY_RANK[prev.class_year] ? r.snippet || prev.snippet : prev.snippet || r.snippet,
      flags: uniq([...prev.flags, ...r.flags]),
      hw_score: Math.max(prev.hw_score, r.hw_score),
      posted: [prev.posted, r.posted].filter(Boolean).sort()[0] || null,
      updated: [prev.updated, r.updated].filter(Boolean).sort().reverse()[0] || null,
      pay: prev.pay || r.pay,
      source_ids: uniq([...prev.source_ids, ...r.source_ids]).sort(),
      also: (prev.also || 0) + 1,
    };
    byId.set(r.id, merged);
  }
  return [...byId.values()];
}

/**
 * Merge with the previous run.
 * - first_seen persists by role id; new roles get `today`.
 * - roles missing from a board that fetched OK are closed (removed) and logged.
 * - roles from a board that failed this run are carried over for up to STALE_CARRY_DAYS.
 */
export function mergeWithPrevious(current, previous, { today, failedCompanies = new Set(), previousClosed = [] }) {
  const prevById = new Map((previous || []).map((j) => [j.id, j]));
  const curIds = new Set(current.map((r) => r.id));
  const jobs = [];
  let added = 0;
  for (const r of current) {
    const prev = prevById.get(r.id);
    if (!prev) added++;
    jobs.push({ ...r, first_seen: prev ? prev.first_seen : today, last_seen: today, stale: undefined });
  }
  const closed = [];
  let carried = 0;
  for (const p of previous || []) {
    if (curIds.has(p.id)) continue;
    if (failedCompanies.has(p.company_slug)) {
      const age = daysBetween(p.last_seen || p.first_seen, today);
      if (Number.isFinite(age) && age <= STALE_CARRY_DAYS) {
        jobs.push({ ...p, stale: true });
        carried++;
        continue;
      }
    }
    closed.push({ id: p.id, company: p.company, title: p.title, first_seen: p.first_seen, closed_on: today });
  }
  const closedLog = [...closed, ...(previousClosed || [])]
    .filter((c) => {
      const age = daysBetween(c.closed_on, today);
      return Number.isFinite(age) && age <= CLOSED_LOG_DAYS;
    })
    .slice(0, 2000);
  for (const j of jobs) if (j.stale === undefined) delete j.stale;
  return { jobs: sortJobs(jobs), closed, closedLog, added, carried };
}

/** Newest first: posted (or first_seen) desc, then first_seen desc, company, title. */
export function sortJobs(jobs) {
  return [...jobs].sort((a, b) => {
    const da = a.posted || a.first_seen || '';
    const db = b.posted || b.first_seen || '';
    if (da !== db) return da < db ? 1 : -1;
    const fa = a.first_seen || '';
    const fb = b.first_seen || '';
    if (fa !== fb) return fa < fb ? 1 : -1;
    return a.company.localeCompare(b.company) || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  });
}

/**
 * "New this week": first seen in the last `days` days and, when the employer publishes a date,
 * posted within the last 2 x `days` days (so old postings on a newly added board are not "new").
 */
export function isNew(job, today, days = 7) {
  const age = daysBetween(job.first_seen, today);
  if (!(Number.isFinite(age) && age >= 0 && age < days)) return false;
  if (!job.posted) return true;
  const postedAge = daysBetween(job.posted, today);
  return !Number.isFinite(postedAge) || postedAge <= 2 * days;
}

export function isCitizenshipFree(job) {
  return !(job.flags || []).some((f) => RESTRICTIVE_FLAGS.includes(f));
}

/** Aggregate counts for meta.json and page copy. */
export function computeCounts(jobs, today, newDays = 7) {
  const counts = {
    roles: jobs.length,
    internships: 0,
    coops: 0,
    fs: 0,
    jplus: 0,
    unspecified: 0,
    citizenship_free: 0,
    new_this_week: 0,
    remote: 0,
    companies: 0,
    by_discipline: {},
    by_term: {},
  };
  const companies = new Set();
  for (const j of jobs) {
    companies.add(j.company_slug);
    if (j.type === 'co-op') counts.coops++;
    else counts.internships++;
    counts[j.class_year] = (counts[j.class_year] || 0) + 1;
    if (isCitizenshipFree(j)) counts.citizenship_free++;
    if (isNew(j, today, newDays)) counts.new_this_week++;
    if (j.workplace === 'remote') counts.remote++;
    for (const d of j.disciplines || []) counts.by_discipline[d] = (counts.by_discipline[d] || 0) + 1;
    for (const t of j.terms || []) counts.by_term[t] = (counts.by_term[t] || 0) + 1;
  }
  counts.companies = companies.size;
  counts.by_discipline = Object.fromEntries(Object.entries(counts.by_discipline).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
  counts.by_term = Object.fromEntries(Object.entries(counts.by_term).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
  return counts;
}

/** Public shape written to data/jobs.json (drops internal fields). */
export function publicJob(j) {
  const out = {
    id: j.id,
    company: j.company,
    company_slug: j.company_slug,
    title: j.title,
    url: j.url,
    ats: j.ats,
    locations: j.locations,
    regions: j.regions,
    workplace: j.workplace,
    type: j.type,
    terms: j.terms,
    year_hint: j.year_hint ?? null,
    disciplines: j.disciplines,
    class_year: j.class_year,
    flags: j.flags,
    hw_score: j.hw_score,
    posted: j.posted ?? null,
    updated: j.updated ?? null,
    first_seen: j.first_seen,
    last_seen: j.last_seen,
    snippet: j.snippet || '',
    pay: j.pay || '',
    also: j.also || 0,
  };
  if (j.stale) out.stale = true;
  if (j.source_ids) out.source_ids = j.source_ids;
  return out;
}
