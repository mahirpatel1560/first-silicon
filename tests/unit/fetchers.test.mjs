import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as greenhouse from '../../src/lib/fetchers/greenhouse.mjs';
import * as lever from '../../src/lib/fetchers/lever.mjs';
import * as ashby from '../../src/lib/fetchers/ashby.mjs';
import { fetchBoard } from '../../src/lib/fetchers/index.mjs';
import { fetchJson, parseRetryAfter, backoffMs } from '../../src/lib/fetchers/http.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const fixture = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures/api', rel), 'utf8'));
const co = (token, name = 'Test Co') => ({ name, slug: 'test-co', category: 'semiconductors', token });

test('URL builders match the documented public endpoints', () => {
  assert.equal(greenhouse.listUrl('acme'), 'https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true');
  assert.equal(lever.listUrl('CesiumAstro'), 'https://api.lever.co/v0/postings/CesiumAstro?mode=json');
  assert.equal(ashby.listUrl('etched'), 'https://api.ashbyhq.com/posting-api/job-board/etched?includeCompensation=true');
  assert.equal(greenhouse.listUrl('a b'), 'https://boards-api.greenhouse.io/v1/boards/a%20b/jobs?content=true');
});

test('Greenhouse: parses content=true jobs, decodes escaped HTML, maps dates and offices', () => {
  const data = fixture('greenhouse/vireosilicon.json');
  const posts = greenhouse.parse(data, co('vireosilicon', 'Vireo Silicon'));
  assert.equal(posts.length, data.jobs.length);
  assert.equal(greenhouse.jobCount(data), data.jobs.length);
  const dv = posts[0];
  assert.equal(dv.id, `gh:vireosilicon:${data.jobs[0].id}`);
  assert.equal(dv.source, 'greenhouse');
  assert.equal(dv.url, data.jobs[0].absolute_url);
  assert.equal(dv.posted, '2026-09-21');
  assert.deepEqual(dv.locations, ['San Jose, CA']);
  assert.deepEqual(dv.regions, ['us']);
  assert.equal(dv.department, 'Engineering');
  assert.match(dv.description, /SystemVerilog testbenches/);
  assert.doesNotMatch(dv.description, /<|&lt;|&amp;/);
  const hybrid = posts.find((p) => p.title === 'FPGA Prototyping Intern');
  assert.equal(hybrid.workplace, 'hybrid');
  const remote = posts.find((p) => p.title.startsWith('Software Engineering Intern'));
  assert.equal(remote.workplace, 'remote');
});

test('Greenhouse: falls back to updated_at when first_published is missing; uses API company_name only when asked', () => {
  const data = fixture('greenhouse/halcyonorbital.json');
  const ee = greenhouse.parse(data, co('halcyonorbital')).find((p) => p.title === 'Electrical Engineering Intern');
  assert.equal(ee.posted, null);
  assert.equal(ee.updated, '2026-09-11');
  assert.equal(greenhouse.parse(data, co('halcyonorbital', 'Config Name'))[0].company, 'Config Name');
  assert.equal(greenhouse.parse(data, { ...co('halcyonorbital', 'x'), useApiName: true })[0].company, 'Halcyon Orbital');
});

test('Greenhouse: splits multi-location strings and skips malformed jobs', () => {
  const posts = greenhouse.parse(
    { jobs: [{ id: 1, title: 'RF Intern', absolute_url: 'https://x/1', location: { name: 'Boston, MA; Denver, CO' }, content: '' }, { id: 2, title: '' }, null] },
    co('x'),
  );
  assert.equal(posts.length, 1);
  assert.deepEqual(posts[0].locations, ['Boston, MA', 'Denver, CO']);
  assert.deepEqual(greenhouse.parse({}, co('x')), []);
});

test('Lever: parses postings, lists, commitment, workplaceType, createdAt and salary', () => {
  const data = fixture('lever/tamarackrobotics.json');
  const posts = lever.parse(data, co('tamarackrobotics'));
  assert.equal(posts.length, data.length);
  const hw = posts.find((p) => p.title === 'Robotics Hardware Intern');
  assert.equal(hw.employmentType, 'Intern');
  assert.equal(hw.posted, '2026-09-21');
  assert.equal(hw.url, data[0].hostedUrl);
  assert.match(hw.description, /First-year and second-year students are welcome/);
  assert.equal(hw.pay, '$28–34/hr');
  const fw = posts.find((p) => p.title === 'Embedded Firmware Intern');
  assert.equal(fw.workplace, 'hybrid');
  const test2 = posts.find((p) => p.title === 'Hardware Test Intern');
  assert.deepEqual(test2.locations, ['Pittsburgh, PA', 'Austin, TX']);
});

test('Lever: country hint gives the region when the location text is unknown', () => {
  const data = fixture('lever/BrightwaterAvionics.json');
  const posts = lever.parse(data, co('BrightwaterAvionics'));
  const de = posts.find((p) => /Werkstudent/.test(p.title));
  assert.deepEqual(de.regions, ['eu']);
  assert.match(de.url, /jobs\.lever\.co\/BrightwaterAvionics\//);
});

test('Ashby: parses jobs, skips unlisted, maps employmentType, remote, secondary locations and compensation', () => {
  const data = fixture('ashby/lumenfab.json');
  const posts = ashby.parse(data, co('lumenfab'));
  assert.equal(posts.length, data.jobs.length - 1, 'isListed:false is skipped');
  assert.equal(ashby.jobCount(data), data.jobs.length - 1);
  const pt = posts.find((p) => p.title === 'Photonics Test Intern');
  assert.equal(pt.employmentType, 'Intern');
  assert.equal(pt.posted, '2026-09-22');
  assert.equal(pt.pay, '$30 – $38 per hour');
  assert.equal(pt.id, `ab:lumenfab:${data.jobs[0].id}`);
  const q = ashby.parse(fixture('ashby/quillcircuits.json'), co('quillcircuits'));
  const remote = q.find((p) => p.title === 'Hardware Engineering Intern');
  assert.equal(remote.workplace, 'remote');
  assert.deepEqual(remote.regions, ['us']);
  const si = q.find((p) => p.title === 'Signal Integrity Intern');
  assert.deepEqual(si.locations, ['Boulder, CO', 'San Jose, CA']);
  assert.equal(si.workplace, 'hybrid');
});

test('Ashby: derives the id from jobUrl when id is missing', () => {
  const posts = ashby.parse({ jobs: [{ title: 'Intern', jobUrl: 'https://jobs.ashbyhq.com/x/12345678-1234-1234-1234-123456789abc', location: 'Remote' }] }, co('x'));
  assert.equal(posts[0].source_id, '12345678-1234-1234-1234-123456789abc');
});

test('fetchBoard in fixture mode: missing fixture is a 404 failure, empty board is ok with zero postings', async () => {
  const readFixture = async (ats, token) => {
    try {
      return fixture(`${ats}/${token}.json`);
    } catch {
      return null;
    }
  };
  const missing = await fetchBoard({ ...co('ghostboard'), ats: 'greenhouse' }, { mode: 'fixtures', readFixture });
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 404);
  const empty = await fetchBoard({ ...co('emptyco'), ats: 'ashby' }, { mode: 'fixtures', readFixture });
  assert.equal(empty.ok, true);
  assert.equal(empty.count, 0);
  const bad = await fetchBoard({ ...co('x'), ats: 'workday' }, { mode: 'fixtures', readFixture });
  assert.match(bad.error, /unknown_ats/);
});

// ---------------------------------------------------------------- HTTP behaviour
function mockFetch(responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const r = responses[Math.min(calls.length - 1, responses.length - 1)];
    if (r instanceof Error) throw r;
    return {
      status: r.status,
      ok: r.status >= 200 && r.status < 300,
      headers: { get: (k) => (r.headers || {})[k.toLowerCase()] || null },
      text: async () => r.body ?? '',
    };
  };
  return { impl, calls };
}

test('fetchJson sends the User-Agent and parses JSON', async () => {
  const { impl, calls } = mockFetch([{ status: 200, body: '{"jobs":[]}' }]);
  const r = await fetchJson('https://example.test/a', { fetchImpl: impl, userAgent: 'UA-TEST/1', sleep: async () => {} });
  assert.equal(r.ok, true);
  assert.deepEqual(r.data, { jobs: [] });
  assert.equal(calls[0].init.headers['User-Agent'], 'UA-TEST/1');
  assert.equal(calls[0].init.headers.Accept, 'application/json');
});

test('fetchJson does not retry 404s', async () => {
  const { impl, calls } = mockFetch([{ status: 404 }]);
  const r = await fetchJson('u', { fetchImpl: impl, sleep: async () => {} });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'not_found');
  assert.equal(calls.length, 1);
});

test('fetchJson honors Retry-After on 429 then succeeds', async () => {
  const waits = [];
  const { impl, calls } = mockFetch([{ status: 429, headers: { 'retry-after': '3' } }, { status: 200, body: '[]' }]);
  const r = await fetchJson('u', { fetchImpl: impl, sleep: async (ms) => waits.push(ms) });
  assert.equal(r.ok, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(waits, [3000]);
});

test('fetchJson backs off exponentially on 5xx and gives up after retries', async () => {
  const waits = [];
  const { impl, calls } = mockFetch([{ status: 503 }]);
  const r = await fetchJson('u', { fetchImpl: impl, retries: 3, baseDelayMs: 100, sleep: async (ms) => waits.push(ms) });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'http_503');
  assert.equal(calls.length, 4);
  assert.deepEqual(waits, [100, 200, 400]);
});

test('fetchJson retries network errors, reports timeouts and bad JSON', async () => {
  const net = mockFetch([new TypeError('fetch failed'), { status: 200, body: '{"ok":1}' }]);
  assert.equal((await fetchJson('u', { fetchImpl: net.impl, sleep: async () => {} })).ok, true);
  const abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' });
  const to = mockFetch([abortErr]);
  const r = await fetchJson('u', { fetchImpl: to.impl, retries: 1, sleep: async () => {} });
  assert.equal(r.error, 'timeout');
  const bad = mockFetch([{ status: 200, body: '<html>' }]);
  assert.equal((await fetchJson('u', { fetchImpl: bad.impl, sleep: async () => {} })).error, 'bad_json');
});

test('fetchJson aborts slow requests using the timeout', async () => {
  const slow = (url, init) =>
    new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    });
  const r = await fetchJson('u', { fetchImpl: slow, timeoutMs: 20, retries: 0, sleep: async () => {} });
  assert.equal(r.ok, false);
  assert.equal(r.error, 'timeout');
});

test('parseRetryAfter and backoffMs', () => {
  assert.equal(parseRetryAfter('2'), 2000);
  assert.equal(parseRetryAfter('120'), 60000, 'capped');
  assert.equal(parseRetryAfter(''), null);
  assert.equal(parseRetryAfter('nonsense'), null);
  const now = Date.parse('2026-09-23T12:00:00Z');
  assert.equal(parseRetryAfter('Wed, 23 Sep 2026 12:00:05 GMT', now), 5000);
  assert.equal(backoffMs(1, 1000), 1000);
  assert.equal(backoffMs(3, 1000), 4000);
  assert.equal(backoffMs(10, 1000), 30000);
});
