// Positioning copy shared by the site build, the browser bundle, README.md and the weekly email.
// Every number comes from the counts passed in (computed from data/jobs.json); nothing here is hardcoded.
// Dependency-free so the browser bundle can refresh the text when it loads a newer list.

const num = (x) => Number(x || 0).toLocaleString('en-US');
const one = (count) => Number(count) === 1;

/** Example disciplines named in the subhead (words, not counts). */
export const SUBHEAD_DISCIPLINES = 'PCB, embedded, RF, test, silicon';

/**
 * Hero subhead, e.g. "191 internships and co-ops at 34 companies — PCB, embedded, RF, test, silicon — tagged by
 * class year, discipline and citizenship. Updated every morning from the companies' own job boards."
 */
export function heroSubhead({ roles = 0, companies = 0 } = {}) {
  return (
    `${num(roles)} ${one(roles) ? 'internship or co-op' : 'internships and co-ops'} at ${num(companies)} ${one(companies) ? 'company' : 'companies'}` +
    ` — ${SUBHEAD_DISCIPLINES} — tagged by class year, discipline and citizenship.` +
    ` Updated every morning from the ${one(companies) ? "company's own job board" : "companies' own job boards"}.`
  );
}

/**
 * Class-year guidance shown next to the class-year filter, e.g. "Only 4 postings say freshmen or sophomores can
 * apply. 172 don't list a class year at all: apply to those unless the posting says juniors/seniors or a graduation
 * date you can't meet." "Only" is used while explicit Fr/So postings are under a quarter of all roles.
 * Returns '' when there are no roles.
 */
export function classYearGuidance({ roles = 0, fs = 0, unspecified = 0 } = {}) {
  if (!roles) return '';
  const first = fs
    ? `${fs * 4 < roles ? 'Only ' : ''}${num(fs)} ${one(fs) ? 'posting says' : 'postings say'} freshmen or sophomores can apply.`
    : 'No postings say freshmen or sophomores can apply right now.';
  const second = unspecified
    ? ` ${num(unspecified)} ${one(unspecified) ? "doesn't list a class year at all: apply to it" : "don't list a class year at all: apply to those"} unless the posting says juniors/seniors or a graduation date you can't meet.`
    : '';
  return first + second;
}

const GENERIC_DESCRIPTION =
  'Hardware, EE, embedded and chip internships and co-ops from company job boards, labeled by discipline, class year and citizenship. Updated daily.';

/** Home-page meta description (at most 155 characters; number-free before the first data run). */
export function homeDescription({ roles = 0, companies = 0 } = {}) {
  if (!roles) return GENERIC_DESCRIPTION;
  const text = `${num(roles)} hardware ${one(roles) ? 'internship or co-op' : 'internships and co-ops'} at ${num(companies)} ${one(companies) ? 'company' : 'companies'}, labeled by discipline, class year and citizenship. Updated every morning.`;
  return text.length <= 155 ? text : GENERIC_DESCRIPTION;
}
