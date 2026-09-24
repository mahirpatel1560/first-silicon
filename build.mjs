#!/usr/bin/env node
// Deterministic static-site build: src/ + data/ -> dist/.
// Usage: node build.mjs [--data data] [--out dist] [--demo]
// --demo marks every page with a "fictional test data" banner and noindex (used for tests/screenshots only).

import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import * as site from './config/site.mjs';
import { DISCIPLINES } from './src/lib/disciplines.mjs';
import { computeCounts } from './src/lib/pipeline.mjs';
import { documentHtml } from './src/site/layout.mjs';
import * as pages from './src/site/pages.mjs';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const STATIC_FILES = ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'icon-512.png', 'og.png'];

function parseArgs(argv) {
  const a = { dataDir: 'data', outDir: 'dist', demo: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--data') a.dataDir = argv[++i];
    else if (argv[i] === '--out') a.outDir = argv[++i];
    else if (argv[i] === '--demo') a.demo = true;
  }
  return a;
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);

async function bundleAssets(outDir) {
  const js = await esbuild.build({
    entryPoints: [path.join(ROOT, 'src/site/js/app.mjs')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2019'],
    legalComments: 'none',
    write: false,
    logLevel: 'silent',
  });
  const jsText = js.outputFiles[0].contents;
  const cssSrc = await fs.readFile(path.join(ROOT, 'src/site/css/site.css'), 'utf8');
  const css = await esbuild.transform(cssSrc, { loader: 'css', minify: true, target: ['chrome90', 'firefox90', 'safari14'] });
  const jsName = `/assets/app.${sha(jsText)}.js`;
  const cssName = `/assets/site.${sha(css.code)}.css`;
  await fs.mkdir(path.join(outDir, 'assets'), { recursive: true });
  await fs.writeFile(path.join(outDir, jsName), jsText);
  await fs.writeFile(path.join(outDir, cssName), css.code);
  return { js: jsName, css: cssName, jsBytes: jsText.length, cssBytes: css.code.length };
}

function outFileFor(p) {
  if (p === '/') return 'index.html';
  if (p.endsWith('.html')) return p.slice(1);
  return path.join(p.slice(1), 'index.html');
}

export function headersFile() {
  const connect = ["'self'", site.PULSE_ORIGIN];
  if (site.REPO_RAW_BASE) connect.push(new URL(site.REPO_RAW_BASE).origin);
  const csp = [
    "default-src 'self'",
    `script-src 'self' ${site.PULSE_ORIGIN}`,
    `connect-src ${connect.join(' ')}`,
    "img-src 'self' data:",
    "style-src 'self'",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
  return [
    '/*',
    '  X-Content-Type-Options: nosniff',
    '  Referrer-Policy: strict-origin-when-cross-origin',
    '  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=(), browsing-topics=()',
    '  X-Frame-Options: DENY',
    `  Content-Security-Policy: ${csp}`,
    '  Cache-Control: no-cache',
    '',
    '/assets/*',
    '  ! Cache-Control',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/data/*',
    '  ! Cache-Control',
    '  Cache-Control: public, max-age=300, must-revalidate',
    '  Access-Control-Allow-Origin: *',
    '',
    ...['/og.png', '/favicon.svg', '/favicon-32.png', '/apple-touch-icon.png', '/icon-512.png'].flatMap((p) => [p, '  ! Cache-Control', '  Cache-Control: public, max-age=86400', '']),
  ].join('\n');
}

function sitemapXml(entries) {
  const urls = entries
    .map((e) => `  <url><loc>${site.BASE_URL}${e.path}</loc><lastmod>${e.lastmod}</lastmod></url>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

function llmsTxt({ meta, counts, boardsOk, programs, disciplinePages }) {
  const lines = [];
  lines.push('# First Silicon');
  lines.push('');
  lines.push(`> ${site.DESCRIPTION} Focused on roles that first- and second-year students can apply to.`);
  lines.push('');
  lines.push('## Key pages');
  lines.push(`- [Open roles](${site.BASE_URL}/): filterable list of hardware internships and co-ops (discipline, class year, citizenship/export flags, term, location)`);
  lines.push(`- [Programs calendar](${site.BASE_URL}/programs/): government and national-lab programs open before junior year, verified on official pages`);
  lines.push(`- [Discipline guides](${site.BASE_URL}/disciplines/): what each hardware discipline involves and how to prepare`);
  for (const slug of disciplinePages) {
    const d = DISCIPLINES.find((x) => x.slug === slug);
    lines.push(`  - [${d.label}](${site.BASE_URL}/disciplines/${slug}/)`);
  }
  lines.push(`- [How it works](${site.BASE_URL}/how-it-works/): sources, update cadence, labeling rules and limits`);
  lines.push(`- [Current data (JSON)](${site.BASE_URL}/data/jobs.json) and [run metadata](${site.BASE_URL}/data/meta.json)`);
  lines.push(`- [About](${site.BASE_URL}/about/)`);
  lines.push('');
  lines.push('## Facts');
  lines.push('- Sources: the public Greenhouse Job Board API (https://developers.greenhouse.io/job-board.html), Lever Postings API (https://github.com/lever/postings-api) and Ashby public job posting API (https://developers.ashbyhq.com/docs/public-job-posting-api).');
  lines.push(`- Employer job boards read: ${boardsOk} (see ${site.BASE_URL}/how-it-works/).`);
  if (meta && meta.last_run) {
    lines.push(`- As of ${meta.last_run.slice(0, 10)}: ${counts.roles} open hardware internships and co-ops, ${counts.fs} with freshman/sophomore eligibility language, ${counts.citizenship_free} without citizenship or export flags (source: ${site.BASE_URL}/data/meta.json).`);
  } else {
    lines.push('- The first automatic data run has not happened yet.');
  }
  lines.push(`- Programs calendar: ${programs.length} programs, each verified on its official page (dates in ${site.BASE_URL}/data/programs.json).`);
  lines.push('- Update cadence: once a day. Closed roles are removed on the next run.');
  lines.push('- Labels are automatic pattern matches and can be wrong; the original employer posting is authoritative.');
  lines.push(`- ${site.FOUNDER_LINE}`);
  lines.push('');
  lines.push('## How to cite');
  lines.push(`Cite as "First Silicon (${site.BASE_URL.replace('https://', '')}), accessed <date>" with a link to the specific page. For a specific role, link to the employer's original posting, not to First Silicon.`);
  lines.push('');
  return lines.join('\n');
}

export async function build(opts = {}) {
  const { dataDir = 'data', outDir = 'dist', demo = false } = opts;
  const abs = (p) => (path.isAbsolute(p) ? p : path.join(ROOT, p));
  const out = abs(outDir);
  const jobsFile = await readJson(path.join(abs(dataDir), 'jobs.json'), { schema: 1, generated_at: null, count: 0, jobs: [] });
  const jobs = jobsFile.jobs || [];
  const meta = await readJson(path.join(abs(dataDir), 'meta.json'), { schema: 1, last_run: null, status: 'pending_first_run' });
  const programsFile = await readJson(abs('data/programs.json'), { programs: [] });
  const programs = programsFile.programs || [];
  const companiesFile = await readJson(abs('config/companies.json'), { companies: [] });
  const companies = companiesFile.companies || [];
  const today = meta.last_run ? meta.last_run.slice(0, 10) : site.CONTENT_UPDATED;
  const counts = computeCounts(jobs, today, site.NEW_DAYS);
  const disciplinePages = DISCIPLINES.filter((d) => (counts.by_discipline[d.slug] || 0) >= site.MIN_ROLES_FOR_DISCIPLINE_PAGE).map((d) => d.slug);
  const boardsOk = companies.filter((c) => c.status === 'ok').length;

  await fs.rm(out, { recursive: true, force: true });
  await fs.mkdir(out, { recursive: true });
  const assets = await bundleAssets(out);

  const ctx = {
    site,
    jobs,
    meta,
    counts,
    programs,
    companies,
    today,
    disciplinePages,
    boardsOk,
    programsVerifiedOn: programsFile.verified_on || site.CONTENT_UPDATED,
    accuracy: site.LABEL_ACCURACY_NOTE,
    demo,
  };
  const list = [
    pages.homePage(ctx),
    pages.programsPage(ctx),
    pages.disciplinesIndexPage(ctx),
    ...DISCIPLINES.filter((d) => disciplinePages.includes(d.slug)).map((d) => pages.disciplinePage(ctx, d)),
    pages.howItWorksPage(ctx),
    pages.newsletterPage(ctx),
    pages.aboutPage(ctx),
    pages.privacyPage(ctx),
    pages.termsPage(ctx),
    pages.contactPage(ctx),
    pages.sponsorPage(ctx),
    pages.notFoundPage(ctx),
  ];

  const problems = [];
  const titles = new Set();
  for (const p of list) {
    if (p.title.length > 60) problems.push(`${p.path}: title ${p.title.length} chars`);
    if (p.description.length > 155) problems.push(`${p.path}: description ${p.description.length} chars`);
    if (p.description.length < 50) problems.push(`${p.path}: description too short`);
    if (titles.has(p.title)) problems.push(`${p.path}: duplicate title`);
    titles.add(p.title);
    const html = documentHtml({ site, meta, assets, demo, path: p.path, title: p.title, description: p.description, jsonld: p.jsonld, body: p.body, noindex: demo || p.noindex });
    if (/"@type":"JobPosting"/.test(html)) problems.push(`${p.path}: JobPosting structured data is not allowed`);
    const file = path.join(out, outFileFor(p.path));
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, html);
  }
  if (problems.length) throw new Error(`SEO checks failed:\n${problems.join('\n')}`);

  for (const f of STATIC_FILES) {
    try {
      await fs.copyFile(abs(`src/static/${f}`), path.join(out, f));
    } catch {
      console.warn(`warning: src/static/${f} missing (run: node scripts/og.mjs)`);
    }
  }
  await fs.mkdir(path.join(out, 'data'), { recursive: true });
  await fs.writeFile(path.join(out, 'data/jobs.json'), JSON.stringify({ schema: 1, generated_at: jobsFile.generated_at || null, count: jobs.length, jobs }));
  await fs.writeFile(path.join(out, 'data/meta.json'), JSON.stringify(meta));
  await fs.writeFile(path.join(out, 'data/programs.json'), JSON.stringify(programsFile));

  const sitemapEntries = list
    .filter((p) => !p.noindex)
    .map((p) => ({
      path: p.path,
      lastmod: p.path === '/' || p.path.startsWith('/disciplines/') || p.path === '/how-it-works/' ? today : p.path === '/programs/' ? ctx.programsVerifiedOn : site.CONTENT_UPDATED,
    }));
  await fs.writeFile(path.join(out, 'sitemap.xml'), sitemapXml(sitemapEntries));
  await fs.writeFile(path.join(out, 'robots.txt'), demo ? 'User-agent: *\nDisallow: /\n' : `User-agent: *\nAllow: /\n\nSitemap: ${site.BASE_URL}/sitemap.xml\n`);
  await fs.writeFile(path.join(out, 'llms.txt'), llmsTxt({ meta, counts, boardsOk, programs, disciplinePages }));
  await fs.writeFile(path.join(out, '_headers'), headersFile());

  return { pages: list.map((p) => p.path), disciplinePages, assets, jobs: jobs.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseArgs(process.argv.slice(2));
  build(args).then(
    (r) => {
      console.log(`Built ${r.pages.length} pages into ${args.outDir}/ (${r.jobs} roles; discipline pages: ${r.disciplinePages.join(', ') || 'none'}; js ${r.assets.jsBytes} B, css ${r.assets.cssBytes} B)${args.demo ? ' [DEMO: fictional data]' : ''}`);
    },
    (err) => {
      console.error(err.message || err);
      process.exit(1);
    },
  );
}
