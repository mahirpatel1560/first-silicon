#!/usr/bin/env node
// Builds .demo-data/ from the FICTIONAL fixture boards, as if a previous run had happened.
// Used for tests, screenshots and the demo build. Never used for the production dist/.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { roleId } from '../src/lib/pipeline.mjs';
import { run } from './fetch.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DEMO_NOW = '2026-09-23T12:00:00Z';

export async function makeDemoData({ out = '.demo-data', now = DEMO_NOW, log = () => {} } = {}) {
  const outDir = path.join(ROOT, out);
  await fs.rm(outDir, { recursive: true, force: true });
  await fs.mkdir(outDir, { recursive: true });
  const seed = JSON.parse(await fs.readFile(path.join(ROOT, 'fixtures/previous-run.seed.json'), 'utf8'));
  const jobs = seed.roles.map((r) => ({
    id: roleId(r.company_slug, r.title),
    company: r.company,
    company_slug: r.company_slug,
    title: r.title,
    url: 'https://example.invalid/closed',
    first_seen: r.first_seen,
    last_seen: '2026-09-22',
  }));
  await fs.writeFile(path.join(outDir, 'jobs.json'), JSON.stringify({ schema: 1, jobs }, null, 1));
  return run(
    { fixtures: 'fixtures/api', companies: 'fixtures/companies.fixture.json', out, readme: path.join(out, 'README.md'), noReadme: false, now, only: null, delay: 0, force: false },
    { log },
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  makeDemoData({ log: console.log }).then((r) => {
    console.log(`demo data: ${r.jobs.length} roles`);
  });
}
