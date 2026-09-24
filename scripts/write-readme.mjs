#!/usr/bin/env node
// Regenerate README.md from data/ without fetching (fetch.mjs also writes it after each run).
// Usage: node scripts/write-readme.mjs [--data data] [--out README.md]

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as site from '../config/site.mjs';
import { buildReadme } from '../src/lib/readme.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  const argv = process.argv.slice(2);
  const dataDir = argv.includes('--data') ? argv[argv.indexOf('--data') + 1] : 'data';
  const out = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : 'README.md';
  const read = async (f, fb) => {
    try {
      return JSON.parse(await fs.readFile(path.join(ROOT, f), 'utf8'));
    } catch {
      return fb;
    }
  };
  const jobs = (await read(path.join(dataDir, 'jobs.json'), { jobs: [] })).jobs || [];
  const meta = await read(path.join(dataDir, 'meta.json'), { last_run: null });
  const programs = (await read('data/programs.json', { programs: [] })).programs || [];
  const today = meta.last_run ? meta.last_run.slice(0, 10) : site.CONTENT_UPDATED;
  await fs.writeFile(path.join(ROOT, out), buildReadme({ jobs, meta, programs, site, today }));
  console.log(`Wrote ${out} (${jobs.length} roles)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
