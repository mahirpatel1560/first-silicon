// End-to-end tests against local static servers of dist/ (production build) and .demo-dist/ (fictional fixture data).
// Chromium from /opt/pw-browsers. The Pulse script is served from the local shared copy; /e and /lead are mocked.

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import fss from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.PLAYWRIGHT_BROWSERS_PATH ||= '/opt/pw-browsers';
const { chromium } = await import('playwright');
const { startServer } = await import('../../scripts/serve.mjs');
const { build } = await import('../../build.mjs');
const { makeDemoData } = await import('../../scripts/make-demo-data.mjs');
const { applyFilters, facets, DEFAULT_STATE } = await import('../../src/site/js/filters.mjs');
const { classYearGuidance } = await import('../../src/lib/copy.mjs');
const site = await import('../../config/site.mjs');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SHOTS = path.join(ROOT, 'screenshots');
const PULSE_JS = fss.readFileSync('/home/claude/portfolio/shared/pulse.min.js', 'utf8');
const AXE_JS = fss.readFileSync(path.join(ROOT, 'node_modules/axe-core/axe.min.js'), 'utf8');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const TODAY = new Date().toISOString().slice(0, 10);

let browser;
let prod;
let demo;
let demoJobs;
let prodJobs;
const results = { axe: [], links: 0, screenshots: [] };
/** Guidance text the page should show for a list of roles (same rule as the build). */
const guidanceFor = (jobs) => {
  const f = facets(jobs);
  return classYearGuidance({ roles: jobs.length, fs: f.classYears.fs, unspecified: f.classYears.unspecified });
};

before(async () => {
  await makeDemoData({ out: '.demo-data' });
  await build({ dataDir: '.demo-data', outDir: '.demo-dist', demo: true });
  await build({ dataDir: 'data', outDir: 'dist' });
  demoJobs = JSON.parse(await fs.readFile(path.join(ROOT, '.demo-dist/data/jobs.json'), 'utf8')).jobs;
  prodJobs = JSON.parse(await fs.readFile(path.join(ROOT, 'dist/data/jobs.json'), 'utf8')).jobs;
  prod = await startServer(path.join(ROOT, 'dist'), 0);
  demo = await startServer(path.join(ROOT, '.demo-dist'), 0);
  browser = await chromium.launch();
  await fs.mkdir(SHOTS, { recursive: true });
});

after(async () => {
  await browser?.close();
  await prod?.close();
  await demo?.close();
  await fs.writeFile(path.join(ROOT, 'tests/e2e/.last-run.json'), JSON.stringify(results, null, 2));
});

/** New page with Pulse mocked. opts.lead: {ok:boolean}|'network'; opts.blockPulse: abort pulse.js. */
async function openPage(opts = {}) {
  const context = await browser.newContext({
    viewport: opts.viewport || { width: 1280, height: 900 },
    colorScheme: opts.colorScheme || 'light',
    userAgent: UA,
    bypassCSP: Boolean(opts.bypassCSP),
    reducedMotion: 'reduce',
  });
  // Force Pulse to use fetch (interceptable) instead of sendBeacon.
  await context.addInitScript(() => {
    try {
      Object.defineProperty(navigator, 'sendBeacon', { value: () => false });
    } catch {}
  });
  const events = [];
  const leads = [];
  let leadResponse = opts.lead ?? { ok: true };
  await context.route('https://pulse.ringlatch.workers.dev/**', async (route) => {
    const url = route.request().url();
    if (url.endsWith('/pulse.js')) {
      if (opts.blockPulse) return route.abort();
      return route.fulfill({ status: 200, contentType: 'text/javascript', body: PULSE_JS });
    }
    if (url.endsWith('/e')) {
      try {
        events.push(JSON.parse(route.request().postData() || '{}'));
      } catch {}
      return route.fulfill({ status: 204, body: '' });
    }
    if (url.endsWith('/lead')) {
      leads.push(JSON.parse(route.request().postData() || '{}'));
      if (leadResponse === 'network') return route.abort();
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(leadResponse) });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  // Employer links (fictional fixture URLs) and anything else off-site: never touch the network.
  await context.route(/^https?:\/\/(?!127\.0\.0\.1|pulse\.ringlatch)/, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>external</title>ok' }));
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => pageErrors.push(e.message));
  return {
    page,
    context,
    events,
    leads,
    consoleErrors,
    pageErrors,
    setLead: (v) => {
      leadResponse = v;
    },
    close: () => context.close(),
  };
}

async function shot(page, name, fullPage = false) {
  const file = path.join(SHOTS, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  results.screenshots.push(`screenshots/${name}.png`);
}

const countText = (page) => page.locator('#result-count').textContent();
const renderedIds = (page) => page.locator('#roles .role').evaluateAll((els) => els.map((e) => e.getAttribute('data-id')));

test('production landing: zero console errors, CSP header, every role by default, class-year guidance from the data, pageview sent', async () => {
  const t = await openPage();
  const res = await t.page.goto(`${prod.url}/`, { waitUntil: 'networkidle' });
  assert.match(res.headers()['content-security-policy'], /script-src 'self' https:\/\/pulse\.ringlatch\.workers\.dev/);
  assert.equal(res.headers()['x-content-type-options'], 'nosniff');
  await t.page.waitForFunction(() => document.querySelector('#finder').classList.contains('is-live'));
  assert.equal(await t.page.locator('h1').textContent(), 'Every hardware internship, labeled.');
  await shot(t.page, 'landing-production-desktop');
  if (!prodJobs.length) {
    // Before the first daily run: honest empty state, no guidance.
    assert.match(await t.page.locator('#roles').textContent(), /No roles yet/);
    assert.equal(await countText(t.page), 'No roles yet');
    assert.equal(await t.page.locator('#cy-guide').isHidden(), true);
  } else {
    // Default view: every role, newest first.
    assert.equal(await t.page.inputValue('#f-cy'), '');
    assert.equal(await countText(t.page), `Showing ${Math.min(50, prodJobs.length)} of ${prodJobs.length} roles, newest first`);
    assert.match(await t.page.locator('.lede').textContent(), new RegExp(`^${prodJobs.length.toLocaleString('en-US')} internships and co-ops at \\d+ companies — `));
    // Guidance next to the class-year filter, with counts from the data; the select points to it.
    const guide = t.page.locator('#cy-guide');
    assert.equal(await guide.isVisible(), true);
    assert.equal(await guide.textContent(), guidanceFor(prodJobs));
    assert.equal(await t.page.locator('#f-cy').getAttribute('aria-describedby'), 'cy-guide');
    // The Fr/So filter still works and shows exactly the explicit roles.
    const fsIds = applyFilters(prodJobs, { ...DEFAULT_STATE, cy: 'fs' }, TODAY).map((j) => j.id);
    assert.equal(await t.page.locator('#f-cy option[value="fs"]').textContent(), `Fr/So friendly (${fsIds.length})`);
    await t.page.selectOption('#f-cy', 'fs');
    await t.page.waitForTimeout(60);
    assert.deepEqual(await renderedIds(t.page), fsIds.slice(0, 50));
    assert.equal(await countText(t.page), `Showing ${Math.min(50, fsIds.length)} of ${fsIds.length} matching roles (${prodJobs.length} total)`);
  }
  assert.deepEqual(t.consoleErrors, []);
  assert.deepEqual(t.pageErrors, []);
  assert.ok(t.events.some((e) => e.t === 'pageview' && e.s === 'fs' && e.p === '/'), 'pageview event with site key fs');
  await t.close();
  const m = await openPage({ viewport: { width: 390, height: 844 } });
  await m.page.goto(`${prod.url}/`, { waitUntil: 'networkidle' });
  await m.page.waitForFunction(() => document.querySelector('#finder').classList.contains('is-live'));
  await shot(m.page, 'landing-production-mobile');
  await m.close();
});

test('class-year guidance and option counts follow a newer list loaded from the public data repo', async () => {
  if (!site.REPO_RAW_BASE || !prodJobs.length) return;
  // A newer list in which two more roles say Fr/So (fictional edit of the real list, served only to this test).
  let flipped = 0;
  const newer = prodJobs.map((j) => (j.class_year === 'unspecified' && flipped < 2 ? (flipped++, { ...j, class_year: 'fs' }) : j));
  const t = await openPage();
  await t.context.route(`${site.REPO_RAW_BASE}/data/jobs.json`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ schema: 1, generated_at: '2099-01-01T00:00:00.000Z', count: newer.length, jobs: newer }) }),
  );
  await t.page.goto(`${prod.url}/`, { waitUntil: 'networkidle' });
  await t.page.waitForFunction(() => document.querySelector('#finder').classList.contains('is-live'));
  assert.match(await t.page.locator('#data-notice').textContent(), /Loaded the latest list from the public data repo/);
  assert.notEqual(guidanceFor(newer), guidanceFor(prodJobs));
  assert.equal(await t.page.locator('#cy-guide').textContent(), guidanceFor(newer));
  const fsCount = newer.filter((j) => j.class_year === 'fs').length;
  assert.equal(await t.page.locator('#f-cy option[value="fs"]').textContent(), `Fr/So friendly (${fsCount})`);
  await t.page.selectOption('#f-cy', 'fs');
  await t.page.waitForTimeout(60);
  assert.equal((await renderedIds(t.page)).length, Math.min(50, fsCount));
  assert.deepEqual(t.pageErrors, []);
  await t.close();
});

test('demo landing: all roles load, zero console errors, stats match data', async () => {
  const t = await openPage();
  await t.page.goto(`${demo.url}/`, { waitUntil: 'networkidle' });
  await t.page.waitForFunction(() => document.querySelector('#finder').classList.contains('is-live'));
  assert.equal((await renderedIds(t.page)).length, demoJobs.length);
  assert.equal(await countText(t.page), `Showing ${demoJobs.length} of ${demoJobs.length} roles, newest first`);
  assert.equal(await t.page.locator('#more').isHidden(), true);
  assert.deepEqual(t.consoleErrors, []);
  assert.deepEqual(t.pageErrors, []);
  await shot(t.page, 'landing-demo-desktop');
  await shot(t.page, 'landing-demo-desktop-full', true);
  await t.close();
});

test('filters: each control narrows the list exactly like the shared filter logic, and syncs to the URL', async () => {
  const t = await openPage();
  const { page } = t;
  await page.goto(`${demo.url}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#finder').classList.contains('is-live'));
  const expectIds = (s) => applyFilters(demoJobs, { ...DEFAULT_STATE, ...s }, TODAY).map((j) => j.id);
  const check = async (s, label) => {
    await page.waitForTimeout(60);
    const got = await renderedIds(page);
    assert.deepEqual(got, expectIds(s), label);
    assert.ok(got.length > 0 || label.includes('empty'), `${label} returns roles`);
  };
  await page.selectOption('#f-d', 'embedded');
  await check({ d: 'embedded' }, 'discipline');
  assert.match(page.url(), /\?d=embedded$/);
  await page.selectOption('#f-cy', 'fs');
  await check({ d: 'embedded', cy: 'fs' }, 'discipline + class year');
  await page.selectOption('#f-d', '');
  await check({ cy: 'fs' }, 'class year');
  await page.check('input[name="cf"]');
  await check({ cy: 'fs', cf: true }, 'citizenship-free');
  for (const id of await renderedIds(page)) {
    const j = demoJobs.find((x) => x.id === id);
    assert.ok(!j.flags.some((f) => ['citizenship', 'residency', 'export', 'clearance'].includes(f)));
  }
  await page.selectOption('#f-cy', '');
  await page.uncheck('input[name="cf"]');
  await page.selectOption('#f-t', 'Summer 2027');
  await check({ t: 'Summer 2027' }, 'term');
  await page.selectOption('#f-t', 'coop');
  await check({ t: 'coop' }, 'co-ops');
  await page.selectOption('#f-t', '');
  await page.selectOption('#f-loc', 'remote');
  await check({ loc: 'remote' }, 'remote');
  await page.selectOption('#f-loc', 'intl');
  await check({ loc: 'intl' }, 'outside US/Canada');
  await page.selectOption('#f-loc', '');
  await page.fill('#f-q', 'photonics');
  await page.waitForTimeout(350);
  await check({ q: 'photonics' }, 'search');
  assert.match(await countText(page), /matching roles/);
  await page.fill('#f-q', 'zzzz-nothing');
  await page.waitForTimeout(350);
  assert.match(await page.locator('#roles').textContent(), /No roles match these filters/);
  await page.click('#roles [data-reset]');
  await check({}, 'reset');
  assert.equal(await page.inputValue('#f-q'), '');
  assert.equal(new URL(page.url()).search, '');
  await page.check('input[name="new"]');
  await check({ nw: true }, 'new this week');
  await shot(page, 'filters-applied-desktop');
  // Analytics: activation once per session and a debounced search event without the typed text.
  await page.waitForTimeout(1700);
  const activates = t.events.filter((e) => e.t === 'activate');
  assert.equal(activates.length, 1);
  const search = t.events.filter((e) => e.t === 'search');
  assert.ok(search.length >= 1);
  assert.ok(search.every((e) => !JSON.stringify(e.d).includes('photonics') && !JSON.stringify(e.d).includes('zzzz')), 'search text is never sent');
  assert.deepEqual(t.consoleErrors, []);
  await t.close();
});

test('URL parameters restore the filter state on load', async () => {
  const t = await openPage({ viewport: { width: 390, height: 844 } });
  await t.page.goto(`${demo.url}/?d=digital&cy=open`, { waitUntil: 'networkidle' });
  await t.page.waitForFunction(() => document.querySelector('#finder').classList.contains('is-live'));
  assert.equal(await t.page.inputValue('#f-d'), 'digital');
  assert.equal(await t.page.inputValue('#f-cy'), 'open');
  const expected = applyFilters(demoJobs, { ...DEFAULT_STATE, d: 'digital', cy: 'open' }, TODAY).map((j) => j.id);
  assert.deepEqual(await renderedIds(t.page), expected);
  await shot(t.page, 'filters-applied-mobile');
  await t.close();
});

test('role links open the employer page in a new tab and send cta_click + outbound + activate', async () => {
  const t = await openPage();
  await t.page.goto(`${demo.url}/`, { waitUntil: 'networkidle' });
  await t.page.waitForFunction(() => document.querySelector('#finder').classList.contains('is-live'));
  const link = t.page.locator('#roles .role-title').first();
  assert.equal(await link.getAttribute('target'), '_blank');
  assert.equal(await link.getAttribute('rel'), 'noopener');
  assert.equal(await link.getAttribute('data-pulse'), 'role_out');
  const href = await link.getAttribute('href');
  const [popup] = await Promise.all([t.context.waitForEvent('page'), link.click()]);
  await popup.waitForLoadState();
  assert.equal(popup.url(), href);
  await t.page.waitForTimeout(200);
  const cta = t.events.find((e) => e.t === 'cta_click');
  assert.ok(cta && cta.d.label === 'role_out' && href.startsWith(cta.d.href.slice(0, 40)));
  const out = t.events.find((e) => e.t === 'outbound');
  assert.ok(out && out.d.company);
  assert.ok(t.events.some((e) => e.t === 'activate' && e.d.via === 'role'));
  for (const e of t.events) assert.ok(Object.keys(e.d || {}).length <= 12, 'props <= 12 keys');
  await t.close();
});

test('newsletter form: validation, success, fallback keeps typed text, honeypot', async () => {
  const t = await openPage({ viewport: { width: 390, height: 844 } });
  const { page } = t;
  await page.goto(`${prod.url}/newsletter/`, { waitUntil: 'networkidle' });
  const form = page.locator('form[data-lead="subscribe"]');
  await form.locator('button[type="submit"]').click();
  assert.equal(await form.locator('[data-status]').textContent(), 'Please enter a valid email address.');
  assert.equal(await form.locator('input[type="email"]').getAttribute('aria-invalid'), 'true');
  assert.equal(t.leads.length, 0);
  await form.locator('input[type="email"]').fill('student@example.edu');
  await form.locator('select[name="class_year"]').selectOption('Second year');
  await form.locator('button[type="submit"]').click();
  await page.waitForFunction(() => /on the list/.test(document.querySelector('form[data-lead="subscribe"] [data-status]').textContent));
  assert.equal(t.leads.length, 1);
  assert.equal(t.leads[0].form, 'subscribe');
  assert.equal(t.leads[0].site, 'fs');
  assert.equal(t.leads[0].email, 'student@example.edu');
  assert.equal(t.leads[0].website, '');
  await shot(page, 'newsletter-mobile');
  // Server says no: friendly fallback, nothing lost.
  t.setLead({ ok: false, error: 'rate_limited' });
  await form.locator('input[type="email"]').fill('keep@example.edu');
  await form.locator('button[type="submit"]').click();
  await page.waitForFunction(() => /Couldn't send/.test(document.querySelector('form[data-lead="subscribe"] [data-status]').textContent));
  assert.equal(await form.locator('input[type="email"]').inputValue(), 'keep@example.edu');
  // Network failure: same fallback.
  t.setLead('network');
  await form.locator('button[type="submit"]').click();
  await page.waitForFunction(() => /Couldn't send/.test(document.querySelector('form[data-lead="subscribe"] [data-status]').textContent));
  assert.equal(await form.locator('input[type="email"]').inputValue(), 'keep@example.edu');
  // Honeypot filled: pretend success, send nothing.
  t.setLead({ ok: true });
  const before = t.leads.length;
  await form.locator('input[name="website"]').evaluate((el) => {
    el.value = 'http://spam.example';
  });
  await form.locator('button[type="submit"]').click();
  await page.waitForTimeout(150);
  assert.equal(t.leads.length, before);
  assert.deepEqual(t.pageErrors, []);
  await t.close();
});

test('forms still work when the Pulse script is blocked (fallback message, text kept)', async () => {
  const t = await openPage({ blockPulse: true });
  const { page } = t;
  await page.goto(`${prod.url}/contact/`, { waitUntil: 'networkidle' });
  await page.fill('#c-email', 'someone@example.edu');
  await page.click('form[data-lead="contact"] button[type="submit"]');
  assert.equal(await page.locator('form[data-lead="contact"] [data-status]').textContent(), 'Please fill in the required fields.');
  assert.equal(await page.locator('#c-message').getAttribute('aria-invalid'), 'true');
  await page.fill('#c-message', 'The RF intern label looks wrong.');
  await page.click('form[data-lead="contact"] button[type="submit"]');
  await page.waitForFunction(() => /Couldn't send/.test(document.querySelector('form[data-lead="contact"] [data-status]').textContent));
  assert.equal(await page.inputValue('#c-message'), 'The RF intern label looks wrong.');
  assert.equal(await page.inputValue('#c-email'), 'someone@example.edu');
  assert.deepEqual(t.pageErrors, [], 'no JS errors without Pulse');
  // The landing's finder also works without Pulse.
  await page.goto(`${demo.url}/`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#finder').classList.contains('is-live'));
  await page.selectOption('#f-d', 'power');
  assert.ok((await renderedIds(page)).length > 0);
  assert.deepEqual(t.pageErrors, []);
  await t.close();
});

test('mobile 390x844: no horizontal scroll, filters and first roles above the fold', async () => {
  for (const [server, name] of [[demo, 'landing-demo-mobile'], [prod, null]]) {
    const t = await openPage({ viewport: { width: 390, height: 844 } });
    await t.page.goto(`${server.url}/`, { waitUntil: 'networkidle' });
    const sw = await t.page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(sw <= 390, `scrollWidth ${sw}`);
    const box = await t.page.locator('#f-q').boundingBox();
    assert.ok(box.y + box.height < 844, 'search box above the fold');
    const cy = await t.page.locator('#f-cy').boundingBox();
    assert.ok(cy.y + cy.height < 844, 'class-year filter above the fold');
    const guide = await t.page.locator('#cy-guide').boundingBox();
    if (guide) assert.ok(guide.y >= cy.y + cy.height && guide.y + guide.height < 844, 'class-year guidance right below the filter and above the fold');
    if (name) await shot(t.page, name);
    for (const p of ['/programs/', '/how-it-works/', '/about/']) {
      await t.page.goto(`${server.url}${p}`, { waitUntil: 'networkidle' });
      const w = await t.page.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(w <= 390, `${p} scrollWidth ${w}`);
    }
    await t.close();
  }
  const t = await openPage({ viewport: { width: 390, height: 844 } });
  await t.page.goto(`${prod.url}/`, { waitUntil: 'networkidle' });
  const first = await t.page.locator('#roles li').first().boundingBox();
  assert.ok(first.y < 844, 'list starts above the fold in production');
  await t.close();
});

test('keyboard: skip link, filter controls and role links are reachable', async () => {
  const t = await openPage();
  const { page } = t;
  await page.goto(`${demo.url}/`, { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.className), 'skip-link');
  await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => document.activeElement.id), 'main');
  await page.focus('#f-q');
  await page.keyboard.type('fpga');
  await page.waitForTimeout(350);
  assert.ok((await renderedIds(page)).length > 0);
  const outline = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
  assert.notEqual(outline, 'none', 'visible focus indicator');
  await t.close();
});

test('unknown paths get the 404 page', async () => {
  const t = await openPage();
  const res = await t.page.goto(`${prod.url}/disciplines/does-not-exist/`, { waitUntil: 'networkidle' });
  assert.equal(res.status(), 404);
  assert.match(await t.page.locator('h1').textContent(), /Page not found/);
  await t.close();
});

test('screenshots of key pages (desktop, mobile, dark)', async () => {
  const pages = [
    [demo, '/programs/', 'programs'],
    [demo, '/disciplines/', 'disciplines'],
    [demo, '/disciplines/embedded/', 'discipline-embedded'],
    [prod, '/how-it-works/', 'how-it-works'],
    [prod, '/about/', 'about'],
    [prod, '/sponsor/', 'sponsor'],
  ];
  for (const [server, p, name] of pages) {
    const d = await openPage();
    await d.page.goto(`${server.url}${p}`, { waitUntil: 'networkidle' });
    await shot(d.page, `${name}-desktop`);
    assert.deepEqual(d.consoleErrors, [], `${p} console errors`);
    await d.close();
    const m = await openPage({ viewport: { width: 390, height: 844 } });
    await m.page.goto(`${server.url}${p}`, { waitUntil: 'networkidle' });
    await shot(m.page, `${name}-mobile`);
    await m.close();
  }
  const dark = await openPage({ colorScheme: 'dark' });
  await dark.page.goto(`${demo.url}/`, { waitUntil: 'networkidle' });
  await dark.page.waitForFunction(() => document.querySelector('#finder').classList.contains('is-live'));
  await shot(dark.page, 'landing-demo-dark-desktop');
  await dark.close();
  const darkM = await openPage({ colorScheme: 'dark', viewport: { width: 390, height: 844 } });
  await darkM.page.goto(`${demo.url}/programs/`, { waitUntil: 'networkidle' });
  await shot(darkM.page, 'programs-dark-mobile');
  await darkM.close();
});

test('axe-core: zero serious or critical violations on key pages (light and dark)', async () => {
  const targets = [
    [demo, '/'], [prod, '/'], [demo, '/programs/'], [demo, '/disciplines/'], [demo, '/disciplines/embedded/'],
    [prod, '/how-it-works/'], [prod, '/newsletter/'], [prod, '/contact/'], [prod, '/about/'], [prod, '/privacy/'],
    [prod, '/terms/'], [prod, '/sponsor/'], [prod, '/404.html'],
  ];
  const bad = [];
  for (const scheme of ['light', 'dark']) {
    for (const [server, p] of targets) {
      const t = await openPage({ bypassCSP: true, colorScheme: scheme });
      await t.page.goto(`${server.url}${p}`, { waitUntil: 'networkidle' });
      if (p === '/') await t.page.waitForFunction(() => document.querySelector('#finder').classList.contains('is-live'));
      await t.page.addScriptTag({ content: AXE_JS });
      const r = await t.page.evaluate(async () => {
        // eslint-disable-next-line no-undef
        const out = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
        return out.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, sample: v.nodes[0] && v.nodes[0].target.join(' ') }));
      });
      const serious = r.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      results.axe.push({ page: `${server === demo ? 'demo' : 'prod'}${p}`, scheme, violations: r });
      if (serious.length) bad.push({ page: p, scheme, serious });
      await t.close();
    }
  }
  assert.deepEqual(bad, []);
});

test('internal links: every href/src in dist/ and .demo-dist/ resolves (including #anchors)', async () => {
  const problems = [];
  for (const dirName of ['dist', '.demo-dist']) {
    const dir = path.join(ROOT, dirName);
    const files = [];
    const walk = async (d) => {
      for (const e of await fs.readdir(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) await walk(p);
        else if (e.name.endsWith('.html')) files.push(p);
      }
    };
    await walk(dir);
    const resolve = (urlPath) => {
      const clean = decodeURIComponent(urlPath);
      const candidates = clean.endsWith('/') ? [path.join(dir, clean, 'index.html')] : [path.join(dir, clean), path.join(dir, clean, 'index.html')];
      return candidates.find((c) => fss.existsSync(c) && fss.statSync(c).isFile());
    };
    for (const f of files) {
      const html = await fs.readFile(f, 'utf8');
      for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
        const raw = m[1];
        if (/^(https?:|mailto:|data:|#$)/.test(raw)) continue;
        const u = new URL(raw, `http://x/${path.relative(dir, f)}`);
        results.links++;
        const target = resolve(u.pathname);
        if (!target) {
          problems.push(`${dirName}/${path.relative(dir, f)} -> ${raw}`);
          continue;
        }
        if (u.hash && target.endsWith('.html')) {
          const t = await fs.readFile(target, 'utf8');
          if (!t.includes(`id="${u.hash.slice(1)}"`)) problems.push(`${dirName}/${path.relative(dir, f)} -> ${raw} (missing anchor)`);
        }
      }
    }
  }
  assert.deepEqual(problems, []);
  assert.ok(results.links > 100, `${results.links} internal links checked`);
});
