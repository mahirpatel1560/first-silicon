// Helpers for the curated early-career programs calendar (data/programs.json).

import { daysBetween } from './text.mjs';

/** Future deadlines (date >= today) across programs, soonest first. */
export function upcomingDeadlines(programs, today, { withinDays = 400 } = {}) {
  const out = [];
  for (const p of programs || []) {
    for (const d of p.deadlines || []) {
      if (!d.date) continue;
      const days = daysBetween(today, d.date);
      if (Number.isFinite(days) && days >= 0 && days <= withinDays) {
        out.push({ program: p, deadline: d, days });
      }
    }
  }
  return out.sort((a, b) => a.days - b.days || a.program.name.localeCompare(b.program.name));
}

/** Next future deadline for one program, or null. */
export function nextDeadline(program, today) {
  const list = upcomingDeadlines([program], today);
  return list.length ? list[0] : null;
}

/** Programs sorted for the calendar: by next dated deadline, undated ones last (alphabetical). */
export function sortPrograms(programs, today) {
  return [...(programs || [])].sort((a, b) => {
    const na = nextDeadline(a, today);
    const nb = nextDeadline(b, today);
    if (na && nb) return na.days - nb.days;
    if (na) return -1;
    if (nb) return 1;
    return a.name.localeCompare(b.name);
  });
}

export function validateProgram(p) {
  const errors = [];
  for (const k of ['id', 'name', 'org', 'url', 'eligibility', 'deadline_text', 'verified_on']) {
    if (!p[k] || typeof p[k] !== 'string') errors.push(`missing ${k}`);
  }
  if (p.url && !/^https:\/\//.test(p.url)) errors.push('url must be https');
  if (p.verified_on && !/^\d{4}-\d{2}-\d{2}$/.test(p.verified_on)) errors.push('verified_on must be YYYY-MM-DD');
  for (const d of p.deadlines || []) {
    if (d.date && !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) errors.push(`bad deadline date ${d.date}`);
  }
  return errors;
}
