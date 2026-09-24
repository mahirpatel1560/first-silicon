#!/usr/bin/env node
// Copies the shared fetchers + classifier into apify-actor/src/lib (the Actor is built standalone on Apify),
// and regenerates apify-actor/src/presets.json from config/companies.json.
// Usage: node scripts/sync-actor.mjs [--check]   (--check exits 1 if anything is out of date)

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SHARED = [
  'text.mjs', 'location.mjs', 'locdisplay.mjs', 'labels.mjs', 'disciplines.mjs', 'classify.mjs', 'pipeline.mjs',
  'fetchers/http.mjs', 'fetchers/greenhouse.mjs', 'fetchers/lever.mjs', 'fetchers/ashby.mjs', 'fetchers/index.mjs',
];

export async function presetsJson() {
  const cfg = JSON.parse(await fs.readFile(path.join(ROOT, 'config/companies.json'), 'utf8'));
  const boards = cfg.companies
    .filter((c) => c.status === 'ok' || c.status === 'empty')
    .map((c) => ({ name: c.name, slug: c.slug, category: c.category, ats: c.ats, token: c.token }))
    .sort((a, b) => a.slug.localeCompare(b.slug));
  const by = (cats) => boards.filter((b) => cats.includes(b.category)).map((b) => b.slug);
  const presets = {
    about: `Generated from config/companies.json (${cfg.updated_on}). Boards verified to answer on that date.`,
    boards,
    presets: {
      hardware: boards.map((b) => b.slug),
      semiconductors: by(['semiconductors', 'eda', 'photonics', 'quantum']),
      space_aerospace_defense: by(['space', 'aerospace', 'defense']),
      robotics_autonomy: by(['robotics', 'autonomy']),
      energy_ev: by(['energy', 'ev', 'fusion-nuclear']),
      devices_consumer_medical: by(['devices', 'consumer', 'medical', 'manufacturing', 'compute', 'networking']),
    },
  };
  return JSON.stringify(presets, null, 1) + '\n';
}

async function main() {
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const rel of SHARED) {
    const src = path.join(ROOT, 'src/lib', rel);
    const dst = path.join(ROOT, 'apify-actor/src/lib', rel);
    const content = await fs.readFile(src, 'utf8');
    let current = null;
    try {
      current = await fs.readFile(dst, 'utf8');
    } catch {
      current = null;
    }
    if (current !== content) {
      stale++;
      if (!check) {
        await fs.mkdir(path.dirname(dst), { recursive: true });
        await fs.writeFile(dst, content);
      }
    }
  }
  const presets = await presetsJson();
  const presetsPath = path.join(ROOT, 'apify-actor/src/presets.json');
  let cur = null;
  try {
    cur = await fs.readFile(presetsPath, 'utf8');
  } catch {
    cur = null;
  }
  if (cur !== presets) {
    stale++;
    if (!check) await fs.writeFile(presetsPath, presets);
  }
  if (check && stale) {
    console.error(`${stale} actor files are out of date; run node scripts/sync-actor.mjs`);
    process.exit(1);
  }
  console.log(check ? 'actor in sync' : `synced (${stale} file(s) updated)`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
