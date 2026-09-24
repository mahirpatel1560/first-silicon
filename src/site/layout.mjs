// Shared page chrome: <head> (SEO + JSON-LD), header, footer, breadcrumbs.

import { escapeHtml, longDate } from '../lib/text.mjs';

export const NAV = [
  { href: '/', label: 'Roles' },
  { href: '/programs/', label: 'Programs' },
  { href: '/disciplines/', label: 'Disciplines' },
  { href: '/how-it-works/', label: 'How it works' },
  { href: '/newsletter/', label: 'Newsletter' },
];

export const LOGO_SVG =
  '<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">' +
  '<g fill="currentColor"><rect x="9" y="1" width="2.4" height="5" rx="1"/><rect x="14.8" y="1" width="2.4" height="5" rx="1"/><rect x="20.6" y="1" width="2.4" height="5" rx="1"/>' +
  '<rect x="9" y="26" width="2.4" height="5" rx="1"/><rect x="14.8" y="26" width="2.4" height="5" rx="1"/><rect x="20.6" y="26" width="2.4" height="5" rx="1"/>' +
  '<rect x="1" y="9" width="5" height="2.4" rx="1"/><rect x="1" y="14.8" width="5" height="2.4" rx="1"/><rect x="1" y="20.6" width="5" height="2.4" rx="1"/>' +
  '<rect x="26" y="9" width="5" height="2.4" rx="1"/><rect x="26" y="14.8" width="5" height="2.4" rx="1"/><rect x="26" y="20.6" width="5" height="2.4" rx="1"/></g>' +
  '<rect x="5.6" y="5.6" width="20.8" height="20.8" rx="3" fill="none" stroke="currentColor" stroke-width="2.2"/>' +
  '<circle cx="10.6" cy="10.6" r="1.9" fill="#c0612b"/>' +
  '<path d="M13.5 21.5h5v-7.5l-2.2 1.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
  '</svg>';

/** JSON-LD <script> with `<` escaped so the payload cannot close the tag. */
export function jsonLd(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

export function organizationLd(site) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${site.BASE_URL}/#org`,
    name: site.SITE_NAME,
    url: `${site.BASE_URL}/`,
    logo: `${site.BASE_URL}/icon-512.png`,
    founder: { '@type': 'Person', name: 'Mahir Patel' },
  };
}

export function breadcrumbLd(site, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: `${site.BASE_URL}${it.path}` })),
  };
}

export function breadcrumbsHtml(items) {
  return (
    '<nav class="breadcrumbs" aria-label="Breadcrumb"><ol>' +
    items
      .map((it, i) => (i === items.length - 1 ? `<li><span aria-current="page">${escapeHtml(it.name)}</span></li>` : `<li><a href="${it.path}">${escapeHtml(it.name)}</a></li>`))
      .join('') +
    '</ol></nav>'
  );
}

function head({ site, title, description, path, jsonld = [], assets, noindex = false, ogImage = '/og.png' }) {
  const url = `${site.BASE_URL}${path}`;
  return [
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}">`,
    `<link rel="canonical" href="${escapeHtml(url)}">`,
    noindex ? '<meta name="robots" content="noindex">' : '',
    '<meta name="color-scheme" content="light dark">',
    '<meta name="theme-color" content="#f8f7f3" media="(prefers-color-scheme: light)">',
    '<meta name="theme-color" content="#0f1113" media="(prefers-color-scheme: dark)">',
    `<meta property="og:site_name" content="${escapeHtml(site.SITE_NAME)}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:title" content="${escapeHtml(title)}">`,
    `<meta property="og:description" content="${escapeHtml(description)}">`,
    `<meta property="og:url" content="${escapeHtml(url)}">`,
    `<meta property="og:image" content="${site.BASE_URL}${ogImage}">`,
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${escapeHtml(site.SITE_NAME)}: every hardware internship, labeled by class year, discipline and citizenship">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escapeHtml(title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(description)}">`,
    `<meta name="twitter:image" content="${site.BASE_URL}${ogImage}">`,
    '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
    '<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">',
    '<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
    `<link rel="stylesheet" href="${assets.css}">`,
    `<script defer src="${assets.js}"></script>`,
    ...jsonld.map(jsonLd),
    `<script defer src="${site.PULSE_SRC}" data-site="${site.SITE_KEY}"></script>`,
  ]
    .filter(Boolean)
    .join('\n');
}

function header(path, demo) {
  const items = NAV.map((n) => {
    const current = n.href === '/' ? path === '/' : path.startsWith(n.href);
    return `<li${n.href === '/' ? ' class="nav-home"' : ''}><a href="${n.href}"${current ? ' aria-current="page"' : ''}>${n.label}</a></li>`;
  }).join('');
  return (
    '<a class="skip-link" href="#main">Skip to content</a>' +
    (demo
      ? '<aside class="demo-banner" aria-label="Preview notice"><div class="wrap"><strong>Preview build with fictional test data.</strong> Companies and roles on this preview are invented to test the site. They are not real job postings.</div></aside>'
      : '') +
    '<header class="site-header"><div class="wrap">' +
    `<a class="brand" href="/">${LOGO_SVG}<span>First Silicon</span><span class="tagline">Hardware internships · Updated daily</span></a>` +
    `<nav class="nav" aria-label="Main"><ul>${items}</ul></nav>` +
    '</div></header>'
  );
}

function footer({ site, meta }) {
  const last = meta && meta.last_run ? `Last data update: ${longDate(meta.last_run.slice(0, 10))}.` : 'The first automatic data update has not run yet.';
  return (
    '<footer class="site-footer"><div class="wrap cols">' +
    '<div>' +
    `<p><strong>First Silicon</strong> lists hardware, EE, embedded and semiconductor internships from employers' public job boards. ${last}</p>` +
    `<p class="small">${escapeHtml(site.FOUNDER_LINE)} Not affiliated with any listed employer. Labels are automatic; always check the employer's posting. Not career, legal or immigration advice.</p>` +
    '</div>' +
    '<div><p class="kicker">Explore</p><ul><li><a href="/">Open roles</a></li><li><a href="/programs/">Programs calendar</a></li><li><a href="/disciplines/">Disciplines</a></li><li><a href="/how-it-works/">How it works</a></li><li><a href="/newsletter/">Weekly email</a></li></ul></div>' +
    '<div><p class="kicker">Site</p><ul><li><a href="/about/">About</a></li><li><a href="/contact/">Contact</a></li><li><a href="/sponsor/">Sponsor</a></li><li><a href="/privacy/">Privacy</a></li><li><a href="/terms/">Terms</a></li></ul></div>' +
    '</div></footer>'
  );
}

/** Full HTML document. */
export function documentHtml({ site, meta, assets, demo, path, title, description, jsonld, body, noindex }) {
  return (
    '<!doctype html>\n<html lang="en">\n<head>\n' +
    head({ site, title, description, path, jsonld: [organizationLd(site), ...(jsonld || [])], assets, noindex }) +
    '\n</head>\n<body>\n' +
    header(path, demo) +
    `\n<main id="main" tabindex="-1">\n${body}\n</main>\n` +
    footer({ site, meta }) +
    '\n</body>\n</html>\n'
  );
}
