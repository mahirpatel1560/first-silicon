// Weekly digest builder (HTML + plain text). Pure: no sending, no I/O.

import { escapeHtml, shortDate, longDate } from './text.mjs';
import { displayLocations } from './location.mjs';
import { DISCIPLINES, GENERAL, disciplineLabel } from './disciplines.mjs';
import { FLAG_LABELS } from './classify.mjs';
import { upcomingDeadlines } from './programs.mjs';
import { isNew } from './pipeline.mjs';

const CY_TEXT = { fs: 'Fr/So friendly', jplus: 'Juniors+', unspecified: 'Class year not stated' };
const CY_RANK = { fs: 0, unspecified: 1, jplus: 2 };

/** Roles first seen in the (days) days up to and including `today`. */
/** Roles that are "new this week" (see pipeline.isNew). */
export function rolesForWeek(jobs, today, days = 7) {
  return (jobs || []).filter((j) => isNew(j, today, days));
}

/** Group by primary discipline (taxonomy order), roles sorted Fr/So first then newest. */
export function groupByDiscipline(jobs) {
  const order = [...DISCIPLINES.map((d) => d.slug), GENERAL.slug];
  const groups = new Map(order.map((s) => [s, []]));
  for (const j of jobs) {
    const primary = (j.disciplines && j.disciplines[0]) || 'general';
    (groups.get(primary) || groups.get('general')).push(j);
  }
  const out = [];
  for (const [slug, list] of groups) {
    if (!list.length) continue;
    list.sort((a, b) => CY_RANK[a.class_year] - CY_RANK[b.class_year] || String(b.posted || b.first_seen).localeCompare(String(a.posted || a.first_seen)) || a.company.localeCompare(b.company));
    out.push({ slug, label: disciplineLabel(slug, { short: false }), jobs: list });
  }
  return out;
}

function utm(url, siteUrl, campaign) {
  // Only tag links to our own site; employer links are left untouched.
  if (!url.startsWith(siteUrl)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}utm_source=newsletter&utm_medium=email&utm_campaign=${campaign}`;
}

/**
 * @param {{jobs, programs, today: string, siteUrl: string, unsubscribeUrl?: string, mailingAddress?: string, featured?: object|null, maxPerGroup?: number}} input
 */
export function buildDigest({ jobs, programs, today, siteUrl, unsubscribeUrl = '{{UNSUBSCRIBE_URL}}', mailingAddress = '{{MAILING_ADDRESS}}', featured = null, maxPerGroup = 12, notice = '' }) {
  const week = rolesForWeek(jobs, today);
  const fsCount = week.filter((j) => j.class_year === 'fs').length;
  const groups = groupByDiscipline(week);
  const deadlines = upcomingDeadlines(programs, today, { withinDays: 60 });
  const campaign = `digest-${today}`;
  const refYear = Number(today.slice(0, 4));
  const subject = week.length
    ? `${week.length} new hardware internship${week.length === 1 ? '' : 's'} this week (${fsCount} Fr/So friendly)`
    : 'First Silicon weekly: program deadlines and this week\'s list';

  // ---------- plain text
  const t = [];
  if (notice) t.push(`*** ${notice} ***`, '');
  t.push(`FIRST SILICON WEEKLY · ${longDate(today)}`);
  t.push('');
  t.push(week.length
    ? `${week.length} hardware internships and co-ops were first seen in the last 7 days; ${fsCount} mention freshman/sophomore eligibility.`
    : 'No new hardware internships were first seen in the last 7 days.');
  t.push('Labels are automatic. Always check the posting on the employer\'s site.');
  t.push('');
  if (featured && featured.title && featured.url) {
    t.push(`FEATURED ROLE (sponsored): ${featured.company} · ${featured.title}`);
    t.push(featured.url);
    t.push('');
  }
  for (const g of groups) {
    t.push(`== ${g.label.toUpperCase()} (${g.jobs.length}) ==`);
    for (const j of g.jobs.slice(0, maxPerGroup)) {
      const flags = (j.flags || []).map((f) => FLAG_LABELS[f]).join(', ');
      t.push(`- ${j.company}: ${j.title}`);
      t.push(`  ${displayLocations(j.locations, 2)} · ${CY_TEXT[j.class_year]}${flags ? ` · ${flags}` : ''}`);
      t.push(`  ${j.url}`);
    }
    if (g.jobs.length > maxPerGroup) t.push(`  + ${g.jobs.length - maxPerGroup} more: ${utm(`${siteUrl}/?d=${g.slug}&new=1`, siteUrl, campaign)}`);
    t.push('');
  }
  t.push('== PROGRAM DEADLINES (NEXT 60 DAYS) ==');
  if (deadlines.length) {
    for (const d of deadlines) t.push(`- ${longDate(d.deadline.date)} (${d.days} days): ${d.program.name}, ${d.deadline.term || ''} · ${d.program.url}`);
  } else {
    t.push('- None with a fixed date in the next 60 days. Calendar: ' + utm(`${siteUrl}/programs/`, siteUrl, campaign));
  }
  t.push('');
  t.push(`Full list with filters: ${utm(`${siteUrl}/`, siteUrl, campaign)}`);
  t.push('');
  t.push('You are receiving this because you subscribed at firstsilicon.pages.dev.');
  t.push(`Unsubscribe: ${unsubscribeUrl}`);
  t.push(mailingAddress);
  const text = t.join('\n');

  // ---------- HTML (email-safe: tables, inline styles, no external assets)
  const c = { ink: '#15181e', muted: '#4a5160', line: '#d9dce3', accent: '#9a4a17', bg: '#ffffff', chip: '#f1efe9' };
  const h = [];
  h.push(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>`);
  h.push(`<body style="margin:0;padding:0;background:${c.bg};color:${c.ink};font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">`);
  h.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:0 auto;padding:24px 16px;">`);
  if (notice) h.push(`<tr><td style="padding:8px 12px;background:#fbf0d9;border:1px solid #d8b86a;border-radius:6px;font-size:14px;font-weight:700;">${escapeHtml(notice)}</td></tr><tr><td style="height:12px;"></td></tr>`);
  h.push(`<tr><td style="font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:${c.accent};font-weight:700;">First Silicon weekly · ${escapeHtml(longDate(today))}</td></tr>`);
  h.push(`<tr><td style="padding:8px 0 4px;font-size:22px;font-weight:700;line-height:1.3;">${escapeHtml(subject)}</td></tr>`);
  h.push(`<tr><td style="padding:0 0 16px;font-size:14px;color:${c.muted};line-height:1.5;">Labels are automatic and can be wrong. Always check the posting on the employer's site before applying.</td></tr>`);
  if (featured && featured.title && featured.url) {
    h.push(`<tr><td style="padding:12px;border:1px solid ${c.line};border-radius:8px;"><div style="font-size:12px;color:${c.muted};">Featured role (sponsored)</div><a href="${escapeHtml(featured.url)}" style="color:${c.accent};font-weight:700;font-size:16px;">${escapeHtml(featured.company)}: ${escapeHtml(featured.title)}</a></td></tr>`);
    h.push('<tr><td style="height:16px;"></td></tr>');
  }
  for (const g of groups) {
    h.push(`<tr><td style="padding:16px 0 6px;border-top:1px solid ${c.line};font-size:16px;font-weight:700;">${escapeHtml(g.label)} <span style="color:${c.muted};font-weight:400;">(${g.jobs.length})</span></td></tr>`);
    for (const j of g.jobs.slice(0, maxPerGroup)) {
      const flags = (j.flags || []).map((f) => FLAG_LABELS[f]).join(', ');
      h.push('<tr><td style="padding:6px 0;">');
      h.push(`<a href="${escapeHtml(j.url)}" style="color:${c.ink};font-weight:600;font-size:15px;">${escapeHtml(j.title)}</a>`);
      h.push(`<div style="font-size:13px;color:${c.muted};line-height:1.5;">${escapeHtml(j.company)} · ${escapeHtml(displayLocations(j.locations, 2))} · ${escapeHtml(shortDate(j.posted || j.first_seen, refYear))}</div>`);
      h.push(`<div style="font-size:12px;line-height:1.6;"><span style="background:${c.chip};padding:1px 6px;border-radius:4px;">${escapeHtml(CY_TEXT[j.class_year])}</span>${flags ? ` <span style="background:${c.chip};padding:1px 6px;border-radius:4px;">${escapeHtml(flags)}</span>` : ''}</div>`);
      h.push('</td></tr>');
    }
    if (g.jobs.length > maxPerGroup) {
      h.push(`<tr><td style="padding:4px 0 8px;font-size:13px;"><a href="${escapeHtml(utm(`${siteUrl}/?d=${g.slug}&new=1`, siteUrl, campaign))}" style="color:${c.accent};">See all ${g.jobs.length} ${escapeHtml(g.label)} roles</a></td></tr>`);
    }
  }
  if (!groups.length) h.push(`<tr><td style="padding:12px 0;font-size:15px;">No new hardware internships were first seen in the last 7 days.</td></tr>`);
  h.push(`<tr><td style="padding:20px 0 6px;border-top:1px solid ${c.line};font-size:16px;font-weight:700;">Program deadlines in the next 60 days</td></tr>`);
  if (deadlines.length) {
    for (const d of deadlines) {
      h.push(`<tr><td style="padding:4px 0;font-size:14px;line-height:1.5;"><strong>${escapeHtml(longDate(d.deadline.date))}</strong> (${d.days} days) · <a href="${escapeHtml(d.program.url)}" style="color:${c.accent};">${escapeHtml(d.program.name)}</a>${d.deadline.term ? `, ${escapeHtml(d.deadline.term)}` : ''}</td></tr>`);
    }
  } else {
    h.push(`<tr><td style="padding:4px 0;font-size:14px;">None with a fixed date in the next 60 days. <a href="${escapeHtml(utm(`${siteUrl}/programs/`, siteUrl, campaign))}" style="color:${c.accent};">See the calendar</a>.</td></tr>`);
  }
  h.push(`<tr><td style="padding:20px 0;"><a href="${escapeHtml(utm(`${siteUrl}/`, siteUrl, campaign))}" style="display:inline-block;background:${c.ink};color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600;">Open the full list</a></td></tr>`);
  h.push(`<tr><td style="padding:12px 0;border-top:1px solid ${c.line};font-size:12px;color:${c.muted};line-height:1.6;">You are receiving this because you subscribed at firstsilicon.pages.dev. <a href="${escapeHtml(unsubscribeUrl)}" style="color:${c.muted};">Unsubscribe</a>.<br>${escapeHtml(mailingAddress)}</td></tr>`);
  h.push('</table></body></html>');
  const html = h.join('\n');

  return { subject, text, html, stats: { new_roles: week.length, fs: fsCount, groups: groups.map((g) => ({ slug: g.slug, count: g.jobs.length })), deadlines: deadlines.length } };
}
