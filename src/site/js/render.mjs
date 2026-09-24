// Pure HTML renderers for role rows. Used by build.mjs (server-side) and the browser app.

import { escapeHtml, shortDate } from '../../lib/text.mjs';
import { displayLocations } from '../../lib/locdisplay.mjs';
import { DISCIPLINE_LABELS, FLAG_LABELS, CLASS_YEAR_LABELS } from '../../lib/labels.mjs';
import { isNewJob } from './filters.mjs';

const WORKPLACE = { remote: 'Remote', hybrid: 'Hybrid', onsite: '', unknown: '' };

export function roleHtml(job, { today, newDays = 7 } = {}) {
  const refYear = Number(String(today || '').slice(0, 4)) || null;
  const loc = displayLocations(job.locations, 2);
  const wp = WORKPLACE[job.workplace] || '';
  const where = wp && !new RegExp(wp, 'i').test(loc) ? `${loc} · ${wp}` : loc;
  const date = job.posted || job.first_seen;
  const isNew = today ? isNewJob(job, today, newDays) : false;
  const cyClass = job.class_year === 'fs' ? 'cy-fs' : job.class_year === 'jplus' ? 'cy-jp' : 'cy-na';
  const tags = [];
  tags.push(`<span class="tag ${cyClass}">${escapeHtml(CLASS_YEAR_LABELS[job.class_year] || 'Class year not stated')}</span>`);
  if (job.type === 'co-op') tags.push('<span class="tag t-type">Co-op</span>');
  for (const d of job.disciplines || []) {
    const lab = DISCIPLINE_LABELS[d] ? DISCIPLINE_LABELS[d].short : d;
    tags.push(`<span class="tag t-disc">${escapeHtml(lab)}</span>`);
  }
  for (const t of job.terms || []) tags.push(`<span class="tag t-term">${escapeHtml(t)}</span>`);
  if (!(job.terms || []).length && job.year_hint) tags.push(`<span class="tag t-term">${escapeHtml(String(job.year_hint))} (season not stated)</span>`);
  for (const f of job.flags || []) tags.push(`<span class="tag t-flag">${escapeHtml(FLAG_LABELS[f] || f)}</span>`);
  if (job.pay) tags.push(`<span class="tag t-pay">${escapeHtml(job.pay)}</span>`);
  const why = job.snippet
    ? `<details class="why"><summary>Why these labels?</summary><blockquote>${escapeHtml(job.snippet)}</blockquote><p>Excerpt from the posting (at most 300 characters). Always read the full posting on the employer's site.</p></details>`
    : '';
  const also = job.also ? `<span class="also"> · ${job.also} more posting${job.also === 1 ? '' : 's'} merged</span>` : '';
  return (
    `<li class="role" data-id="${escapeHtml(job.id)}">` +
    `<div class="role-head">` +
    `<a class="role-title" href="${escapeHtml(job.url)}" target="_blank" rel="noopener" data-pulse="role_out" data-company="${escapeHtml(job.company_slug)}">${escapeHtml(job.title)}<span class="visually-hidden"> at ${escapeHtml(job.company)} (opens the employer's site)</span></a>` +
    `${isNew ? '<span class="badge-new">New this week</span>' : ''}` +
    `</div>` +
    `<p class="role-meta"><span class="company">${escapeHtml(job.company)}</span> · ${escapeHtml(where)}${also}</p>` +
    `<p class="tags">${tags.join(' ')}</p>` +
    `<p class="role-date"><time datetime="${escapeHtml(date || '')}">${escapeHtml(shortDate(date, refYear))}</time>${job.posted ? '' : ' <span class="seen">(first seen)</span>'}${job.stale ? ' <span class="seen">(board unreachable today)</span>' : ''}</p>` +
    why +
    `</li>`
  );
}

export function rolesHtml(jobs, opts) {
  return jobs.map((j) => roleHtml(j, opts)).join('');
}
