import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { build } from '../../build.mjs';
import { makeDemoData } from '../../scripts/make-demo-data.mjs';
import * as site from '../../config/site.mjs';

let tmp;
let demoOut;
let prodOut;

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
  for (const dir of [demoOut, prodOut]) {
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

test('production build with no data yet: honest empty state, no discipline pages, sitemap and llms.txt', async () => {
  const html = await fs.readFile(path.join(prodOut, 'index.html'), 'utf8');
  assert.match(html, /first automatic update has not run/);
  assert.doesNotMatch(html, /class="role"/);
  const files = (await walk(prodOut)).map((f) => path.relative(prodOut, f));
  assert.ok(!files.some((f) => /^disciplines\/[^/]+\/index\.html$/.test(f)));
  const sitemap = await fs.readFile(path.join(prodOut, 'sitemap.xml'), 'utf8');
  assert.match(sitemap, /<loc>https:\/\/firstsilicon\.pages\.dev\/programs\/<\/loc>/);
  assert.doesNotMatch(sitemap, /404/);
  const llms = await fs.readFile(path.join(prodOut, 'llms.txt'), 'utf8');
  assert.match(llms, /^# First Silicon/);
  assert.match(llms, /## How to cite/);
  assert.match(llms, /first automatic data run has not happened yet/);
  const about = await fs.readFile(path.join(prodOut, 'about/index.html'), 'utf8');
  assert.match(about, /Built by Mahir Patel, an electrical-engineering student at the University of Illinois Urbana-Champaign\./);
  const privacy = await fs.readFile(path.join(prodOut, 'privacy/index.html'), 'utf8');
  for (const phrase of ['cookieless', 'localStorage', 'Global Privacy Control', 'Do Not Track', 'EU/EEA, the UK and Switzerland', 'No IP addresses are stored', 'country, the device class']) {
    assert.ok(privacy.includes(phrase), `privacy mentions ${phrase}`);
  }
  const sponsor = await fs.readFile(path.join(prodOut, 'sponsor/index.html'), 'utf8');
  assert.match(sponsor, /Sponsorships open once the weekly email reaches 1,000 subscribers/);
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
