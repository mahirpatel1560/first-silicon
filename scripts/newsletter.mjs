#!/usr/bin/env node
// Build this week's digest into newsletter/out/<date>.html and .txt. Does not send anything.
// Usage: node scripts/newsletter.mjs [--data data] [--out newsletter/out] [--now 2026-09-23]
// Paste the HTML into your email tool; replace {{UNSUBSCRIBE_URL}} and {{MAILING_ADDRESS}} there.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as site from '../config/site.mjs';
import { buildDigest } from '../src/lib/newsletter.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const a = { data: 'data', out: 'newsletter/out', now: null, featured: null, notice: '' };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--data') a.data = argv[++i];
    else if (argv[i] === '--out') a.out = argv[++i];
    else if (argv[i] === '--now') a.now = argv[++i];
    else if (argv[i] === '--featured') a.featured = argv[++i]; // path to JSON {company,title,url}
    else if (argv[i] === '--notice') a.notice = argv[++i];
  }
  return a;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const abs = (p) => (path.isAbsolute(p) ? p : path.join(ROOT, p));
  const today = (args.now ? new Date(args.now) : new Date()).toISOString().slice(0, 10);
  const jobs = JSON.parse(await fs.readFile(abs(path.join(args.data, 'jobs.json')), 'utf8')).jobs || [];
  const programs = JSON.parse(await fs.readFile(abs('data/programs.json'), 'utf8')).programs || [];
  const featured = args.featured ? JSON.parse(await fs.readFile(abs(args.featured), 'utf8')) : null;
  const digest = buildDigest({ jobs, programs, today, siteUrl: site.BASE_URL, featured, notice: args.notice });
  const outDir = abs(args.out);
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, `${today}.html`), digest.html);
  await fs.writeFile(path.join(outDir, `${today}.txt`), `Subject: ${digest.subject}\n\n${digest.text}\n`);
  console.log(`Wrote ${path.relative(ROOT, outDir)}/${today}.html and .txt: "${digest.subject}"`, digest.stats);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
