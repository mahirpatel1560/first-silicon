import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {
  normalizeTitle, roleId, selectRoles, dedupeRoles, mergeWithPrevious, sortJobs, computeCounts, publicJob, isNew, isCitizenshipFree, STALE_CARRY_DAYS,
} from '../../src/lib/pipeline.mjs';
import { run, boardsToFetch, parseArgs } from '../../scripts/fetch.mjs';

const NOW = new Date('2026-09-23T12:00:00Z');
const TODAY = '2026-09-23';

const posting = (over = {}) => ({
  source: 'greenhouse', token: 'acme', source_id: '1', id: 'gh:acme:1', company: 'Acme', company_slug: 'acme', category: 'semiconductors',
  title: 'FPGA Intern (Summer 2027)', url: 'https://example.test/1', locations: ['San Jose, CA'], regions: ['us'], workplace: 'onsite',
  employmentType: '', department: '', posted: '2026-09-20', updated: '2026-09-21', description: 'Verilog and Vivado. Open to all class years.', pay: '', ...over,
});

test('normalizeTitle and roleId are stable and punctuation-insensitive', () => {
  assert.equal(normalizeTitle('FPGA Intern — (Summer 2027)!'), 'fpga intern summer 2027');
  assert.equal(normalizeTitle('R&D Intern'), 'r and d intern');
  assert.equal(roleId('acme', 'FPGA Intern (Summer 2027)'), roleId('acme', 'fpga intern summer 2027'));
  assert.notEqual(roleId('acme', 'FPGA Intern'), roleId('other', 'FPGA Intern'));
});

test('selectRoles keeps hardware internships only and counts every stage', () => {
  const { roles, stats } = selectRoles(
    [posting(), posting({ id: 'gh:acme:2', source_id: '2', title: 'Marketing Intern', description: 'campaigns' }), posting({ id: 'gh:acme:3', source_id: '3', title: 'Senior FPGA Engineer' })],
    { now: NOW },
  );
  assert.deepEqual(stats, { postings_seen: 3, internships_seen: 2, hardware_internships: 1 });
  assert.equal(roles.length, 1);
  assert.equal(roles[0].class_year, 'fs');
  assert.deepEqual(roles[0].disciplines, ['digital']);
  assert.equal('description' in roles[0], false, 'descriptions are not carried into roles');
});

test('dedupeRoles merges the same title across locations and boards', () => {
  const a = posting({ id: 'gh:acme:1', locations: ['San Jose, CA'], posted: '2026-09-21', url: 'https://example.test/sj' });
  const b = posting({ id: 'gh:acme:9', source_id: '9', locations: ['Austin, TX'], posted: '2026-09-19', url: 'https://example.test/atx', description: 'Verilog. Must be a U.S. citizen.' });
  const c = posting({ source: 'lever', token: 'acme', id: 'lv:acme:x', source_id: 'x', locations: ['Remote - US'], workplace: 'remote', posted: '2026-09-22', url: 'https://example.test/lv' });
  const { roles } = selectRoles([a, b, c], { now: NOW });
  const merged = dedupeRoles(roles);
  assert.equal(merged.length, 1);
  const m = merged[0];
  assert.equal(m.also, 2);
  assert.equal(m.url, 'https://example.test/atx', 'primary = earliest posted');
  assert.deepEqual(new Set(m.locations), new Set(['San Jose, CA', 'Austin, TX', 'Remote - US']));
  assert.equal(m.workplace, 'remote');
  assert.equal(m.posted, '2026-09-19');
  assert.deepEqual(m.flags, ['citizenship']);
  assert.equal(m.class_year, 'fs');
  assert.equal(m.source_ids.length, 3);
});

test('mergeWithPrevious keeps first_seen, removes closed roles and logs them', () => {
  const cur = dedupeRoles(selectRoles([posting()], { now: NOW }).roles);
  const prev = [
    { ...publicJob({ ...cur[0], first_seen: '2026-09-01', last_seen: '2026-09-22' }) },
    { id: 'rclosed', company: 'Acme', company_slug: 'acme', title: 'Old Intern', first_seen: '2026-08-01', last_seen: '2026-09-22' },
  ];
  const r = mergeWithPrevious(cur, prev, { today: TODAY, failedCompanies: new Set() });
  assert.equal(r.jobs.length, 1);
  assert.equal(r.jobs[0].first_seen, '2026-09-01');
  assert.equal(r.jobs[0].last_seen, TODAY);
  assert.equal(r.added, 0);
  assert.equal(r.closed.length, 1);
  assert.equal(r.closed[0].closed_on, TODAY);
  assert.equal(r.closedLog.length, 1);
});

test('mergeWithPrevious carries roles from a failed board for up to 7 days', () => {
  const recent = { id: 'r1', company: 'Down', company_slug: 'down', title: 'Hardware Intern', first_seen: '2026-09-01', last_seen: '2026-09-20' };
  const old = { id: 'r2', company: 'Down', company_slug: 'down', title: 'RF Intern', first_seen: '2026-08-01', last_seen: '2026-09-10' };
  const r = mergeWithPrevious([], [recent, old], { today: TODAY, failedCompanies: new Set(['down']) });
  assert.deepEqual(r.jobs.map((j) => j.id), ['r1']);
  assert.equal(r.jobs[0].stale, true);
  assert.equal(r.carried, 1);
  assert.deepEqual(r.closed.map((c) => c.id), ['r2']);
  assert.equal(STALE_CARRY_DAYS, 7);
});

test('closed log keeps 60 days', () => {
  const r = mergeWithPrevious([], [], { today: TODAY, previousClosed: [{ id: 'a', closed_on: '2026-09-01' }, { id: 'b', closed_on: '2026-06-01' }] });
  assert.deepEqual(r.closedLog.map((c) => c.id), ['a']);
});

test('sortJobs orders newest first with deterministic ties; counts and helpers', () => {
  const jobs = sortJobs([
    { id: 'b', company: 'B', title: 'x', posted: '2026-09-20', first_seen: '2026-09-21', disciplines: ['pcb'], flags: [], class_year: 'fs', type: 'internship', terms: ['Summer 2027'], workplace: 'remote', company_slug: 'b' },
    { id: 'a', company: 'A', title: 'x', posted: null, first_seen: '2026-09-22', disciplines: ['rf'], flags: ['export'], class_year: 'jplus', type: 'co-op', terms: [], workplace: 'onsite', company_slug: 'a' },
    { id: 'c', company: 'C', title: 'x', posted: '2026-09-20', first_seen: '2026-09-21', disciplines: ['pcb'], flags: [], class_year: 'unspecified', type: 'internship', terms: ['Summer 2027'], workplace: 'onsite', company_slug: 'c' },
  ]);
  assert.deepEqual(jobs.map((j) => j.id), ['a', 'b', 'c']);
  const c = computeCounts(jobs, TODAY);
  assert.equal(c.roles, 3);
  assert.equal(c.coops, 1);
  assert.equal(c.fs, 1);
  assert.equal(c.citizenship_free, 2);
  assert.equal(c.new_this_week, 3);
  assert.equal(c.remote, 1);
  assert.deepEqual(c.by_discipline, { pcb: 2, rf: 1 });
  assert.equal(isNew({ first_seen: '2026-09-16' }, TODAY), false);
  assert.equal(isNew({ first_seen: '2026-09-17' }, TODAY), true);
  assert.equal(isCitizenshipFree({ flags: ['no_sponsorship'] }), true);
});

test('fetch run (fixtures): writes jobs/meta/closed/README with previous-run semantics', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-run-'));
  const r = await run({ ...parseArgs([]), fixtures: 'fixtures/api', companies: 'fixtures/companies.fixture.json', out, readme: path.join(out, 'README.md'), now: '2026-09-23T12:00:00Z', delay: 0 }, { log: () => {} });
  assert.equal(r.aborted, false);
  const jobs = JSON.parse(await fs.readFile(path.join(out, 'jobs.json'), 'utf8'));
  const meta = JSON.parse(await fs.readFile(path.join(out, 'meta.json'), 'utf8'));
  assert.equal(jobs.count, jobs.jobs.length);
  assert.ok(jobs.jobs.length >= 30);
  assert.equal(meta.source, 'fixtures');
  assert.equal(meta.boards.failed, 1);
  assert.equal(meta.boards.empty, 1);
  assert.ok(meta.postings_seen > meta.internships_seen && meta.internships_seen >= meta.counts.roles);
  for (const j of jobs.jobs) {
    assert.ok(j.snippet.length <= 300);
    assert.equal('description' in j, false);
    assert.match(j.url, /^https:\/\//);
  }
  const readme = await fs.readFile(path.join(out, 'README.md'), 'utf8');
  assert.match(readme, /\| Company \| Role \| Location \| Discipline \| Class year \| Flags \| Posted \|/);
  // second run a day later: first_seen persists; a removed role is closed
  const kept = jobs.jobs[0];
  const r2 = await run({ ...parseArgs([]), fixtures: 'fixtures/api', companies: 'fixtures/companies.fixture.json', out, noReadme: true, now: '2026-09-24T12:00:00Z', delay: 0 }, { log: () => {} });
  const again = r2.jobs.find((j) => j.id === kept.id);
  assert.equal(again.first_seen, kept.first_seen);
  assert.equal(r2.meta.closed_since_last_run, 0);
  await fs.rm(out, { recursive: true, force: true });
});

test('fetch run aborts without overwriting data when most boards fail', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-abort-'));
  const cfg = path.join(out, 'companies.json');
  await fs.writeFile(cfg, JSON.stringify({ companies: [
    { name: 'A', slug: 'a', ats: 'greenhouse', token: 'nope1', status: 'ok' },
    { name: 'B', slug: 'b', ats: 'greenhouse', token: 'nope2', status: 'ok' },
    { name: 'C', slug: 'c', ats: 'greenhouse', token: 'vireosilicon', status: 'ok' },
  ] }));
  await fs.writeFile(path.join(out, 'jobs.json'), '{"sentinel":true,"jobs":[]}');
  const r = await run({ ...parseArgs([]), fixtures: 'fixtures/api', companies: cfg, out, noReadme: true, delay: 0 }, { log: () => {} });
  assert.equal(r.aborted, true);
  assert.equal(JSON.parse(await fs.readFile(path.join(out, 'jobs.json'), 'utf8')).sentinel, true);
  await fs.rm(out, { recursive: true, force: true });
});

test('fetch run (live mode, mocked network): one request per board with the bot User-Agent', async () => {
  const out = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-live-'));
  const cfg = path.join(out, 'companies.json');
  await fs.writeFile(cfg, JSON.stringify({ companies: [
    { name: 'Vireo', slug: 'vireo', ats: 'greenhouse', token: 'vireosilicon', status: 'ok' },
    { name: 'Lumen', slug: 'lumen', ats: 'ashby', token: 'lumenfab', status: 'ok' },
    { name: 'Skip', slug: 'skip', ats: null, token: null, status: 'not_found' },
  ] }));
  const bodies = {
    'boards-api.greenhouse.io': await fs.readFile('fixtures/api/greenhouse/vireosilicon.json', 'utf8'),
    'api.ashbyhq.com': await fs.readFile('fixtures/api/ashby/lumenfab.json', 'utf8'),
  };
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, ua: init.headers['User-Agent'] });
    return { status: 200, ok: true, headers: { get: () => null }, text: async () => bodies[new URL(url).hostname] };
  };
  const r = await run({ ...parseArgs([]), companies: cfg, out, noReadme: true, delay: 0, now: '2026-09-23T12:00:00Z' }, { log: () => {}, fetchImpl });
  assert.equal(r.aborted, false);
  assert.equal(calls.length, 2);
  assert.match(calls[0].url, /content=true/);
  assert.match(calls[1].url, /includeCompensation=true/);
  assert.ok(calls.every((c) => /^FirstSiliconBot\//.test(c.ua)));
  assert.equal(r.meta.source, 'live');
  await fs.rm(out, { recursive: true, force: true });
});

test('boardsToFetch only uses verified or unprobed boards', () => {
  const list = boardsToFetch([
    { slug: 'a', ats: 'greenhouse', token: 'a', status: 'ok' },
    { slug: 'b', ats: 'lever', token: 'b', status: 'empty' },
    { slug: 'c', ats: 'ashby', token: 'c', status: 'unprobed' },
    { slug: 'd', ats: null, token: null, status: 'not_found' },
    { slug: 'e', ats: 'greenhouse', token: 'e', status: 'unsupported_ats' },
  ]);
  assert.deepEqual(list.map((x) => x.slug), ['a', 'b', 'c']);
});
