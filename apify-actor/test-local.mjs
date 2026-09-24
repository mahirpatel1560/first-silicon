#!/usr/bin/env node
// Local test of the Actor with the Apify SDK's local storage (no platform, no publishing).
// Run 1: fixture responses (offline). Run 2 (optional, --live): real API call; in a sandbox without
// egress it must fail gracefully (0 items, board marked failed, run still succeeds).

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));

function runActor(name, input, extraEnv = {}) {
  const storage = path.join(DIR, `.tmp-storage-${name}`);
  fs.rmSync(storage, { recursive: true, force: true });
  fs.mkdirSync(path.join(storage, 'key_value_stores', 'default'), { recursive: true });
  fs.writeFileSync(path.join(storage, 'key_value_stores', 'default', 'INPUT.json'), JSON.stringify(input, null, 2));
  const started = Date.now();
  const res = spawnSync(process.execPath, ['src/main.js'], {
    cwd: DIR,
    env: { ...process.env, APIFY_LOCAL_STORAGE_DIR: storage, CRAWLEE_STORAGE_DIR: storage, APIFY_HEADLESS: '1', ...extraEnv },
    encoding: 'utf8',
    timeout: 180000,
  });
  const dsDir = path.join(storage, 'datasets', 'default');
  const items = fs.existsSync(dsDir)
    ? fs.readdirSync(dsDir).filter((f) => f.endsWith('.json')).sort().map((f) => JSON.parse(fs.readFileSync(path.join(dsDir, f), 'utf8')))
    : [];
  const summaryFile = path.join(storage, 'key_value_stores', 'default', 'RUN_SUMMARY.json');
  const summary = fs.existsSync(summaryFile) ? JSON.parse(fs.readFileSync(summaryFile, 'utf8')) : null;
  return { status: res.status, stdout: res.stdout, stderr: res.stderr, items, summary, ms: Date.now() - started, storage };
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exitCode = 1;
  } else console.log(`ok: ${msg}`);
}

const fixtures = path.resolve(DIR, '..', 'fixtures', 'api');
const r1 = runActor(
  'fixtures',
  {
    preset: 'none',
    companies: [
      'greenhouse:vireosilicon',
      'greenhouse:halcyonorbital',
      'https://job-boards.greenhouse.io/kestrelgrid',
      'lever:tamarackrobotics',
      'https://jobs.lever.co/BrightwaterAvionics',
      'ashby:lumenfab',
      'https://jobs.ashbyhq.com/quillcircuits',
      'greenhouse:ghostboard',
    ],
    internshipOnly: true,
    hardwareOnly: true,
    classYear: 'any',
    maxItems: 500,
    includeSnippet: true,
  },
  { FS_FIXTURES_DIR: fixtures },
);
console.log(`--- run 1 (fixtures): exit ${r1.status}, ${r1.items.length} items, ${r1.ms} ms`);
if (r1.status !== 0) console.log(r1.stdout, r1.stderr);
assert(r1.status === 0, 'actor exits 0');
assert(r1.items.length >= 30, `pushed >= 30 hardware internship items (got ${r1.items.length})`);
assert(r1.items.every((i) => i.isInternship && i.isHardware), 'every item is a hardware internship');
assert(r1.items.every((i) => i.url && i.title && i.company && Array.isArray(i.flags)), 'items have url/title/company/flags');
assert(r1.items.every((i) => !i.snippet || i.snippet.length <= 300), 'snippets are at most 300 characters');
assert(r1.items.every((i) => !('description' in i)), 'no full descriptions in output');
assert(r1.summary && r1.summary.boardsFailed === 1 && r1.summary.boardsRead === 7, 'summary: 7 boards read, 1 failed (missing fixture)');
assert(r1.items.some((i) => i.classYear === 'fs') && r1.items.some((i) => i.classYear === 'jplus'), 'class-year labels present');
assert(r1.items.some((i) => i.flags.includes('export')), 'export-control flags present');

const r2 = runActor('filters', { preset: 'none', companies: ['greenhouse:vireosilicon', 'greenhouse:halcyonorbital', 'ashby:lumenfab'], classYear: 'fs', excludeRestricted: true, disciplines: ['digital', 'photonics'], maxItems: 2 }, { FS_FIXTURES_DIR: fixtures });
console.log(`--- run 2 (filters + maxItems): exit ${r2.status}, ${r2.items.length} items`);
assert(r2.status === 0 && r2.items.length === 2, 'maxItems=2 respected');
assert(r2.items.every((i) => i.classYear === 'fs' && !i.flags.some((f) => ['citizenship', 'residency', 'export', 'clearance'].includes(f))), 'class-year and restriction filters applied');

if (process.argv.includes('--live')) {
  const r3 = runActor('live', { preset: 'none', companies: ['greenhouse:spacex'], maxItems: 5 }, { NODE_USE_ENV_PROXY: '1' });
  console.log(`--- run 3 (live): exit ${r3.status}, ${r3.items.length} items, ${r3.ms} ms, summary ${JSON.stringify(r3.summary && r3.summary.boards)}`);
  assert(r3.status === 0, 'live run exits 0 even when the API host is unreachable');
}

for (const name of ['fixtures', 'filters', 'live']) fs.rmSync(path.join(DIR, `.tmp-storage-${name}`), { recursive: true, force: true });
console.log(process.exitCode ? 'ACTOR LOCAL TEST: FAILED' : 'ACTOR LOCAL TEST: PASSED');
