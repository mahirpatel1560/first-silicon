import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { SHARED } from '../../scripts/sync-actor.mjs';
import { parseBoardSpec, normalizeInput, itemsFromPostings, PRESET_NAMES } from '../../apify-actor/src/core.js';
import * as greenhouse from '../../apify-actor/src/lib/fetchers/greenhouse.mjs';

test('actor lib is an exact copy of the site lib (same code)', () => {
  for (const rel of SHARED) {
    assert.equal(fs.readFileSync(path.join('apify-actor/src/lib', rel), 'utf8'), fs.readFileSync(path.join('src/lib', rel), 'utf8'), rel);
  }
});

test('actor config files are valid JSON with the expected title and schema fields', () => {
  const actor = JSON.parse(fs.readFileSync('apify-actor/.actor/actor.json', 'utf8'));
  assert.equal(actor.actorSpecification, 1);
  assert.equal(actor.title, 'ATS Internship & Job Feed — Greenhouse, Lever, Ashby');
  const input = JSON.parse(fs.readFileSync('apify-actor/.actor/input_schema.json', 'utf8'));
  for (const k of ['preset', 'companies', 'keywords', 'internshipOnly', 'disciplines', 'classYear', 'maxItems']) assert.ok(input.properties[k], k);
  assert.deepEqual(input.properties.preset.enum, PRESET_NAMES);
  const ds = JSON.parse(fs.readFileSync('apify-actor/.actor/dataset_schema.json', 'utf8'));
  assert.equal(ds.views.overview.display.component, 'table');
});

test('board specs accept tokens and public board URLs', () => {
  assert.deepEqual(parseBoardSpec('greenhouse:spacex'), { ats: 'greenhouse', token: 'spacex' });
  assert.deepEqual(parseBoardSpec('Lever: CesiumAstro'), { ats: 'lever', token: 'CesiumAstro' });
  assert.deepEqual(parseBoardSpec('https://boards.greenhouse.io/acme/jobs/123'), { ats: 'greenhouse', token: 'acme' });
  assert.deepEqual(parseBoardSpec('https://job-boards.greenhouse.io/acme'), { ats: 'greenhouse', token: 'acme' });
  assert.deepEqual(parseBoardSpec('https://boards.greenhouse.io/embed/job_board?for=acme'), { ats: 'greenhouse', token: 'acme' });
  assert.deepEqual(parseBoardSpec('https://boards-api.greenhouse.io/v1/boards/acme/jobs'), { ats: 'greenhouse', token: 'acme' });
  assert.deepEqual(parseBoardSpec('https://jobs.lever.co/acme/abc'), { ats: 'lever', token: 'acme' });
  assert.deepEqual(parseBoardSpec('https://jobs.ashbyhq.com/acme'), { ats: 'ashby', token: 'acme' });
  assert.equal(parseBoardSpec('workday:acme'), null);
  assert.equal(parseBoardSpec('https://example.com/careers'), null);
});

test('input normalization: presets, dedupe, bounds and defaults', () => {
  const o = normalizeInput({ preset: 'hardware', companies: ['greenhouse:spacex', 'greenhouse:spacex', 'bogus'], maxItems: 10 ** 9, classYear: 'weird', disciplines: ['rf', 'nope'] });
  assert.ok(o.boards.length >= 80);
  assert.equal(o.boards.filter((b) => b.ats === 'greenhouse' && b.token === 'spacex').length, 1, 'preset + manual duplicate merged');
  assert.equal(o.errors.length, 1);
  assert.equal(o.maxItems, 100000);
  assert.equal(o.classYear, 'any');
  assert.deepEqual(o.disciplines, ['rf']);
  assert.equal(o.internshipOnly, true);
  assert.equal(normalizeInput({}).boards.length, 0);
});

test('items: filters and room limit; no full descriptions', () => {
  const data = JSON.parse(fs.readFileSync('fixtures/api/greenhouse/vireosilicon.json', 'utf8'));
  const posts = greenhouse.parse(data, { name: 'Vireo', slug: 'vireo', token: 'vireosilicon', category: 'semiconductors' });
  const now = new Date('2026-09-23T12:00:00Z');
  const all = itemsFromPostings(posts, normalizeInput({ internshipOnly: false }), { now });
  assert.equal(all.length, posts.length);
  const hw = itemsFromPostings(posts, normalizeInput({ hardwareOnly: true }), { now });
  assert.ok(hw.every((i) => i.isInternship && i.isHardware));
  const fs2 = itemsFromPostings(posts, normalizeInput({ classYear: 'fs' }), { now });
  assert.ok(fs2.length > 0 && fs2.every((i) => i.classYear === 'fs'));
  const kw = itemsFromPostings(posts, normalizeInput({ internshipOnly: false, keywords: ['uvm'] }), { now });
  assert.ok(kw.length >= 1 && kw.every((i) => /Verification/.test(i.title)));
  assert.equal(itemsFromPostings(posts, normalizeInput({ internshipOnly: false }), { now, room: 2 }).length, 2);
  assert.ok(all.every((i) => !('description' in i) && (!i.snippet || i.snippet.length <= 300)));
  const noSnip = itemsFromPostings(posts, normalizeInput({ includeSnippet: false }), { now });
  assert.ok(noSnip.every((i) => i.snippet === null));
});
