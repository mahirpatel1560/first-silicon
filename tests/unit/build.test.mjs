import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { build } from '../../build.mjs';
import { makeDemoData } from '../../scripts/make-demo-data.mjs';
import * as site from '../../config/site.mjs';
import { computeCounts } from '../../src/lib/pipeline.mjs';
import { heroSubhead, classYearGuidance } from '../../src/lib/copy.mjs';

let tmp;
let demoOut;
let prodOut;
let emptyOut;
let smallOut;

const decode = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const pick = (html, re) => {
  const m = html.match(re);
  return m ? decode(m[1]) : null;
};
const OLD_PROMISE = /apply to as a freshman or sophomore|internships? for freshm[ae]n|freshmen and sophomores can apply to|built for EE underclassmen/i;

// Five roles with known labels: 1 Fr/So, 1 Juniors+, 3 not stated, at 2 companies.
const smallJob = (i, over) => ({
  id: `r-small-${i}`, company: i < 3 ? 'Alpha Circuits' : 'Beta Radio', company_slug: i < 3 ? 'alpha' : 'beta', title: `Hardware Intern ${i}`,
  url: `https://example.invalid/${i}`, ats: 'greenhouse', locations: ['Austin, TX'], regions: ['us'], workplace: 'onsite', type: 'internship',
  terms: ['Summer 2027'], year_hint: null, disciplines: ['pcb'], class_year: 'unspecified', flags: [], hw_score: 80, posted: '2026-09-20',
  updated: null, first_seen: '2026-09-21', last_seen: '2026-09-24', snippet: '', pay: '', also: 0, ...over,
});
const SMALL_JOBS = [smallJob(0, { class_year: 'fs' }), smallJob(1, { class_year: 'jplus' }), smallJob(2), smallJob(3), smallJob(4)];

async function walk(dir) {
  const out = [];
  for (const e of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out.sort();
}
async function digest(dir) {
  const h = crypto.createHash('sha256');
  for (const f of await walk(dir)) {
    h.update(path.relative(dir, f));
    h.update(await fs.readFile(f));
  }
  return h.digest('hex');
}
const htmlFiles = async (dir) => (await walk(dir)).filter((f) => f.endsWith('.html'));
const ld = (html) => [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

before(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'fs-build-'));
  await makeDemoData({ out: path.relative(process.cwd(), path.join(tmp, 'demo-data')) });
  demoOut = path.join(tmp, 'demo-dist');
  prodOut = path.join(tmp, 'prod-dist');
  await build({ dataDir: path.join(tmp, 'demo-data'), outDir: demoOut, demo: true });
  await build({ dataDir: 'data', outDir: prodOut });
  // Before the first daily run: no jobs.json or meta.json at all.
  emptyOut = path.join(tmp, 'empty-dist');
  await fs.mkdir(path.join(tmp, 'empty-data'), { recursive: true });
  await build({ dataDir: path.join(tmp, 'empty-data'), outDir: emptyOut });
  // A tiny data set whose numbers are known in advance.
  smallOut = path.join(tmp, 'small-dist');
  const smallData = path.join(tmp, 'small-data');
  await fs.mkdir(smallData, { recursive: true });
  await fs.writeFile(path.join(smallData, 'jobs.json'), JSON.stringify({ schema: 1, generated_at: '2026-09-24T11:17:00.000Z', count: SMALL_JOBS.length, jobs: SMALL_JOBS }));
  await fs.writeFile(path.join(smallData, 'meta.json'), JSON.stringify({ schema: 1, last_run: '2026-09-24T11:17:00.000Z', boards: { ok: 2, attempted: 2 }, postings_seen: 40 }));
  await build({ dataDir: smallData, outDir: smallOut });
});

test('demo build: pages, discipline pages only where >= 5 roles, assets hashed', async () => {
  const files = (await walk(demoOut)).map((f) => path.relative(demoOut, f));
  for (const f of ['index.html', 'programs/index.html', 'disciplines/index.html', 'how-it-works/index.html', 'newsletter/index.html', 'about/index.html', 'privacy/index.html', 'terms/index.html', 'contact/index.html', 'sponsor/index.html', '404.html', 'sitemap.xml', 'robots.txt', 'llms.txt', '_headers', 'data/jobs.json', 'data/meta.json', 'data/programs.json', 'og.png', 'favicon.svg', 'favicon-32.png']) {
    assert.ok(files.includes(f), `missing ${f}`);
  }
  const jobs = JSON.parse(await fs.readFile(path.join(demoOut, 'data/jobs.json'), 'utf8')).jobs;
  const counts = {};
  for (const j of jobs) for (const d of j.disciplines) counts[d] = (counts[d] || 0) + 1;
  const discPages = files.filter((f) => /^disciplines\/[^/]+\/index\.html$/.test(f)).map((f) => f.split('/')[1]);
  assert.ok(discPages.length >= 3);
  for (const d of discPages) assert.ok(counts[d] >= site.MIN_ROLES_FOR_DISCIPLINE_PAGE, `${d} has ${counts[d]}`);
  for (const [d, n] of Object.entries(counts)) if (d !== 'general' && n >= 5) assert.ok(discPages.includes(d), `page for ${d}`);
  assert.ok(files.some((f) => /^assets\/app\.[0-9a-f]{10}\.js$/.test(f)));
  assert.ok(files.some((f) => /^assets\/site\.[0-9a-f]{10}\.css$/.test(f)));
});

test('every page: unique title <= 60, description <= 155, canonical, OG/Twitter, Pulse script, parseable JSON-LD, no JobPosting', async () => {
  for (const dir of [demoOut, prodOut, emptyOut, smallOut]) {
    const titles = new Set();
    for (const f of await htmlFiles(dir)) {
      const html = await fs.readFile(f, 'utf8');
      const rel = path.relative(dir, f);
      const title = html.match(/<title>([^<]*)<\/title>/)[1];
      const desc = html.match(/<meta name="description" content="([^"]*)">/)[1];
      assert.ok(title.length <= 60, `${rel} title ${title.length}`);
      assert.ok(desc.length <= 155, `${rel} description ${desc.length}`);
      assert.ok(!titles.has(title), `duplicate title ${title}`);
      titles.add(title);
      const pagePath = rel === 'index.html' ? '/' : rel === '404.html' ? '/404.html' : `/${rel.replace(/index\.html$/, '')}`;
      assert.match(html, new RegExp(`<link rel="canonical" href="${site.BASE_URL}${pagePath.replace(/\./g, '\\.')}">`), rel);
      assert.match(html, /<meta property="og:image" content="https:\/\/firstsilicon\.pages\.dev\/og\.png">/);
      assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
      assert.match(html, /<script defer src="https:\/\/pulse\.ringlatch\.workers\.dev\/pulse\.js" data-site="fs"><\/script>\n<\/head>/, `${rel} pulse tag before </head>`);
      assert.doesNotMatch(html, /JobPosting/);
      assert.doesNotMatch(html, /style="/, `${rel} has inline style (CSP style-src 'self')`);
      assert.doesNotMatch(html, /<script>(?!<)/, `${rel} has an inline executable script`);
      const blocks = ld(html);
      assert.ok(blocks.some((b) => b['@type'] === 'Organization'), rel);
      if (rel !== 'index.html' && rel !== '404.html') assert.ok(blocks.some((b) => b['@type'] === 'BreadcrumbList'), `${rel} breadcrumbs`);
    }
  }
});

test('home JSON-LD: WebSite, WebApplication (free offer), ItemList of link-out roles, FAQPage', async () => {
  const html = await fs.readFile(path.join(demoOut, 'index.html'), 'utf8');
  const types = ld(html).map((b) => b['@type']);
  for (const t of ['Organization', 'WebSite', 'WebApplication', 'ItemList', 'FAQPage']) assert.ok(types.includes(t), t);
  const list = ld(html).find((b) => b['@type'] === 'ItemList');
  assert.ok(list.itemListElement.length > 0 && list.itemListElement.length <= site.ITEMLIST_MAX);
  assert.ok(list.itemListElement.every((i) => /^https:\/\//.test(i.url) && !i.url.startsWith(site.BASE_URL)), 'links out to employer postings');
  const app = ld(html).find((b) => b['@type'] === 'WebApplication');
  assert.equal(app.offers.price, '0');
  const faq = ld(html).find((b) => b['@type'] === 'FAQPage');
  assert.ok(faq.mainEntity.length >= 5);
  for (const q of faq.mainEntity) assert.ok(html.includes(q.name.replace(/"/g, '&quot;')), 'FAQ is visible on the page');
});

test('demo build is noindex and says the data is fictional; production is indexable', async () => {
  const demo = await fs.readFile(path.join(demoOut, 'index.html'), 'utf8');
  assert.match(demo, /<meta name="robots" content="noindex">/);
  assert.match(demo, /fictional test data/);
  assert.equal(await fs.readFile(path.join(demoOut, 'robots.txt'), 'utf8'), 'User-agent: *\nDisallow: /\n');
  const prod = await fs.readFile(path.join(prodOut, 'index.html'), 'utf8');
  assert.doesNotMatch(prod, /noindex/);
  assert.doesNotMatch(prod, /fictional/);
  assert.match(await fs.readFile(path.join(prodOut, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/firstsilicon\.pages\.dev\/sitemap\.xml/);
});

test('build with no data yet: honest empty state, no discipline pages, no guidance numbers, sitemap and llms.txt', async () => {
  const html = await fs.readFile(path.join(emptyOut, 'index.html'), 'utf8');
  assert.match(html, /first automatic update has not run/);
  assert.doesNotMatch(html, /class="role"/);
  assert.equal(pick(html, /<h1 id="hero-h">([^<]*)<\/h1>/), 'Every hardware internship, labeled.');
  assert.match(html, /<p id="cy-guide" class="cy-guide" hidden><\/p>/, 'guidance stays empty and hidden until there is data');
  assert.doesNotMatch(pick(html, /<meta name="description" content="([^"]*)">/), /\d/);
  const files = (await walk(emptyOut)).map((f) => path.relative(emptyOut, f));
  assert.ok(!files.some((f) => /^disciplines\/[^/]+\/index\.html$/.test(f)));
  const sitemap = await fs.readFile(path.join(emptyOut, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/firstsilicon\.pages\.dev\/programs\/<\/loc>/);
  assert.doesNotMatch(sitemap, /404/);
  const llms = await fs.readFile(path.join(emptyOut, 'llms.txt'), 'utf8');
  assert.match(llms, /^# First Silicon/);
  assert.match(llms, /## How to cite/);
  assert.match(llms, /first automatic data run has not happened yet/);
  const about = await fs.readFile(path.join(emptyOut, 'about/index.html'), 'utf8');
  assert.match(about, /Built by Mahir Patel, an electrical-engineering student at the University of Illinois Urbana-Champaign\./);
  assert.doesNotMatch(about, /update, \d+ of \d+ roles said/, 'no class-year numbers before the first run');
  const privacy = await fs.readFile(path.join(emptyOut, 'privacy/index.html'), 'utf8');
  for (const phrase of ['cookieless', 'localStorage', 'Global Privacy Control', 'Do Not Track', 'EU/EEA, the UK and Switzerland', 'No IP addresses are stored', 'country, the device class']) {
    assert.ok(privacy.includes(phrase), `privacy mentions ${phrase}`);
  }
  const sponsor = await fs.readFile(path.join(emptyOut, 'sponsor/index.html'), 'utf8');
  assert.match(sponsor, /Sponsorships open once the weekly email reaches 1,000 subscribers/);
});

test('hero, class-year guidance and filter counts are computed from the data (known 5-role data set)', async () => {
  const html = await fs.readFile(path.join(smallOut, 'index.html'), 'utf8');
  assert.equal(pick(html, /<h1 id="hero-h">([^<]*)<\/h1>/), 'Every hardware internship, labeled.');
  assert.equal(
    pick(html, /<p class="lede"[^>]*>([^<]*)<\/p>/),
    "5 internships and co-ops at 2 companies — PCB, embedded, RF, test, silicon — tagged by class year, discipline and citizenship. Updated every morning from the companies' own job boards.",
  );
  assert.equal(
    pick(html, /<p id="cy-guide" class="cy-guide">([^<]*)<\/p>/),
    "Only 1 posting says freshmen or sophomores can apply. 3 don't list a class year at all: apply to those unless the posting says juniors/seniors or a graduation date you can't meet.",
  );
  // The guidance sits right after the class-year select, which points to it, and the default view is every role.
  assert.match(html, /<select id="f-cy" name="cy" aria-describedby="cy-guide"><option value="">All class years<\/option><option value="fs" data-label="Fr\/So friendly">Fr\/So friendly \(1\)<\/option><option value="open" data-label="Fr\/So friendly or not stated">Fr\/So friendly or not stated \(4\)<\/option><option value="jplus" data-label="Juniors\+ only">Juniors\+ only \(1\)<\/option><\/select><\/div><p id="cy-guide"/);
  assert.match(html, /<li><span class="num" data-stat="roles">5<\/span><span class="lab">open roles<\/span><\/li><li><span class="num" data-stat="companies">2<\/span><span class="lab">companies with open roles<\/span><\/li>/);
  assert.equal(pick(html, /<meta name="description" content="([^"]*)">/), '5 hardware internships and co-ops at 2 companies, labeled by discipline, class year and citizenship. Updated every morning.');
  assert.match(html, /Showing the 5 newest of 5 roles/);
  const faq = JSON.parse(html.match(/<script type="application\/ld\+json">(\{[^<]*"FAQPage"[^<]*)<\/script>/)[1]);
  assert.match(faq.mainEntity[1].acceptedAnswer.text, /In the September 24, 2026 update, 1 of 5 did: .* 3 do not state a class year at all\./);
  const about = await fs.readFile(path.join(smallOut, 'about/index.html'), 'utf8');
  assert.match(about, /In the September 24, 2026 update, 1 of 5 roles said freshmen or sophomores can apply, 1 asked for junior standing or later, and 3 did not state a class year at all\./);
  const pcb = await fs.readFile(path.join(smallOut, 'disciplines/pcb/index.html'), 'utf8');
  assert.match(pcb, /5 open roles right now: 1 says freshmen or sophomores can apply, 3 don't list a class year\./);
  const llms = await fs.readFile(path.join(smallOut, 'llms.txt'), 'utf8');
  assert.match(llms, /As of 2026-09-24: 5 open hardware internships and co-ops at 2 companies\. Class year: 1 says freshmen or sophomores can apply, 1 requires junior standing or later, 3 do not state one\. 5 have no citizenship or export flags/);
});

test('live data/ build: hero and guidance match counts computed from data/jobs.json', async (t) => {
  const jobs = JSON.parse(await fs.readFile('data/jobs.json', 'utf8')).jobs || [];
  const meta = JSON.parse(await fs.readFile('data/meta.json', 'utf8'));
  if (!meta.last_run || !jobs.length) return t.skip('no live data yet');
  const c = computeCounts(jobs, meta.last_run.slice(0, 10), site.NEW_DAYS);
  const html = await fs.readFile(path.join(prodOut, 'index.html'), 'utf8');
  assert.equal(pick(html, /<h1 id="hero-h">([^<]*)<\/h1>/), site.TAGLINE);
  const lede = pick(html, /<p class="lede"[^>]*>([^<]*)<\/p>/);
  assert.equal(lede, heroSubhead(c));
  assert.ok(lede.startsWith(`${c.roles.toLocaleString('en-US')} internships and co-ops at ${c.companies.toLocaleString('en-US')} companies`), lede);
  const guide = pick(html, /<p id="cy-guide" class="cy-guide">([^<]*)<\/p>/);
  assert.equal(guide, classYearGuidance(c));
  assert.match(guide, new RegExp(`\\b${c.fs.toLocaleString('en-US')} postings? says? freshmen or sophomores can apply\\.`));
  assert.match(guide, new RegExp(`\\b${c.unspecified.toLocaleString('en-US')} (?:don't|doesn't) list a class year at all`));
  assert.match(html, new RegExp(`Fr/So friendly \\(${c.fs}\\)</option>`));
  assert.equal(c.fs + c.jplus + c.unspecified, c.roles, 'every role has exactly one class-year label');
});

test('no page, llms.txt or OG text still promises a freshman/sophomore-only list', async () => {
  for (const dir of [prodOut, emptyOut, smallOut]) {
    for (const f of (await walk(dir)).filter((x) => /\.(html|txt)$/.test(x))) {
      assert.doesNotMatch(await fs.readFile(f, 'utf8'), OLD_PROMISE, path.relative(tmp, f));
    }
  }
  assert.doesNotMatch(await fs.readFile('scripts/og.mjs', 'utf8'), OLD_PROMISE);
  const home = await fs.readFile(path.join(prodOut, 'index.html'), 'utf8');
  assert.equal(pick(home, /<title>([^<]*)<\/title>/), 'First Silicon: every hardware internship, labeled');
  assert.equal(pick(home, /<meta property="og:image:alt" content="([^"]*)">/), 'First Silicon: every hardware internship, labeled by class year, discipline and citizenship');
});

test('forms: subscribe/contact/sponsor use pulseLead kinds with a hidden honeypot', async () => {
  const pages = { 'newsletter/index.html': 'subscribe', 'contact/index.html': 'contact', 'sponsor/index.html': 'sponsor' };
  for (const [rel, kind] of Object.entries(pages)) {
    const html = await fs.readFile(path.join(prodOut, rel), 'utf8');
    assert.match(html, new RegExp(`data-lead="${kind}"`));
    assert.match(html, /<div class="hp" aria-hidden="true"><label for="[^"]+">Website<\/label><input id="[^"]+" name="website" type="text" tabindex="-1" autocomplete="off"><\/div>/);
    assert.match(html, /role="status" aria-live="polite"/);
  }
});

test('build is deterministic', async () => {
  const again = path.join(tmp, 'demo-dist-2');
  await build({ dataDir: path.join(tmp, 'demo-data'), outDir: again, demo: true });
  assert.equal(await digest(demoOut), await digest(again));
  await fs.rm(tmp, { recursive: true, force: true });
});
