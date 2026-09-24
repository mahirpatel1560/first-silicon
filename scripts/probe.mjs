#!/usr/bin/env node
// Probe board tokens live and record which return HTTP 200 with jobs. Runs in the GitHub Action
// (the build container's egress proxy blocked these hosts, so the initial probe used WebFetch).
//
// Usage: node scripts/probe.mjs [--stale-days 7] [--all] [--only slug,slug] [--dry-run]
// - Re-probes companies whose last probe is older than --stale-days, or that are not 'ok'.
// - 'unsupported_ats' companies (Workday, iCIMS, ...) are skipped unless --all.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as site from '../config/site.mjs';
import { ATS } from '../src/lib/fetchers/index.mjs';
import { fetchJson, defaultSleep } from '../src/lib/fetchers/http.mjs';
import { daysBetween } from '../src/lib/text.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'config', 'companies.json');

function parseArgs(argv) {
  const a = { staleDays: 7, all: false, only: null, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--stale-days') a.staleDays = Number(argv[++i]);
    else if (argv[i] === '--all') a.all = true;
    else if (argv[i] === '--only') a.only = argv[++i].split(',');
    else if (argv[i] === '--dry-run') a.dryRun = true;
  }
  return a;
}

export function needsProbe(c, today, { staleDays = 7, all = false } = {}) {
  if (c.status === 'unsupported_ats' && !all) return false;
  const last = c.probe && c.probe.probed_on;
  if (!last) return true;
  if (c.status !== 'ok') return daysBetween(last, today) >= staleDays;
  return daysBetween(last, today) >= staleDays;
}

export function candidatesFor(c) {
  const list = [];
  if (c.ats && c.token) list.push({ ats: c.ats, token: c.token });
  for (const k of c.candidates || []) if (!list.some((x) => x.ats === k.ats && x.token === k.token)) list.push(k);
  return list;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const file = JSON.parse(await fs.readFile(FILE, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  let probed = 0;
  for (const c of file.companies) {
    if (args.only && !args.only.includes(c.slug)) continue;
    if (!needsProbe(c, today, args)) continue;
    let found = null;
    let emptyHit = null;
    for (const cand of candidatesFor(c)) {
      const mod = ATS[cand.ats];
      if (!mod) continue;
      const res = await fetchJson(mod.listUrl(cand.token), { userAgent: site.USER_AGENT, timeoutMs: site.FETCH_TIMEOUT_MS, retries: 2 });
      probed++;
      await defaultSleep(site.FETCH_DELAY_MS);
      if (res.ok) {
        const n = mod.jobCount(res.data);
        if (n > 0) { found = { ...cand, jobs: n }; break; }
        if (!emptyHit) emptyHit = { ...cand, jobs: 0 };
      }
    }
    const hit = found || emptyHit;
    c.probe = { ...(c.probe || {}), probed_on: today, method: 'live', jobs_seen: hit ? String(hit.jobs) : '0' };
    if (hit) {
      c.ats = hit.ats;
      c.token = hit.token;
      c.status = hit.jobs > 0 ? 'ok' : 'empty';
    } else if (c.status !== 'unsupported_ats') {
      c.status = 'not_found';
    }
    console.log(`${c.status.padEnd(15)} ${c.slug.padEnd(28)} ${hit ? `${hit.ats}:${hit.token} (${hit.jobs})` : ''}`);
  }
  file.updated_on = today;
  file.summary = summarize(file.companies);
  if (!args.dryRun) await fs.writeFile(FILE, JSON.stringify(file, null, 2) + '\n');
  console.log(`\nProbed ${probed} candidate URLs.`, file.summary);
}

export function summarize(companies) {
  const s = { companies: companies.length };
  for (const c of companies) s[c.status] = (s[c.status] || 0) + 1;
  return s;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
