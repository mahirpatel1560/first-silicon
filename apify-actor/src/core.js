// Pure helpers for the Actor: input normalization, board specs, filtering and output items.

import { readFileSync } from 'node:fs';
import { classify } from './lib/classify.mjs';
import { RESTRICTIVE_FLAGS, DISCIPLINE_LABELS } from './lib/labels.mjs';
import { ATS } from './lib/fetchers/index.mjs';

const PRESETS = JSON.parse(readFileSync(new URL('./presets.json', import.meta.url), 'utf8'));
export const PRESET_NAMES = ['none', ...Object.keys(PRESETS.presets)];
export const DISCIPLINE_SLUGS = Object.keys(DISCIPLINE_LABELS);

/**
 * Accepts "greenhouse:token", "lever:token", "ashby:token" or a public board URL such as
 * https://boards.greenhouse.io/acme, https://job-boards.greenhouse.io/acme, https://jobs.lever.co/acme,
 * https://jobs.ashbyhq.com/acme. Returns {ats, token} or null.
 */
export function parseBoardSpec(spec) {
  const s = String(spec || '').trim();
  if (!s) return null;
  const pair = s.match(/^(greenhouse|lever|ashby)\s*:\s*([A-Za-z0-9._-]+)$/i);
  if (pair) return { ats: pair[1].toLowerCase(), token: pair[2] };
  let url;
  try {
    url = new URL(s);
  } catch {
    return null;
  }
  const seg = url.pathname.split('/').filter(Boolean);
  const host = url.hostname.toLowerCase();
  if (/(^|\.)greenhouse\.io$/.test(host)) {
    if (host.startsWith('boards-api.')) return seg[2] ? { ats: 'greenhouse', token: seg[2] } : null; // /v1/boards/{token}
    const t = url.searchParams.get('for') || seg[0];
    return t && t !== 'embed' ? { ats: 'greenhouse', token: t } : null;
  }
  if (host === 'jobs.lever.co' || host === 'jobs.eu.lever.co') return seg[0] ? { ats: 'lever', token: seg[0] } : null;
  if (host === 'api.lever.co') return seg[2] ? { ats: 'lever', token: seg[2] } : null; // /v0/postings/{site}
  if (host === 'jobs.ashbyhq.com') return seg[0] ? { ats: 'ashby', token: seg[0] } : null;
  if (host === 'api.ashbyhq.com') return seg[2] ? { ats: 'ashby', token: seg[2] } : null; // /posting-api/job-board/{name}
  return null;
}

function list(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') return v.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);
  return [];
}

export function normalizeInput(input = {}) {
  const errors = [];
  const boards = [];
  const seen = new Set();
  const add = (b) => {
    const key = `${b.ats}:${b.token}`;
    if (seen.has(key)) return;
    seen.add(key);
    boards.push(b);
  };
  const preset = PRESET_NAMES.includes(input.preset) ? input.preset : 'none';
  if (preset !== 'none') {
    const slugs = new Set(PRESETS.presets[preset] || []);
    for (const b of PRESETS.boards) if (slugs.has(b.slug)) add({ ...b });
  }
  for (const spec of list(input.companies)) {
    const b = parseBoardSpec(spec);
    if (!b) {
      errors.push(`Could not parse board "${spec}". Use greenhouse:token, lever:token, ashby:token or a job-board URL.`);
      continue;
    }
    // Name comes from the API when the ATS provides one (Greenhouse company_name); otherwise the token.
    add({ ...b, name: b.token, slug: b.token.toLowerCase(), category: '', useApiName: true });
  }
  const classYear = ['any', 'fs', 'open', 'jplus'].includes(input.classYear) ? input.classYear : 'any';
  const maxItems = Math.max(1, Math.min(100000, Number.isFinite(Number(input.maxItems)) ? Math.floor(Number(input.maxItems)) : 1000));
  return {
    boards,
    errors,
    keywords: list(input.keywords).map((k) => k.toLowerCase()),
    internshipOnly: input.internshipOnly !== false,
    hardwareOnly: Boolean(input.hardwareOnly),
    disciplines: list(input.disciplines).filter((d) => DISCIPLINE_SLUGS.includes(d)),
    classYear,
    excludeRestricted: Boolean(input.excludeRestricted),
    includeSnippet: input.includeSnippet !== false,
    maxItems,
    delayMs: Math.max(250, Math.min(10000, Number(input.requestDelayMs) || 800)),
  };
}

export function toItem(p, c, { includeSnippet = true, fetchedAt }) {
  return {
    company: p.company,
    title: p.title,
    url: p.url,
    ats: p.source,
    boardToken: p.token,
    sourceId: p.source_id,
    locations: p.locations,
    regions: p.regions,
    workplace: p.workplace,
    employmentType: p.employmentType || null,
    department: p.department || null,
    isInternship: c.is_internship,
    type: c.type,
    terms: c.terms,
    disciplines: c.disciplines,
    isHardware: c.is_hardware,
    hardwareScore: c.hw_score,
    classYear: c.class_year,
    flags: c.flags,
    postedAt: p.posted,
    updatedAt: p.updated,
    pay: p.pay || null,
    snippet: includeSnippet ? c.snippet || null : null,
    fetchedAt,
  };
}

export function passes(item, posting, opts) {
  if (opts.internshipOnly && !item.isInternship) return false;
  if (opts.hardwareOnly && !item.isHardware) return false;
  if (opts.disciplines.length && !item.disciplines.some((d) => opts.disciplines.includes(d))) return false;
  if (opts.classYear === 'fs' && item.classYear !== 'fs') return false;
  if (opts.classYear === 'open' && item.classYear === 'jplus') return false;
  if (opts.classYear === 'jplus' && item.classYear !== 'jplus') return false;
  if (opts.excludeRestricted && item.flags.some((f) => RESTRICTIVE_FLAGS.includes(f))) return false;
  if (opts.keywords.length) {
    const hay = `${posting.title}\n${posting.description || ''}`.toLowerCase();
    if (!opts.keywords.some((k) => hay.includes(k))) return false;
  }
  return true;
}

/** Classify postings from one board and return the items that pass the filters (at most `room`). */
export function itemsFromPostings(postings, opts, { now = new Date(), room = Infinity } = {}) {
  const fetchedAt = now.toISOString();
  const out = [];
  for (const p of postings) {
    if (out.length >= room) break;
    const c = classify({ title: p.title, description: p.description, employmentType: p.employmentType, category: p.category }, { now });
    const item = toItem(p, c, { includeSnippet: opts.includeSnippet, fetchedAt });
    if (passes(item, p, opts)) out.push(item);
  }
  return out;
}

export function boardUrl(b) {
  return ATS[b.ats] ? ATS[b.ats].listUrl(b.token) : null;
}
