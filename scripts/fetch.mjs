#!/usr/bin/env node
// Daily data run: fetch every verified board, classify, dedupe, merge with the previous run,
// then write data/jobs.json, data/meta.json, data/closed.json and README.md.
//
// Usage:
//   node scripts/fetch.mjs                          # live (used by the GitHub Action)
//   node scripts/fetch.mjs --fixtures fixtures/api --companies fixtures/companies.fixture.json --out .demo-data --no-readme
// Options: --now <ISO date>  --only slug1,slug2  --delay <ms>  --readme <path>  --force

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as site from '../config/site.mjs';
import { fetchBoard } from '../src/lib/fetchers/index.mjs';
import { defaultSleep } from '../src/lib/fetchers/http.mjs';
import { selectRoles, dedupeRoles, mergeWithPrevious, computeCounts, publicJob } from '../src/lib/pipeline.mjs';
import { buildReadme } from '../src/lib/readme.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function parseArgs(argv) {
  const args = { fixtures: null, companies: 'config/companies.json', out: 'data', readme: 'README.md', noReadme: false, now: null, only: null, delay: site.FETCH_DELAY_MS, force: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--fixtures') args.fixtures = next();
    else if (a === '--companies') args.companies = next();
    else if (a === '--out') args.out = next();
    else if (a === '--readme') args.readme = next();
    else if (a === '--no-readme') args.noReadme = true;
    else if (a === '--now') args.now = next();
    else if (a === '--only') args.only = next().split(',').map((s) => s.trim()).filter(Boolean);
    else if (a === '--delay') args.delay = Number(next());
    else if (a === '--force') args.force = true;
    else throw new Error(`Unknown option ${a}`);
  }
  return args;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

/** Boards to fetch: verified (ok/empty) and never-probed entries with a token. */
export function boardsToFetch(companies, only) {
  return companies
    .filter((c) => c.ats && c.token && ['ok', 'empty', 'unprobed'].includes(c.status))
    .filter((c) => !only || only.includes(c.slug));
}

export async function run(args, { log = console.log, fetchImpl } = {}) {
  const abs = (p) => (path.isAbsolute(p) ? p : path.join(ROOT, p));
  const now = args.now ? new Date(args.now) : new Date();
  const today = now.toISOString().slice(0, 10);
  const companiesFile = await readJson(abs(args.companies), null);
  if (!companiesFile) throw new Error(`Cannot read ${args.companies}`);
  const companies = companiesFile.companies || companiesFile;
  const boards = boardsToFetch(companies, args.only);
  const outDir = abs(args.out);
  await fs.mkdir(outDir, { recursive: true });

  const source = args.fixtures
    ? {
        mode: 'fixtures',
        readFixture: async (ats, token) => readJson(path.join(abs(args.fixtures), ats, `${token}.json`), null),
      }
    : {
        mode: 'live',
        userAgent: site.USER_AGENT,
        timeoutMs: site.FETCH_TIMEOUT_MS,
        retries: site.FETCH_RETRIES,
        ...(fetchImpl ? { fetchImpl } : {}),
      };

  const boardResults = [];
  const allPostings = [];
  for (let i = 0; i < boards.length; i++) {
    const c = boards[i];
    const res = await fetchBoard(c, source);
    boardResults.push({ slug: c.slug, ats: c.ats, token: c.token, ok: res.ok, status: res.status, error: res.error || null, count: res.count });
    if (res.ok) allPostings.push(...res.postings);
    log(`${res.ok ? 'ok  ' : 'FAIL'} ${c.ats.padEnd(10)} ${c.token.padEnd(24)} ${res.ok ? `${res.count} postings` : res.error}`);
    if (source.mode === 'live' && i < boards.length - 1 && args.delay > 0) await defaultSleep(args.delay);
  }

  const okBoards = boardResults.filter((b) => b.ok).length;
  const failedCompanies = new Set(boardResults.filter((b) => !b.ok).map((b) => b.slug));
  if (boards.length && okBoards / boards.length < 0.5 && !args.force) {
    log(`Only ${okBoards}/${boards.length} boards succeeded; keeping previous data (use --force to override).`);
    return { aborted: true, boardResults };
  }

  const { roles, stats } = selectRoles(allPostings, { now });
  const deduped = dedupeRoles(roles);
  const prevJobsFile = await readJson(path.join(outDir, 'jobs.json'), { jobs: [] });
  const prevClosed = await readJson(path.join(outDir, 'closed.json'), { closed: [] });
  const merged = mergeWithPrevious(deduped, prevJobsFile.jobs || [], { today, failedCompanies, previousClosed: prevClosed.closed || [] });
  const jobs = merged.jobs.map(publicJob);
  const counts = computeCounts(jobs, today, site.NEW_DAYS);
  const meta = {
    schema: 1,
    last_run: now.toISOString(),
    source: args.fixtures ? 'fixtures' : 'live',
    status: okBoards === boards.length ? 'ok' : 'partial',
    boards: {
      configured: companies.length,
      attempted: boards.length,
      ok: okBoards,
      empty: boardResults.filter((b) => b.ok && b.count === 0).length,
      failed: boards.length - okBoards,
      failed_list: boardResults.filter((b) => !b.ok).map((b) => `${b.ats}:${b.token} (${b.error})`),
    },
    postings_seen: stats.postings_seen,
    internships_seen: stats.internships_seen,
    hardware_internship_postings: stats.hardware_internships,
    counts,
    new_since_last_run: merged.added,
    closed_since_last_run: merged.closed.length,
    carried_over_from_failed_boards: merged.carried,
  };
  await fs.writeFile(path.join(outDir, 'jobs.json'), JSON.stringify({ schema: 1, generated_at: meta.last_run, count: jobs.length, jobs }, null, 1) + '\n');
  await fs.writeFile(path.join(outDir, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  await fs.writeFile(path.join(outDir, 'closed.json'), JSON.stringify({ schema: 1, closed: merged.closedLog }, null, 1) + '\n');

  if (!args.noReadme) {
    const programs = (await readJson(abs('data/programs.json'), { programs: [] })).programs || [];
    const readme = buildReadme({ jobs, meta, programs, site, today });
    await fs.writeFile(abs(args.readme), readme);
  }
  log(`\n${stats.postings_seen} postings from ${okBoards}/${boards.length} boards -> ${stats.internships_seen} internships -> ${jobs.length} hardware roles (${counts.fs} Fr/So friendly, ${merged.added} new, ${merged.closed.length} closed).`);
  return { aborted: false, meta, jobs, boardResults };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(parseArgs(process.argv.slice(2))).then(
    (r) => process.exit(r.aborted ? 2 : 0),
    (err) => {
      console.error(err);
      process.exit(1);
    },
  );
}
