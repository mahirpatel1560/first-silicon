// Page bodies. Each page returns { path, title, description, body, jsonld, noindex? }.

import { escapeHtml, longDate, shortDate } from '../lib/text.mjs';
import { DISCIPLINES } from '../lib/disciplines.mjs';
import { DISCIPLINE_LABELS, FLAG_LABELS, CATEGORY_LABELS } from '../lib/labels.mjs';
import { sortPrograms, nextDeadline, upcomingDeadlines } from '../lib/programs.mjs';
import { rolesHtml } from './js/render.mjs';
import { facets, classYearOptionCounts } from './js/filters.mjs';
import { breadcrumbLd, breadcrumbsHtml } from './layout.mjs';
import { classYearWindows } from '../lib/classify.mjs';
import { heroSubhead, classYearGuidance, homeDescription } from '../lib/copy.mjs';

const h = escapeHtml;
const n = (x) => Number(x || 0).toLocaleString('en-US');

// ------------------------------------------------------------------ shared bits
function subscribeForm({ src, heading = true }) {
  return (
    `<form class="form" data-lead="subscribe" data-src="${h(src)}" data-success="You're on the list. Watch for the next weekly email." aria-labelledby="sub-h-${h(src)}">` +
    (heading ? `<h2 id="sub-h-${h(src)}">Get new roles every week</h2>` : `<h2 id="sub-h-${h(src)}" class="visually-hidden">Subscribe</h2>`) +
    '<p class="small">One email a week: new hardware internships grouped by discipline, class-year labels and program deadlines. Unsubscribe any time.</p>' +
    '<div class="form-row">' +
    `<div class="field"><label for="sub-email-${h(src)}">Email</label><input id="sub-email-${h(src)}" name="email" type="email" autocomplete="email" required inputmode="email"></div>` +
    `<div class="field"><label for="sub-year-${h(src)}">Your year (optional)</label><select id="sub-year-${h(src)}" name="class_year"><option value="">Prefer not to say</option><option>First year</option><option>Second year</option><option>Third year</option><option>Fourth year or later</option><option>Graduate student</option><option>Not a student</option></select></div>` +
    '</div>' +
    `<div class="hp" aria-hidden="true"><label for="sub-website-${h(src)}">Website</label><input id="sub-website-${h(src)}" name="website" type="text" tabindex="-1" autocomplete="off"></div>` +
    '<p><button class="btn" type="submit">Subscribe</button></p>' +
    '<p class="form-status" data-status role="status" aria-live="polite"></p>' +
    '<noscript><p class="small">This form needs JavaScript.</p></noscript>' +
    '</form>'
  );
}

function programCard(p, today) {
  const next = nextDeadline(p, today);
  const deadline = next
    ? `${next.deadline.approx ? 'About ' : ''}${longDate(next.deadline.date)}${next.deadline.approx ? ` (${h(next.deadline.note || 'approximate')})` : ''} · ${h(next.deadline.term || '')}`
    : 'No fixed date';
  return (
    `<article class="card program" id="${h(p.id)}">` +
    `<p class="deadline">${deadline}</p>` +
    `<h3><a href="${h(p.url)}" target="_blank" rel="noopener" data-pulse="program_out">${h(p.name)}</a></h3>` +
    `<p class="small">${h(p.org)}</p>` +
    '<dl>' +
    `<dt>Deadlines</dt><dd>${h(p.deadline_text)}</dd>` +
    `<dt>Who can apply</dt><dd>${h(p.eligibility)}</dd>` +
    `<dt>Class year</dt><dd>${h(p.class_year_note || 'Not stated.')}</dd>` +
    `<dt>Format</dt><dd>${h(p.format || '')}</dd>` +
    `<dt>Pay</dt><dd>${h(p.pay || 'Not stated.')}</dd>` +
    ((p.flags || []).length ? `<dt>Restrictions</dt><dd>${h(p.flags.map((f) => FLAG_LABELS[f]).join(', '))}</dd>` : '') +
    `<dt>Checked</dt><dd>Verified on the official page on ${longDate(p.verified_on)}${p.apply_url ? `. <a href="${h(p.apply_url)}" target="_blank" rel="noopener">Application portal</a>` : ''}.</dd>` +
    '</dl></article>'
  );
}

function finderForm(jobs) {
  const f = facets(jobs);
  const discOptions = DISCIPLINES.map((d) => `<option value="${d.slug}" data-label="${h(d.short)}">${h(d.short)} (${f.disciplines[d.slug] || 0})</option>`).join('') +
    `<option value="general" data-label="General EE">General EE (${f.disciplines.general || 0})</option>`;
  const termOptions = f.terms.map((t) => `<option value="${h(t.term)}">${h(t.term)} (${t.count})</option>`).join('');
  // Default view is every role ("All class years"); the Fr/So option narrows to postings that say so explicitly.
  const cyCounts = classYearOptionCounts(f);
  const cyOptions = [['fs', 'Fr/So friendly'], ['open', 'Fr/So friendly or not stated'], ['jplus', 'Juniors+ only']]
    .map(([value, label]) => `<option value="${value}" data-label="${h(label)}">${h(label)} (${cyCounts[value]})</option>`)
    .join('');
  // Guidance next to the class-year filter; app.mjs re-renders it with classYearGuidance() if it loads a newer list.
  const guide = classYearGuidance({ roles: jobs.length, fs: f.classYears.fs, unspecified: f.classYears.unspecified });
  return (
    '<form id="filters" class="filters" role="search" aria-label="Filter roles">' +
    '<div class="field search"><label for="f-q">Search</label><input id="f-q" name="q" type="search" placeholder="Company, role, city, or skill" autocomplete="off" enterkeyhint="search"></div>' +
    `<div class="field"><label for="f-d">Discipline</label><select id="f-d" name="d"><option value="">All disciplines</option>${discOptions}</select></div>` +
    `<div class="field"><label for="f-cy">Class year</label><select id="f-cy" name="cy" aria-describedby="cy-guide"><option value="">All class years</option>${cyOptions}</select></div>` +
    `<p id="cy-guide" class="cy-guide"${guide ? '' : ' hidden'}>${h(guide)}</p>` +
    `<div class="field"><label for="f-t">Term</label><select id="f-t" name="t"><option value="">Any term</option>${termOptions}<option value="coop">Co-ops only (${f.coop})</option><option value="none">Term not stated (${f.noterm})</option></select></div>` +
    '<div class="field"><label for="f-loc">Location</label><select id="f-loc" name="loc"><option value="">Anywhere</option><option value="remote">Remote</option><option value="us">United States</option><option value="ca">Canada</option><option value="intl">Outside US and Canada</option></select></div>' +
    '<div class="checks">' +
    '<label class="check"><input type="checkbox" name="cf" value="1"> No citizenship or export flags</label>' +
    '<label class="check"><input type="checkbox" name="new" value="1"> New this week</label>' +
    '<button type="button" class="linklike" data-reset>Reset filters</button>' +
    '</div>' +
    '</form>'
  );
}

// ------------------------------------------------------------------ home
export function homePage(ctx) {
  const { site, jobs, counts, meta, programs, today } = ctx;
  const ssr = jobs.slice(0, site.SSR_ROWS);
  const upcoming = upcomingDeadlines(programs, today, { withinDays: 200 }).slice(0, 3);
  const pending = !meta || !meta.last_run;
  const win = classYearWindows(new Date(`${today}T12:00:00Z`));
  const lede = pending
    ? 'Internships and co-ops from hardware companies\' job boards, tagged by class year, discipline and citizenship. The first automatic update has not run yet, so the list below is empty for now; the programs calendar is ready.'
    : heroSubhead(counts);
  const fsAnswer = pending
    ? `Some postings say so directly: they mention first-year or sophomore students, rising juniors, all class years, or graduation in ${win.fs[0]} or ${win.fs[1]}. Those get the Fr/So friendly label. Many more postings never state a class year. "Class year not stated" means exactly that, so read the requirements and apply if you meet them.`
    : `Some postings say so directly. In the ${longDate(today)} update, ${n(counts.fs)} of ${n(counts.roles)} did: they mention first-year or sophomore students, rising juniors, all class years, or graduation in ${win.fs[0]} or ${win.fs[1]}, and get the Fr/So friendly label. ${n(counts.unspecified)} ${counts.unspecified === 1 ? 'does' : 'do'} not state a class year at all. "Class year not stated" means exactly that: apply unless the posting asks for junior or senior standing or a graduation date you can't meet.`;
  const faq = [
    ['What is First Silicon?', `A free, filterable list of every hardware, electrical, embedded and semiconductor internship and co-op on the public job boards (Greenhouse, Lever and Ashby) of ${n(ctx.boardsOk)} hardware-heavy employers. Once a day it reads those boards, keeps the internship and co-op postings that look like hardware work, and labels each one by discipline, class year and citizenship.`],
    ['Can freshmen and sophomores get hardware internships?', fsAnswer],
    ['How are the class-year labels decided?', `From the posting text. Fr/So friendly: it mentions first-year, freshman, sophomore, second-year, rising sophomore or junior, all class years, or a ${win.fs[0]} to ${win.fs[1]} graduation date. Juniors+: it asks for junior or senior standing, graduation by ${win.jplus[0]} or ${win.jplus[1]}, or a graduate degree. Anything else is "not stated". The label can be wrong, so each role has a "Why these labels?" excerpt.`],
    ['What does "No citizenship or export flags" hide?', 'Roles whose posting mentions U.S. citizenship, U.S. person or permanent-resident status, ITAR or export control, or a security clearance. No flag does not prove there is no restriction; some employers only mention it in the application.'],
    ['How often is the list updated?', 'Once a day by an automated job. Roles that disappear from an employer\'s board are removed on the next run. "New this week" means First Silicon first saw the role in the last 7 days and, when the employer lists a publish date, it was posted within the last 14 days.'],
    ['Which employers are included, and which are missing?', 'Employers whose public job boards run on Greenhouse, Lever or Ashby. Employers on other hiring systems, such as Workday or iCIMS, are not included yet. The full list is on the How it works page.'],
  ];
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Open hardware internships and co-ops',
    numberOfItems: jobs.length,
    itemListOrder: 'https://schema.org/ItemListOrderDescending',
    itemListElement: jobs.slice(0, site.ITEMLIST_MAX).map((j, i) => ({ '@type': 'ListItem', position: i + 1, url: j.url, name: `${j.title} at ${j.company}` })),
  };
  const jsonld = [
    { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${site.BASE_URL}/#website`, name: site.SITE_NAME, url: `${site.BASE_URL}/`, description: site.DESCRIPTION, potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${site.BASE_URL}/?q={search_term_string}` }, 'query-input': 'required name=search_term_string' } },
    { '@context': 'https://schema.org', '@type': 'WebApplication', name: site.SITE_NAME, url: `${site.BASE_URL}/`, applicationCategory: 'EducationalApplication', operatingSystem: 'Any (web browser)', description: site.DESCRIPTION, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } },
    itemList,
    { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  ];
  const body =
    '<div class="wrap">' +
    '<section class="hero" aria-labelledby="hero-h">' +
    '<p class="eyebrow">Hardware · EE · Embedded · Semiconductors</p>' +
    `<h1 id="hero-h">${h(site.TAGLINE)}</h1>` +
    `<p class="lede" data-hero-lede>${h(lede)}</p>` +
    (pending ? '' : '<ul class="stats">') +
    (pending ? '' : `<li><span class="num" data-stat="roles">${n(counts.roles)}</span><span class="lab">open roles</span></li>`) +
    (pending
      ? ''
      : `<li><span class="num" data-stat="companies">${n(counts.companies)}</span><span class="lab">companies with open roles</span></li>` +
        `<li><span class="num" data-stat="new_this_week">${n(counts.new_this_week)}</span><span class="lab">new this week</span></li>` +
        `<li><span class="num" data-stat="citizenship_free">${n(counts.citizenship_free)}</span><span class="lab">no citizenship or export flags</span></li>` +
        '</ul>') +
    `<p class="updated small">${pending ? 'Waiting for the first daily update.' : `Last update: <time data-stat="updated" datetime="${h(meta.last_run.slice(0, 10))}">${longDate(meta.last_run.slice(0, 10))}</time>.`}</p>` +
    '</section>' +
    `<section id="finder" class="finder" aria-labelledby="finder-h" data-raw-base="${h(site.REPO_RAW_BASE)}" data-last-run="${h(meta && meta.last_run ? meta.last_run : '')}" data-new-days="${site.NEW_DAYS}">` +
    '<h2 id="finder-h" class="visually-hidden">Find roles</h2>' +
    finderForm(jobs) +
    '<div class="result-bar">' +
    `<p id="result-count" class="result-count" role="status" aria-live="polite">${pending ? 'No roles yet' : `Showing the ${Math.min(site.SSR_ROWS, jobs.length)} newest of ${n(jobs.length)} roles`}</p>` +
    '<p id="data-notice" class="notice" hidden></p>' +
    '</div>' +
    `<ol id="roles" class="roles">${ssr.length ? rolesHtml(ssr, { today, newDays: site.NEW_DAYS }) : '<li class="empty">No roles yet: the first automatic update has not run. The <a href="/programs/">programs calendar</a> is ready now, and you can <a href="/newsletter/">get the weekly email</a>.</li>'}</ol>` +
    `<p class="more-wrap"><button id="more" class="btn btn-ghost" type="button"${jobs.length > site.SSR_ROWS ? '' : ' hidden'}>Show 50 more</button></p>` +
    `<noscript><p class="notice">Filters need JavaScript. Showing the ${site.SSR_ROWS} newest roles; the full list is in <a href="/data/jobs.json">data/jobs.json</a>.</p></noscript>` +
    '</section>' +
    '<section class="section" aria-labelledby="labels-h"><h2 id="labels-h">How to read the labels</h2><div class="grid-3">' +
    `<div class="card"><h3>Class year</h3><p><span class="tag cy-fs">Fr/So friendly</span> the posting mentions first- or second-year students, rising juniors, all class years, or a ${win.fs[0]} to ${win.fs[1]} graduation date.`+' <span class="tag cy-jp">Juniors+</span> it asks for junior or senior standing, an earlier graduation, or a graduate degree. <span class="tag cy-na">Class year not stated</span> it does not say.</p></div>' +
    '<div class="card"><h3>Flags</h3><p><span class="tag t-flag">US citizen</span> <span class="tag t-flag">US person / PR</span> <span class="tag t-flag">ITAR / export</span> <span class="tag t-flag">Clearance</span> <span class="tag t-flag">No visa sponsorship</span> come from the posting text. Equal-opportunity boilerplate that merely mentions citizenship status is ignored.</p></div>' +
    '<div class="card"><h3>Dates and links</h3><p>Dates are the employer\'s publish date when the job board provides one, otherwise the day First Silicon first saw the role. Every title links to the original posting; apply there.</p></div>' +
    '</div></section>' +
    '<section class="section" aria-labelledby="prog-h"><h2 id="prog-h">Programs open before junior year</h2>' +
    '<p>Government and national-lab programs whose official pages list no junior-standing requirement, checked on those pages.</p>' +
    (upcoming.length
      ? `<ul>${upcoming.map((u) => `<li><strong>${longDate(u.deadline.date)}</strong>${u.deadline.approx ? ' (approximate)' : ''}: <a href="/programs/#${h(u.program.id)}">${h(u.program.name)}</a>, ${h(u.deadline.term || '')}</li>`).join('')}</ul>`
      : '') +
    '<p><a href="/programs/">See the full programs calendar</a></p></section>' +
    '<section class="section faq" aria-labelledby="faq-h"><h2 id="faq-h">Questions</h2>' +
    faq.map(([q, a]) => `<details><summary>${h(q)}</summary><p>${h(a)}</p></details>`).join('') +
    '</section>' +
    `<section class="section" aria-label="Newsletter">${subscribeForm({ src: 'home' })}</section>` +
    '</div>';
  return {
    path: '/',
    title: 'First Silicon: every hardware internship, labeled',
    description: homeDescription(pending ? {} : counts),
    jsonld,
    body,
  };
}

// ------------------------------------------------------------------ programs
export function programsPage(ctx) {
  const { site, programs, today } = ctx;
  const sorted = sortPrograms(programs, today);
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Programs', path: '/programs/' }];
  const body =
    '<div class="wrap">' +
    breadcrumbsHtml(crumbs) +
    '<div class="page-head prose"><h1>Early-career programs for first- and second-year EE students</h1>' +
    `<p class="lede">Government and national-lab internships and research programs whose official pages list no junior-standing requirement. Each entry was checked on its official page on ${longDate(ctx.programsVerifiedOn)}; details change, so confirm dates on the official page before you apply.</p>` +
    '<p class="small">Programs are sorted by their next dated deadline. Programs we could not verify (the official page did not load, or did not state eligibility and timing) are left out on purpose. Know one that belongs here? <a href="/contact/">Suggest it</a>.</p></div>' +
    '<h2 class="visually-hidden">Programs by next deadline</h2>' +
    `<div class="program-list">${sorted.map((p) => programCard(p, today)).join('')}</div>` +
    '<section class="section prose" aria-labelledby="tips-h"><h2 id="tips-h">Making these work in your first two years</h2>' +
    '<ul>' +
    '<li>Read eligibility first: several programs require U.S. citizenship or permanent residency, and some set GPA or age minimums.</li>' +
    '<li>For research programs such as NSF REU sites and NIST SURF, a short note about a project you built (a board, a driver, a measurement) usually says more than a list of courses.</li>' +
    '<li>National labs post many student roles on their own career sites; filter by "student" or "intern" and check back from September onward.</li>' +
    '</ul></section>' +
    '</div>';
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Early-career programs for first- and second-year EE students',
    itemListElement: sorted.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: p.url, name: `${p.name} (${p.org})` })),
  };
  return {
    path: '/programs/',
    title: 'Early-career EE programs calendar | First Silicon',
    description: 'DOE SULI, NASA, NIST SURF, NSF REU and national-lab programs open before junior year, with deadlines checked on official pages.',
    jsonld: [breadcrumbLd(site, crumbs), itemList],
    body,
  };
}

// ------------------------------------------------------------------ disciplines
export function disciplinesIndexPage(ctx) {
  const { site, counts, disciplinePages } = ctx;
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Disciplines', path: '/disciplines/' }];
  const cards = DISCIPLINES.map((d) => {
    const c = counts.by_discipline[d.slug] || 0;
    const has = disciplinePages.includes(d.slug);
    return (
      `<article class="card"><h2 class="h3">${has ? `<a href="/disciplines/${d.slug}/">${h(d.label)}</a>` : h(d.label)}</h2>` +
      `<p>${h(d.intro.split('. ')[0])}.</p>` +
      `<p class="small">${n(c)} open role${c === 1 ? '' : 's'}. ${has ? `<a href="/disciplines/${d.slug}/">Guide and roles</a>` : `The guide page appears when ${site.MIN_ROLES_FOR_DISCIPLINE_PAGE} or more roles are open.`} <a href="/?d=${d.slug}">Filter the list</a></p></article>`
    );
  }).join('');
  const body =
    '<div class="wrap">' +
    breadcrumbsHtml(crumbs) +
    '<div class="page-head prose"><h1>Hardware internship disciplines</h1>' +
    '<p class="lede">First Silicon tags every role with one or more of ten hardware disciplines, based on the title and the posting text. Each guide explains what the work is, what interns do, which skills to show and projects you can build before you apply.</p></div>' +
    `<div class="grid-3">${cards}</div>` +
    '<p class="small">Roles that are clearly hardware but fit no single discipline (for example "Electrical Engineering Intern") are tagged General EE.</p>' +
    '</div>';
  return {
    path: '/disciplines/',
    title: 'Hardware internship disciplines explained | First Silicon',
    description: 'Embedded, FPGA/ASIC, analog, RF, power, PCB, test, controls, semiconductor process and photonics internships: what the work is and how to prepare.',
    jsonld: [breadcrumbLd(site, crumbs)],
    body,
  };
}

export function disciplinePage(ctx, d) {
  const { site, jobs, today } = ctx;
  const roles = jobs.filter((j) => (j.disciplines || []).includes(d.slug));
  const fs = roles.filter((j) => j.class_year === 'fs').length;
  const unstated = roles.filter((j) => j.class_year !== 'fs' && j.class_year !== 'jplus').length;
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Disciplines', path: '/disciplines/' }, { name: d.label, path: `/disciplines/${d.slug}/` }];
  const others = DISCIPLINES.filter((x) => x.slug !== d.slug && ctx.disciplinePages.includes(x.slug));
  const body =
    '<div class="wrap">' +
    breadcrumbsHtml(crumbs) +
    `<div class="page-head prose"><p class="kicker">Discipline guide</p><h1>${h(d.label)} internships</h1>` +
    `<p class="lede">${h(d.intro)}</p>` +
    `<p class="small">${n(roles.length)} open role${roles.length === 1 ? '' : 's'} right now: ${fs ? n(fs) : 'none'} ${fs === 1 ? 'says' : 'say'} freshmen or sophomores can apply, ${n(unstated)} ${unstated === 1 ? "doesn't" : "don't"} list a class year. <a href="/?d=${d.slug}">Filter this discipline in the full list</a>.</p></div>` +
    '<div class="grid-3">' +
    `<section class="card" aria-labelledby="work-h"><h2 id="work-h" class="h3">What interns do</h2><ul>${d.work.map((w) => `<li>${h(w)}</li>`).join('')}</ul></section>` +
    `<section class="card" aria-labelledby="skills-h"><h2 id="skills-h" class="h3">Skills to show</h2><ul>${d.skills.map((w) => `<li>${h(w)}</li>`).join('')}</ul></section>` +
    `<section class="card" aria-labelledby="proj-h"><h2 id="proj-h" class="h3">Starter projects</h2><ol>${d.projects.map((w) => `<li>${h(w)}</li>`).join('')}</ol></section>` +
    '</div>' +
    `<section class="section" aria-labelledby="roles-h"><h2 id="roles-h">Open ${h(d.short)} roles</h2>` +
    `<p class="small">Newest first. Labels are automatic; read each posting on the employer's site.</p>` +
    `<ol class="roles">${rolesHtml(roles, { today, newDays: site.NEW_DAYS })}</ol></section>` +
    (others.length ? `<section class="section"><h2>Other disciplines</h2><p>${others.map((o) => `<a href="/disciplines/${o.slug}/">${h(o.label)}</a>`).join(' · ')}</p></section>` : '') +
    '</div>';
  const title = `${d.short} internships | First Silicon`;
  return {
    path: `/disciplines/${d.slug}/`,
    title: title.length <= 60 ? title : `${d.short} internships`,
    description: `${d.label} internships from hardware employers, what interns do, skills to show and starter projects. ${roles.length} open roles.`.slice(0, 155),
    jsonld: [
      breadcrumbLd(site, crumbs),
      { '@context': 'https://schema.org', '@type': 'ItemList', name: `Open ${d.label} internships`, numberOfItems: roles.length, itemListElement: roles.slice(0, site.ITEMLIST_MAX).map((j, i) => ({ '@type': 'ListItem', position: i + 1, url: j.url, name: `${j.title} at ${j.company}` })) },
    ],
    body,
  };
}

// ------------------------------------------------------------------ how it works
export function howItWorksPage(ctx) {
  const { site, companies, meta, accuracy, today } = ctx;
  const win = classYearWindows(new Date(`${today}T12:00:00Z`));
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'How it works', path: '/how-it-works/' }];
  const covered = companies.filter((c) => c.status === 'ok' || c.status === 'empty').sort((a, b) => a.name.localeCompare(b.name));
  const notCovered = companies.filter((c) => c.status === 'not_found' || c.status === 'unsupported_ats').sort((a, b) => a.name.localeCompare(b.name));
  const atsName = { greenhouse: 'Greenhouse', lever: 'Lever', ashby: 'Ashby' };
  const rows = covered
    .map((c) => `<tr><td>${h(c.name)}</td><td>${h(CATEGORY_LABELS[c.category] || c.category)}</td><td>${h(atsName[c.ats] || c.ats)}</td></tr>`)
    .join('');
  const lastRun = meta && meta.last_run ? `The last run finished on ${longDate(meta.last_run.slice(0, 10))}: ${n(meta.boards.ok)} of ${n(meta.boards.attempted)} boards answered and ${n(meta.postings_seen)} postings were read.` : 'The first automatic run has not happened yet.';
  const body =
    '<div class="wrap">' +
    breadcrumbsHtml(crumbs) +
    '<div class="page-head prose"><h1>How First Silicon finds and labels roles</h1>' +
    '<p class="lede">Short version: once a day a script reads employers\' public job-board APIs, keeps internship and co-op postings that look like hardware work, labels them, and links you to the original posting. Always verify on the employer\'s page before applying.</p></div>' +
    '<div class="prose">' +
    '<h2>Sources</h2>' +
    '<p>First Silicon only reads job boards that employers publish for anyone to see:</p><ul>' +
    '<li><a href="https://developers.greenhouse.io/job-board.html">Greenhouse Job Board API</a>: Greenhouse documents that job board data is public and that its GET endpoints need no authentication.</li>' +
    '<li><a href="https://github.com/lever/postings-api">Lever Postings API</a>: published postings are publicly viewable.</li>' +
    '<li><a href="https://developers.ashbyhq.com/docs/public-job-posting-api">Ashby public job posting API</a>.</li>' +
    '</ul>' +
    `<p>The fetcher identifies itself with the User-Agent <code>${h(site.USER_AGENT)}</code>, requests one board at a time with a pause between requests, uses timeouts, retries politely with backoff (and honors Retry-After), and never logs in or submits anything.</p>` +
    '<h2>Update cadence</h2>' +
    `<p>A scheduled job runs once a day (around 6 a.m. U.S. Central). ${h(lastRun)} Roles that disappear from an employer's board are removed on the next run. If a board fails to answer, its roles are kept for up to 7 days and marked "board unreachable today" rather than dropped.</p>` +
    '<h2>What is stored</h2>' +
    '<p>For each role: title, employer, locations, workplace type, dates, the link to the original posting, the labels, and at most a 300-character excerpt of the sentences that explain the labels. Full job descriptions are read only in memory to compute labels; they are not stored or republished.</p>' +
    '<h2>How labels are computed</h2>' +
    '<ul>' +
    '<li><strong>Internship or co-op:</strong> the title says intern, internship, co-op or student (a German "Werkstudent" counts), or the job board marks the role as an internship. Titles like "Internal tools" or "International trade" are excluded, as are recruiter roles that merely mention interns.</li>' +
    '<li><strong>Hardware relevance:</strong> a 0 to 100 score from hardware terms in the title and description. Pure software, data, marketing and finance roles are excluded unless the title is embedded, firmware, robotics or similar hardware-facing work.</li>' +
    '<li><strong>Discipline tags:</strong> ten hardware disciplines, matched from the title first and the description second. See <a href="/disciplines/">the discipline guides</a>.</li>' +
    `<li><strong>Class year:</strong> Fr/So friendly when the text mentions first-year, freshman, sophomore, second-year, rising sophomore or junior, all class years, a ${win.fs[0]} to ${win.fs[1]} graduation date, or an early-insight style program. Juniors+ when it requires junior or senior standing, graduation by ${win.jplus[0]} to ${win.jplus[1]}, or a graduate degree. Negations such as "freshmen are not eligible" count as Juniors+. These years move forward each July.</li>` +
    '<li><strong>Flags:</strong> U.S. citizenship, U.S. person or permanent residency, ITAR or export control, security clearance, and "no visa sponsorship", detected sentence by sentence while ignoring equal-opportunity boilerplate.</li>' +
    '<li><strong>Duplicates:</strong> the same title at the same employer is merged into one row with all its locations, even when it appears on two boards.</li>' +
    '</ul>' +
    '<h2>Limits</h2>' +
    `<p>Labels come from pattern matching, not a person reading every posting. ${accuracy ? h(accuracy) + ' ' : ''}Real postings are messier than test cases, so treat labels as hints. Employers on other hiring systems (Workday, iCIMS and others) are not included yet, and postings that hide requirements in an attachment or application form cannot be labeled.</p>` +
    '<p><strong>Always verify on the employer\'s page.</strong> If a label is wrong or you want a posting or company removed, <a href="/contact/">tell us</a>.</p>' +
    `<h2>Employers checked (${n(covered.length)})</h2>` +
    `<p>These employers had a public Greenhouse, Lever or Ashby board when their boards were last checked. ${n(notCovered.length)} more hardware employers are on the watch list but use a hiring system First Silicon does not read, or no public board was found.</p>` +
    '</div>' +
    `<div class="table-wrap"><table><caption class="visually-hidden">Employers whose public job boards are read daily</caption><thead><tr><th scope="col">Employer</th><th scope="col">Sector</th><th scope="col">Job board</th></tr></thead><tbody>${rows}</tbody></table></div>` +
    '</div>';
  return {
    path: '/how-it-works/',
    title: 'How First Silicon finds and labels roles',
    description: 'Sources (public Greenhouse, Lever and Ashby job boards), daily updates, how class-year and citizenship labels work, and their limits.',
    jsonld: [breadcrumbLd(site, crumbs)],
    body,
  };
}

// ------------------------------------------------------------------ newsletter
export function newsletterPage(ctx) {
  const { site } = ctx;
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Newsletter', path: '/newsletter/' }];
  const body =
    '<div class="wrap">' +
    breadcrumbsHtml(crumbs) +
    '<div class="page-head prose"><h1>The weekly hardware internship email</h1>' +
    '<p class="lede">One email a week with the hardware internships and co-ops First Silicon found in the last seven days, grouped by discipline, with the class-year and citizenship labels, plus program deadlines coming up in the next 60 days.</p></div>' +
    '<div class="grid-3">' +
    '<div class="card"><h2 class="h3">What is in it</h2><ul><li>New roles by discipline, Fr/So friendly ones first</li><li>Upcoming program deadlines</li><li>A link to the filtered list</li></ul></div>' +
    '<div class="card"><h2 class="h3">What is not</h2><ul><li>No full job descriptions (you apply on the employer\'s site)</li><li>No selling or sharing your email</li><li>Sponsored items, if they ever appear, are labeled as sponsored</li></ul></div>' +
    '<div class="card"><h2 class="h3">Your data</h2><p>Your email goes to First Silicon\'s form endpoint and is used only to send this email. Unsubscribe from any issue. Details on the <a href="/privacy/">privacy page</a>.</p></div>' +
    '</div>' +
    `<section class="section">${subscribeForm({ src: 'newsletter' })}</section>` +
    '</div>';
  return {
    path: '/newsletter/',
    title: 'Weekly hardware internship email | First Silicon',
    description: 'A weekly email of new hardware, EE and embedded internships grouped by discipline, with class-year labels and program deadlines.',
    jsonld: [breadcrumbLd(site, crumbs)],
    body,
  };
}

// ------------------------------------------------------------------ about
export function aboutPage(ctx) {
  const { site, counts, meta } = ctx;
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'About', path: '/about/' }];
  const hasData = Boolean(meta && meta.last_run && counts && counts.roles);
  const classYearFacts = hasData
    ? `<p>In the ${longDate(meta.last_run.slice(0, 10))} update, ${n(counts.fs)} of ${n(counts.roles)} roles said freshmen or sophomores can apply, ${n(counts.jplus)} asked for junior standing or later, and ${n(counts.unspecified)} did not state a class year at all. That is why First Silicon lists every role with its label instead of only the ones that mention first- and second-year students.</p>`
    : '';
  const body =
    '<div class="wrap">' +
    breadcrumbsHtml(crumbs) +
    '<div class="page-head prose"><h1>About First Silicon</h1>' +
    `<p class="lede">${h(site.FOUNDER_LINE)}</p></div>` +
    '<div class="prose">' +
    '<h2>Why it exists</h2>' +
    '<p>Hardware internships are harder to find than software ones, and it is often unclear whether a first- or second-year student can apply. On September 23, 2026 the widely used <a href="https://github.com/SimplifyJobs/Summer2027-Internships">Summer 2027 tech internships list on GitHub</a> (47.6k stars) showed 275 hardware engineering internships next to 681 software engineering ones in its <a href="https://raw.githubusercontent.com/SimplifyJobs/Summer2027-Internships/dev/README.md">category counts</a>, with no class-year column and no hardware sub-discipline tags. That list is great for what it does; First Silicon lists every hardware internship and co-op on the job boards it reads and labels each one.</p>' +
    classYearFacts +
    '<h2>What it does differently</h2>' +
    '<ul><li>Hardware only, tagged by discipline: embedded, FPGA/ASIC, analog, RF, power, PCB, test, controls, semiconductor process and photonics.</li>' +
    '<li>A class-year label on every role: Fr/So friendly when the posting says first- or second-year students can apply, Juniors+ when it asks for junior standing or later, and "not stated" for the rest.</li>' +
    '<li>Citizenship, ITAR/export and clearance flags up front.</li>' +
    '<li>A calendar of government and national-lab programs open before junior year.</li></ul>' +
    '<h2>What it is not</h2>' +
    '<p>First Silicon is not a job board and does not host postings; every role links to the employer\'s own page. It is not affiliated with any listed employer, and nothing here is career, legal or immigration advice.</p>' +
    '<p>Questions or corrections: <a href="/contact/">contact</a>.</p>' +
    '</div></div>';
  return {
    path: '/about/',
    title: 'About First Silicon',
    description: 'Why First Silicon exists and what it does: hardware-only internship listings with discipline, class-year and citizenship labels.',
    jsonld: [breadcrumbLd(site, crumbs)],
    body,
  };
}

// ------------------------------------------------------------------ privacy
export function privacyPage(ctx) {
  const { site } = ctx;
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Privacy', path: '/privacy/' }];
  const raw = site.REPO_RAW_BASE
    ? '<li><strong>Latest list download:</strong> the role finder downloads the newest list from GitHub (raw.githubusercontent.com), which receives your request like any website does.</li>'
    : '';
  const body =
    '<div class="wrap">' +
    breadcrumbsHtml(crumbs) +
    '<div class="page-head prose"><h1>Privacy</h1><p class="lede">No cookies, no ads, no third-party trackers. Here is exactly what is collected.</p></div>' +
    '<div class="prose">' +
    '<h2>Analytics: Portfolio Pulse</h2>' +
    `<p>This site uses Portfolio Pulse, a small first-party analytics script loaded from <code>${h(site.PULSE_ORIGIN)}</code>.</p><ul>` +
    '<li>It is cookieless.</li>' +
    '<li>It stores a random ID in your browser\'s localStorage so repeat visits can be counted. That ID is not set when Global Privacy Control or Do Not Track is on, and it is dropped on the server for visitors from the EU/EEA, the UK and Switzerland.</li>' +
    '<li>It also keeps a random per-tab session ID in sessionStorage, which the browser clears when the tab closes.</li>' +
    '<li>No IP addresses are stored.</li>' +
    '<li>For each page view it records the country, the device class, the hostname of the site that linked you here, the page path, and any campaign tag in the link you followed (utm or ref parameters).</li>' +
    '<li>It records events such as clicks on role links, which filters were used (not what you type in the search box) and whether a form was sent.</li>' +
    '</ul>' +
    '<p>The site itself stores one flag in sessionStorage so the "first use" event is sent at most once per visit.</p>' +
    '<h2>Forms</h2>' +
    '<p>When you send the newsletter, contact or sponsor form, what you type (for example your email and message) is sent to the Portfolio Pulse form endpoint and stored so it can be answered or used to send the newsletter. It is not sold or shared. To have it deleted, use the <a href="/contact/">contact form</a>.</p>' +
    '<h2>Other services</h2><ul>' +
    '<li><strong>Hosting:</strong> Cloudflare Pages serves this site and may process request data, such as IP addresses, to deliver and protect it.</li>' +
    raw +
    '<li><strong>Employer links:</strong> role links go to employers\' own job pages, where their privacy policies apply.</li>' +
    '</ul>' +
    `<p class="small">Last reviewed ${longDate(site.CONTENT_UPDATED)}.</p>` +
    '</div></div>';
  return {
    path: '/privacy/',
    title: 'Privacy | First Silicon',
    description: 'Cookieless analytics, no IP addresses stored, no third-party trackers. Exactly what First Silicon collects and why.',
    jsonld: [breadcrumbLd(site, crumbs)],
    body,
  };
}

// ------------------------------------------------------------------ terms
export function termsPage(ctx) {
  const { site } = ctx;
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Terms', path: '/terms/' }];
  const body =
    '<div class="wrap">' +
    breadcrumbsHtml(crumbs) +
    '<div class="page-head prose"><h1>Terms of use</h1></div>' +
    '<div class="prose">' +
    '<p>First Silicon is a free informational site. By using it you agree to these terms.</p>' +
    '<h2>Listings</h2><p>Roles come from employers\' public job boards and are labeled automatically. Listings can be out of date, incomplete or mislabeled. First Silicon does not host postings, is not affiliated with any listed employer, and does not take part in hiring. Always confirm details, eligibility and deadlines on the employer\'s or program\'s official page.</p>' +
    '<h2>No advice</h2><p>Nothing on this site is career, legal, immigration or export-control advice. Citizenship, export-control and clearance flags are text matches, not determinations of your eligibility.</p>' +
    '<h2>Names and trademarks</h2><p>Company and program names belong to their owners and are used only to identify the listed roles and programs.</p>' +
    '<h2>Acceptable use</h2><p>Please do not overload the site or use it to send spam through its forms. The underlying list is published as open data for personal and research use.</p>' +
    '<h2>No warranty</h2><p>The site is provided as is, without warranties of any kind, and First Silicon is not liable for decisions made using it.</p>' +
    '<h2>Changes and contact</h2><p>These terms may change; the date below shows the last update. Questions: <a href="/contact/">contact</a>.</p>' +
    `<p class="small">Last updated ${longDate(site.CONTENT_UPDATED)}.</p>` +
    '</div></div>';
  return {
    path: '/terms/',
    title: 'Terms of use | First Silicon',
    description: 'Terms of use for First Silicon: informational listings from public job boards, no affiliation with employers, and no career or legal advice.',
    jsonld: [breadcrumbLd(site, crumbs)],
    body,
  };
}

// ------------------------------------------------------------------ contact
export function contactPage(ctx) {
  const { site } = ctx;
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Contact', path: '/contact/' }];
  const body =
    '<div class="wrap">' +
    breadcrumbsHtml(crumbs) +
    '<div class="page-head prose"><h1>Contact</h1><p class="lede">Report a wrong label, suggest an employer or program, ask for a posting to be removed, or just say hello.</p></div>' +
    '<form class="form" data-lead="contact" data-success="Thanks, your message was sent." aria-label="Contact form">' +
    '<div class="form-row">' +
    '<div class="field"><label for="c-name">Name (optional)</label><input id="c-name" name="name" type="text" autocomplete="name"></div>' +
    '<div class="field"><label for="c-email">Email</label><input id="c-email" name="email" type="email" autocomplete="email" required></div>' +
    '</div>' +
    '<div class="field"><label for="c-topic">Topic</label><select id="c-topic" name="topic"><option value="label">A label is wrong</option><option value="employer">Suggest an employer or program</option><option value="removal">Remove a posting or company</option><option value="other" selected>Something else</option></select></div>' +
    '<div class="field"><label for="c-message">Message</label><textarea id="c-message" name="message" required maxlength="2000"></textarea></div>' +
    '<div class="hp" aria-hidden="true"><label for="c-website">Website</label><input id="c-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>' +
    '<p><button class="btn" type="submit">Send message</button></p>' +
    '<p class="form-status" data-status role="status" aria-live="polite"></p>' +
    '<noscript><p class="small">This form needs JavaScript.</p></noscript>' +
    '</form>' +
    '<p class="small">For a wrong label, include the role link so it can be checked.</p>' +
    '</div>';
  return {
    path: '/contact/',
    title: 'Contact | First Silicon',
    description: 'Report a wrong label, suggest an employer or early-career program, or ask for a posting to be removed from First Silicon.',
    jsonld: [breadcrumbLd(site, crumbs)],
    body,
  };
}

// ------------------------------------------------------------------ sponsor
export function sponsorPage(ctx) {
  const { site } = ctx;
  const crumbs = [{ name: 'Home', path: '/' }, { name: 'Sponsor', path: '/sponsor/' }];
  const body =
    '<div class="wrap">' +
    breadcrumbsHtml(crumbs) +
    '<div class="page-head prose"><h1>Sponsor First Silicon</h1>' +
    `<p class="lede">Sponsorships open once the weekly email reaches ${n(site.SPONSOR_THRESHOLD)} subscribers. Until then there is nothing to sell, and audience numbers will not be published until they are real.</p></div>` +
    '<div class="prose"><h2>What sponsorship will look like</h2><ul>' +
    '<li>A clearly labeled sponsor line in the weekly email.</li>' +
    '<li>One "featured role" slot per issue for a hardware internship or co-op, marked as sponsored and labeled by class year and citizenship like every other role.</li>' +
    '<li>Sponsored items never change how organic roles are labeled or ordered.</li></ul>' +
    '<p>Want a note when sponsorships open? Leave your work email.</p></div>' +
    '<form class="form" data-lead="sponsor" data-success="Thanks. You will hear from us when sponsorships open." aria-label="Sponsorship interest form">' +
    '<div class="form-row">' +
    '<div class="field"><label for="s-email">Work email</label><input id="s-email" name="email" type="email" autocomplete="email" required></div>' +
    '<div class="field"><label for="s-org">Organization</label><input id="s-org" name="org" type="text" autocomplete="organization"></div>' +
    '</div>' +
    '<div class="field"><label for="s-message">Anything we should know? (optional)</label><textarea id="s-message" name="message" maxlength="2000"></textarea></div>' +
    '<div class="hp" aria-hidden="true"><label for="s-website">Website</label><input id="s-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>' +
    '<p><button class="btn" type="submit">Notify me</button></p>' +
    '<p class="form-status" data-status role="status" aria-live="polite"></p>' +
    '</form></div>';
  return {
    path: '/sponsor/',
    title: 'Sponsor First Silicon',
    description: 'Sponsorships for the First Silicon weekly email open at 1,000 subscribers. Leave your email to hear when they do.',
    jsonld: [breadcrumbLd(site, crumbs)],
    body,
  };
}

// ------------------------------------------------------------------ 404
export function notFoundPage() {
  const body =
    '<div class="wrap prose"><div class="page-head"><h1>Page not found</h1>' +
    '<p class="lede">That page does not exist. Discipline guides appear only while five or more roles are open, so an older link may have expired.</p></div>' +
    '<ul><li><a href="/">Browse open roles</a></li><li><a href="/disciplines/">Discipline guides</a></li><li><a href="/programs/">Programs calendar</a></li></ul></div>';
  return { path: '/404.html', title: 'Page not found | First Silicon', description: 'This page does not exist. Browse open hardware internships, discipline guides or the programs calendar instead.', jsonld: [], body, noindex: true };
}

export { shortDate };
