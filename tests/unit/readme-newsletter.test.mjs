import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as site from '../../config/site.mjs';
import { buildReadme, readmeRow } from '../../src/lib/readme.mjs';
import { buildDigest, rolesForWeek, groupByDiscipline } from '../../src/lib/newsletter.mjs';

const TODAY = '2026-09-23';
const programs = JSON.parse(fs.readFileSync('data/programs.json', 'utf8')).programs;
const job = (over = {}) => ({
  id: 'r1', company: 'Acme | Labs', company_slug: 'acme', title: 'FPGA Intern [Summer 2027]', url: 'https://example.test/1', ats: 'greenhouse',
  locations: ['San Jose, CA'], regions: ['us'], workplace: 'onsite', type: 'internship', terms: ['Summer 2027'], year_hint: null,
  disciplines: ['digital'], class_year: 'fs', flags: ['export'], hw_score: 80, posted: '2026-09-20', updated: null,
  first_seen: '2026-09-21', last_seen: TODAY, snippet: 'Open to all class years.', pay: '', also: 0, ...over,
});

test('README row escapes Markdown and labels columns', () => {
  const row = readmeRow(job(), TODAY);
  assert.equal(row, '| Acme \\| Labs | [FPGA Intern \\[Summer 2027\\]](https://example.test/1) | San Jose, CA | FPGA/RTL/ASIC | Fr/So | ITAR / export | Sep 20 · new |');
  assert.match(readmeRow(job({ posted: null, first_seen: '2026-09-01', workplace: 'remote', locations: ['Boston, MA'] }), TODAY), /Boston, MA · Remote .* Sep 1 \(seen\) \|$/);
  assert.match(readmeRow(job({ type: 'co-op', title: 'Power Hardware' }), TODAY), /\(co-op\)/);
});

test('README lists open roles newest first in the order given and omits closed roles', () => {
  const jobs = [job({ id: 'a', title: 'Newest', posted: '2026-09-22' }), job({ id: 'b', title: 'Older', posted: '2026-09-10' })];
  const md = buildReadme({ jobs, meta: { last_run: '2026-09-23T11:20:00Z', counts: { roles: 2, companies: 1, fs: 2, new_this_week: 2 }, boards: { ok: 87 } }, programs, site, today: TODAY });
  assert.ok(md.indexOf('Newest') < md.indexOf('Older'));
  assert.doesNotMatch(md, /Closed Role/);
  assert.match(md, /## Open roles \(2, newest first\)/);
  assert.match(md, /\*\*Updated September 23, 2026\*\* · 2 open roles/);
  assert.match(md, /2029-2030 graduation date/);
  assert.match(md, /Science Undergraduate Laboratory Internships/);
  assert.match(md, /Built by Mahir Patel, an electrical-engineering student at the University of Illinois Urbana-Champaign\./);
});

test('README pending state before the first run', () => {
  const md = buildReadme({ jobs: [], meta: { last_run: null }, programs, site, today: TODAY });
  assert.match(md, /first automatic data run has not happened yet/);
  assert.match(md, /No roles yet/);
});

test('newsletter uses only roles first seen in the last 7 days, grouped by discipline, Fr/So first', () => {
  const jobs = [
    job({ id: 'a', title: 'Old role', first_seen: '2026-09-10' }),
    job({ id: 'b', title: 'Juniors RTL', class_year: 'jplus', first_seen: '2026-09-22' }),
    job({ id: 'c', title: 'Friendly FPGA', class_year: 'fs', first_seen: '2026-09-20' }),
    job({ id: 'd', title: 'Board bring-up', disciplines: ['pcb', 'test'], first_seen: '2026-09-23' }),
    job({ id: 'e', title: 'General EE', disciplines: ['general'], first_seen: '2026-09-18' }),
  ];
  assert.deepEqual(rolesForWeek(jobs, TODAY).map((j) => j.id).sort(), ['b', 'c', 'd', 'e']);
  const groups = groupByDiscipline(rolesForWeek(jobs, TODAY));
  assert.deepEqual(groups.map((g) => g.slug), ['digital', 'pcb', 'general']);
  assert.deepEqual(groups[0].jobs.map((j) => j.id), ['c', 'b']);
  const d = buildDigest({ jobs, programs, today: TODAY, siteUrl: site.BASE_URL });
  assert.equal(d.stats.new_roles, 4);
  assert.match(d.subject, /^4 new hardware internships this week \(3 Fr\/So friendly\)$/);
  assert.doesNotMatch(d.text, /Old role/);
  assert.match(d.text, /Friendly FPGA/);
  assert.match(d.text, /September 30, 2026 \(7 days\): Community College Internships/);
  assert.match(d.html, /\{\{UNSUBSCRIBE_URL\}\}/);
  assert.match(d.text, /Unsubscribe: \{\{UNSUBSCRIBE_URL\}\}/);
  assert.match(d.text, /\{\{MAILING_ADDRESS\}\}/);
  assert.match(d.html, /utm_source=newsletter/);
  assert.doesNotMatch(d.html, /example\.test\/1\?utm/, 'employer links are not tagged');
  assert.doesNotMatch(d.html, /<script/i);
});

test('newsletter escapes HTML and handles an empty week', () => {
  const d = buildDigest({ jobs: [job({ title: '<img src=x onerror=alert(1)>', first_seen: TODAY })], programs: [], today: TODAY, siteUrl: site.BASE_URL });
  assert.doesNotMatch(d.html, /<img src=x/);
  const empty = buildDigest({ jobs: [], programs: [], today: TODAY, siteUrl: site.BASE_URL });
  assert.match(empty.text, /No new hardware internships/);
  assert.match(empty.subject, /First Silicon weekly/);
});

test('featured (sponsored) slot is labeled when present and absent by default', () => {
  const none = buildDigest({ jobs: [], programs: [], today: TODAY, siteUrl: site.BASE_URL });
  assert.doesNotMatch(none.html, /sponsored/i);
  const f = buildDigest({ jobs: [], programs: [], today: TODAY, siteUrl: site.BASE_URL, featured: { company: 'Co', title: 'Intern', url: 'https://example.test/f' } });
  assert.match(f.html, /Featured role \(sponsored\)/);
  assert.match(f.text, /FEATURED ROLE \(sponsored\)/);
});
