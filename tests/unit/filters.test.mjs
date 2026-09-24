import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseState, serializeState, applyFilters, matches, facets, isActive, textMatch, isNewJob, DEFAULT_STATE } from '../../src/site/js/filters.mjs';
import { roleHtml } from '../../src/site/js/render.mjs';

const TODAY = '2026-09-23';
const J = (over) => ({
  id: 'x', company: 'Acme', company_slug: 'acme', title: 'Embedded Firmware Intern', url: 'https://example.test/x', locations: ['Pittsburgh, PA'],
  regions: ['us'], workplace: 'onsite', type: 'internship', terms: ['Summer 2027'], disciplines: ['embedded'], class_year: 'unspecified',
  flags: [], first_seen: '2026-09-22', posted: '2026-09-20', snippet: '', ...over,
});
const jobs = [
  J({ id: 'a' }),
  J({ id: 'b', title: 'RF Intern', disciplines: ['rf'], class_year: 'fs', flags: ['citizenship'], regions: ['us'], terms: ['Fall 2026'] }),
  J({ id: 'c', title: 'Photonics Co-op', disciplines: ['photonics'], class_year: 'jplus', type: 'co-op', terms: [], workplace: 'remote', first_seen: '2026-09-01' }),
  J({ id: 'd', title: 'Werkstudent Embedded', regions: ['eu'], locations: ['Munich, Germany'], flags: ['no_sponsorship'] }),
  J({ id: 'e', title: 'Power Intern', disciplines: ['power'], regions: ['ca'], locations: ['Toronto, ON'], class_year: 'fs' }),
];
const ids = (s) => applyFilters(jobs, { ...DEFAULT_STATE, ...s }, TODAY).map((j) => j.id);

test('URL state round-trips and rejects unknown values', () => {
  const s = parseState('?q=fpga&d=embedded&cy=fs&t=Summer%202027&loc=remote&cf=1&new=1');
  assert.deepEqual(s, { q: 'fpga', d: 'embedded', cy: 'fs', t: 'Summer 2027', loc: 'remote', cf: true, nw: true });
  assert.equal(serializeState(s), '?q=fpga&d=embedded&cy=fs&t=Summer+2027&loc=remote&cf=1&new=1');
  assert.deepEqual(parseState('?d=<script>&cy=senior&loc=mars'), { ...DEFAULT_STATE });
  assert.equal(serializeState(DEFAULT_STATE), '');
  assert.equal(isActive(DEFAULT_STATE), false);
  assert.equal(isActive({ ...DEFAULT_STATE, cf: true }), true);
});

test('each filter narrows the list correctly', () => {
  assert.deepEqual(ids({ d: 'embedded' }), ['a', 'd']);
  assert.deepEqual(ids({ cy: 'fs' }), ['b', 'e']);
  assert.deepEqual(ids({ cy: 'open' }), ['a', 'b', 'd', 'e']);
  assert.deepEqual(ids({ cy: 'jplus' }), ['c']);
  assert.deepEqual(ids({ t: 'Fall 2026' }), ['b']);
  assert.deepEqual(ids({ t: 'coop' }), ['c']);
  assert.deepEqual(ids({ t: 'none' }), ['c']);
  assert.deepEqual(ids({ loc: 'remote' }), ['c']);
  assert.deepEqual(ids({ loc: 'ca' }), ['e']);
  assert.deepEqual(ids({ loc: 'intl' }), ['d']);
  assert.deepEqual(ids({ cf: true }), ['a', 'c', 'd', 'e'], 'no_sponsorship is not a citizenship flag');
  assert.deepEqual(ids({ nw: true }), ['a', 'b', 'd', 'e']);
  assert.deepEqual(ids({ d: 'embedded', loc: 'us' }), ['a']);
});

test('text search matches all tokens across title, company, location and labels', () => {
  assert.deepEqual(ids({ q: 'munich' }), ['d']);
  assert.deepEqual(ids({ q: 'rf fall' }), ['b']);
  assert.deepEqual(ids({ q: 'co-op photonics' }), ['c']);
  assert.deepEqual(ids({ q: 'fr/so' }), ['b', 'e']);
  assert.equal(textMatch(jobs[0], ''), true);
  assert.equal(matches(jobs[0], { ...DEFAULT_STATE, q: 'zzz' }, TODAY), false);
});

test('facet counts and new-this-week', () => {
  const f = facets(jobs);
  assert.equal(f.disciplines.embedded, 2);
  assert.deepEqual(f.terms, [{ term: 'Fall 2026', count: 1 }, { term: 'Summer 2027', count: 3 }]);
  assert.equal(f.coop, 1);
  assert.equal(f.noterm, 1);
  assert.equal(isNewJob({ first_seen: '2026-09-17' }, TODAY), true);
  assert.equal(isNewJob({ first_seen: '2026-09-16' }, TODAY), false);
});

test('role renderer escapes content and links out with data-pulse', () => {
  const html = roleHtml(J({ title: '<b>x</b>', company: 'A&B', snippet: 'Open to <all>', flags: ['export'], class_year: 'fs' }), { today: TODAY });
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.match(html, /A&amp;B/);
  assert.match(html, /target="_blank" rel="noopener" data-pulse="role_out"/);
  assert.match(html, /Fr\/So friendly/);
  assert.match(html, /ITAR \/ export/);
  assert.match(html, /New this week/);
  assert.match(html, /Why these labels\?/);
  assert.doesNotMatch(roleHtml(J({ first_seen: '2026-08-01' }), { today: TODAY }), /New this week/);
});
