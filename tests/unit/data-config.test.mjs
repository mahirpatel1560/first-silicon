import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateProgram, upcomingDeadlines, sortPrograms, nextDeadline } from '../../src/lib/programs.mjs';
import { needsProbe, candidatesFor, summarize } from '../../scripts/probe.mjs';
import { parseHeadersFile, headersFor } from '../../scripts/serve.mjs';
import { headersFile } from '../../build.mjs';
import * as site from '../../config/site.mjs';

const companies = JSON.parse(fs.readFileSync('config/companies.json', 'utf8'));
const programs = JSON.parse(fs.readFileSync('data/programs.json', 'utf8'));

test('companies.json: >= 120 employers, >= 80 working boards, consistent fields', () => {
  const list = companies.companies;
  assert.ok(list.length >= 120, `${list.length} companies`);
  const ok = list.filter((c) => c.status === 'ok');
  assert.ok(ok.length >= 80, `${ok.length} working boards`);
  const slugs = new Set();
  for (const c of list) {
    assert.ok(!slugs.has(c.slug), `duplicate slug ${c.slug}`);
    slugs.add(c.slug);
    assert.ok(['ok', 'empty', 'not_found', 'unsupported_ats', 'unprobed'].includes(c.status), c.slug);
    assert.ok(c.name && c.category, c.slug);
    assert.ok(c.probe && /^\d{4}-\d{2}-\d{2}$/.test(c.probe.probed_on), `${c.slug} probe date`);
    if (c.status === 'ok' || c.status === 'empty') {
      assert.ok(['greenhouse', 'lever', 'ashby'].includes(c.ats), c.slug);
      assert.match(c.token, /^[A-Za-z0-9._-]+$/, c.slug);
    } else {
      assert.ok(Array.isArray(c.candidates), `${c.slug} keeps candidates for re-probing`);
    }
  }
  assert.deepEqual(summarize(list), companies.summary);
});

test('programs.json: only verified entries with official https URLs', () => {
  assert.ok(programs.programs.length >= 5);
  for (const p of programs.programs) {
    assert.deepEqual(validateProgram(p), [], p.id);
    assert.equal(p.verified_on, '2026-09-23', p.id);
  }
  const up = upcomingDeadlines(programs.programs, '2026-09-23');
  assert.ok(up.length >= 3);
  assert.ok(up.every((u, i) => i === 0 || up[i - 1].days <= u.days), 'sorted soonest first');
  assert.ok(!up.some((u) => u.deadline.date === '2026-09-14'), 'past deadlines excluded');
  const sorted = sortPrograms(programs.programs, '2026-09-23');
  assert.ok(nextDeadline(sorted[0], '2026-09-23'));
  assert.equal(nextDeadline(sorted[sorted.length - 1], '2026-09-23'), null, 'undated programs last');
  assert.ok(validateProgram({ id: 'x' }).length > 0);
});

test('probe helpers', () => {
  const today = '2026-09-30';
  assert.equal(needsProbe({ status: 'ok', probe: { probed_on: '2026-09-23' } }, today), true);
  assert.equal(needsProbe({ status: 'ok', probe: { probed_on: '2026-09-29' } }, today), false);
  assert.equal(needsProbe({ status: 'unsupported_ats', probe: { probed_on: '2026-01-01' } }, today), false);
  assert.equal(needsProbe({ status: 'unsupported_ats', probe: { probed_on: '2026-01-01' } }, today, { all: true }), true);
  assert.equal(needsProbe({ status: 'unprobed' }, today), true);
  assert.deepEqual(candidatesFor({ ats: 'greenhouse', token: 'a', candidates: [{ ats: 'greenhouse', token: 'a' }, { ats: 'lever', token: 'a' }] }), [
    { ats: 'greenhouse', token: 'a' },
    { ats: 'lever', token: 'a' },
  ]);
});

test('_headers: CSP allows Pulse, cache rules detach correctly (emulated like Cloudflare Pages)', () => {
  const text = headersFile();
  assert.match(text, new RegExp(`script-src 'self' ${site.PULSE_ORIGIN.replace(/\./g, '\\.')}`));
  assert.match(text, new RegExp(`connect-src 'self' ${site.PULSE_ORIGIN.replace(/\./g, '\\.')}`));
  assert.match(text, /X-Content-Type-Options: nosniff/);
  assert.match(text, /Referrer-Policy: strict-origin-when-cross-origin/);
  assert.match(text, /Permissions-Policy: /);
  const rules = parseHeadersFile(text);
  assert.equal(headersFor(rules, '/')['cache-control'], 'no-cache');
  assert.equal(headersFor(rules, '/assets/app.123.js')['cache-control'], 'public, max-age=31536000, immutable');
  assert.equal(headersFor(rules, '/data/jobs.json')['cache-control'], 'public, max-age=300, must-revalidate');
  assert.ok(headersFor(rules, '/programs/')['content-security-policy']);
});
