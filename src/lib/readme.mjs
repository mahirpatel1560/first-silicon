// README.md generator in the style of community internship lists (one big table, newest first).

import { escapeMdCell, shortDate, longDate } from './text.mjs';
import { displayLocations } from './location.mjs';
import { disciplineLabel } from './disciplines.mjs';
import { FLAG_LABELS } from './classify.mjs';
import { isNew } from './pipeline.mjs';
import { upcomingDeadlines } from './programs.mjs';
import { classYearWindows } from './classify.mjs';
import { heroSubhead, classYearGuidance } from './copy.mjs';

const CY_LABEL = { fs: 'Fr/So', jplus: 'Jr+', unspecified: '' };

export function readmeRow(job, today) {
  const refYear = Number(String(today).slice(0, 4));
  const role = `[${escapeMdCell(job.title)}](${job.url})${job.type === 'co-op' && !/co-?op/i.test(job.title) ? ' (co-op)' : ''}`;
  const loc = displayLocations(job.locations, 2);
  const wp = job.workplace === 'remote' ? 'Remote' : job.workplace === 'hybrid' ? 'Hybrid' : '';
  const where = wp && !new RegExp(wp, 'i').test(loc) ? `${loc} · ${wp}` : loc;
  const disc = (job.disciplines || []).map((d) => disciplineLabel(d)).join(', ');
  const flags = (job.flags || []).map((f) => FLAG_LABELS[f] || f).join(', ');
  const date = job.posted || job.first_seen;
  const posted = `${shortDate(date, refYear)}${job.posted ? '' : ' (seen)'}${isNew(job, today) ? ' · new' : ''}`;
  return `| ${escapeMdCell(job.company)} | ${role} | ${escapeMdCell(where)} | ${escapeMdCell(disc)} | ${CY_LABEL[job.class_year] || ''} | ${escapeMdCell(flags)} | ${posted} |`;
}

/**
 * Build README.md.
 * @param {{jobs: object[], meta: object, programs: object[], site: object, today: string}} input
 */
export function buildReadme({ jobs, meta, programs, site, today }) {
  const counts = (meta && meta.counts) || {};
  const pending = !meta || !meta.last_run;
  const lines = [];
  const link = `**[${site.BASE_URL.replace(/^https:\/\//, '')}](${site.BASE_URL}/?ref=github)**`;
  lines.push('# First Silicon: every hardware internship, labeled');
  lines.push('');
  if (pending) {
    lines.push(
      `Hardware, EE, embedded and semiconductor internships and co-ops pulled daily from public employer job boards (Greenhouse, Lever and Ashby), tagged by class year, discipline and citizenship/export flags. Filter the list at ${link}.`,
    );
    lines.push('');
    lines.push('**Status:** the first automatic data run has not happened yet. The table fills in after the daily GitHub Action runs.');
  } else {
    lines.push(`${heroSubhead(counts)} Filter the list at ${link}.`);
    lines.push('');
    lines.push(
      `**Updated ${longDate(meta.last_run.slice(0, 10))}** · ${counts.roles || 0} open roles · ${counts.new_this_week || 0} new this week · ${counts.citizenship_free || 0} without citizenship or export flags`,
    );
    const guide = classYearGuidance(counts);
    if (guide) {
      lines.push('');
      lines.push(`**Class year:** ${guide}`);
    }
  }
  lines.push('');
  lines.push('> Labels are generated automatically from posting text and can be wrong. Always read the full posting on the employer\'s site before applying. Closed roles are removed on the next daily run.');
  lines.push('');
  lines.push('## Legend');
  lines.push('');
  const win = classYearWindows(new Date(`${today}T12:00:00Z`));
  lines.push(`- **Class year**: \`Fr/So\` = the posting mentions first-year, sophomore, rising-junior or all-class-year eligibility (or a ${win.fs[0]}-${win.fs[1]} graduation date); \`Jr+\` = it asks for junior/senior standing, graduation by ${win.jplus[0]}-${win.jplus[1]}, or a graduate degree; blank = not stated (apply unless the posting says juniors/seniors or a graduation date you can't meet).`);
  lines.push('- **Flags**: `US citizen`, `US person / PR`, `ITAR / export`, `Clearance`, `No visa sponsorship` are detected from the posting text. No flag does not guarantee there is no restriction.');
  lines.push('- **Posted**: the employer\'s publish date when the job board provides one, otherwise the date we first saw it `(seen)`. `new` = first seen in the last 7 days (and, when dated, posted in the last 14).');
  lines.push('');
  lines.push(`## Open roles (${jobs.length}, newest first)`);
  lines.push('');
  lines.push('| Company | Role | Location | Discipline | Class year | Flags | Posted |');
  lines.push('| --- | --- | --- | --- | --- | --- | --- |');
  if (!jobs.length) {
    lines.push('| | No roles yet: the list fills after the first daily update. | | | | | |');
  }
  for (const j of jobs) lines.push(readmeRow(j, today));
  lines.push('');
  const upcoming = upcomingDeadlines(programs, today, { withinDays: 200 }).slice(0, 8);
  lines.push('## Early-career programs worth a look');
  lines.push('');
  lines.push(`Government and national-lab programs whose official pages list no junior-standing requirement, each checked on that page. Details: [the programs calendar](${site.BASE_URL}/programs/).`);
  lines.push('');
  if (upcoming.length) {
    for (const u of upcoming) {
      lines.push(`- **${longDate(u.deadline.date)}**: [${u.program.name}](${u.program.url}) (${u.program.org}), ${u.deadline.term || 'deadline'}`);
    }
  }
  for (const p of programs || []) {
    if ((p.deadlines || []).some((d) => d.date)) continue;
    lines.push(`- [${p.name}](${p.url}) (${p.org}): ${p.deadline_text}`);
  }
  lines.push('');
  lines.push('## How this list is made');
  lines.push('');
  lines.push(`A scheduled GitHub Action calls the public job-board APIs of ${meta && meta.boards ? meta.boards.ok : 'the configured'} employer boards once a day, keeps internship and co-op postings that look like hardware work, and removes roles that disappear. Only titles, locations, dates, a link to the original posting and a short (at most 300-character) excerpt used to explain the labels are stored. Details: ${site.BASE_URL}/how-it-works/`);
  lines.push('');
  lines.push('Suggest an employer or report a wrong label by opening an issue, or use the contact form on the site.');
  lines.push('');
  lines.push(`${site.FOUNDER_LINE} Not affiliated with any listed employer. Not career or legal advice.`);
  lines.push('');
  return lines.join('\n');
}
