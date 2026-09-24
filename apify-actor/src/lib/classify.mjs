// Pure classifier for internship postings. No I/O. Deterministic given (posting, options.now).
//
// classify({ title, description, employmentType, company, category }, { now }) returns:
//   { is_internship, type, terms, year_hint, disciplines, hw_score, is_hardware,
//     class_year, flags, snippet, evidence: { class_year: [...], flags: [...] }, reasons: [...] }

import { DISCIPLINES } from './disciplines.mjs';
import { splitSentences, truncate, oneLine } from './text.mjs';

export const HW_THRESHOLD = 45;
export const SNIPPET_MAX = 300;

// ---------------------------------------------------------------- internship detection
const INTERN_WORD = /\b(?:intern(?:ship)?s?|co-?ops?|c0-?ops?|werkstudent(?:in)?|working students?)\b|\bcooperative education\b/i;
const STUDENT_ROLE = new RegExp(
  [
    '(?:^|[,(\\[\\-–—|/:]\\s*)students?\\s*(?:$|[)\\],\\-–—|/:])', // "Physical Design Student", "Student - Hardware"
    '^\\s*students?\\s+(?:researcher|engineer(?:ing)?|worker|trainee|assistant|intern|associate|employee|position|technician|developer|scientist)\\b',
    '\\bstudents?\\s+(?:researcher|engineer(?:ing)?|worker|trainee|assistant|intern|associate|employee|position|technician|developer|scientist)\\b',
    '\\b(?:graduate|undergraduate|phd|ph\\.d\\.|master\'?s?|bachelor\'?s?)\\s+students?\\b',
    '\\bstudent\\s*$',
  ].join('|'),
  'i',
);
const NOT_INTERN = [
  /\brecruit(?:er|ers|ing (?:coordinator|manager|lead|partner|specialist|operations))\b/i,
  /\btalent (?:acquisition|partner|sourcer|brand)\b/i,
  /\b(?:university|campus|early[- ]careers?|emerging talent|intern(?:ship)?s?|co-?ops?|students?)\s+(?:programs?\s+)?(?:relations|recruit\w*|manager|coordinator|lead|specialist|director|partner|program manager)\b/i,
  /\bpost-?docs?\b|\bpostdoctoral\b/i,
  /\bstudents? (?:success|loans?|experience|affairs|services|engagement|support|advis\w+|counsel\w*|ambassador)\b/i,
];
const NOT_A_ROLE = /\b(?:resume submission|general application|talent (?:pool|community|network)|future opportunities|opportunistic application|expression of interest|join our talent|general interest)\b/i;
const COOP_RE = /\bco-?ops?\b|\bc0-?ops?\b|\bcooperative education\b/i;

function firstSegment(title) {
  return String(title).split(/\s*(?:,|\(|\)|\[|\]|:|\||\s[-–—]\s)\s*/).map((s) => s.trim()).filter(Boolean)[0] || '';
}
const ENDS_WITH_INTERN = /\b(?:intern(?:ship)?s?|co-?ops?|c0-?ops?|werkstudent(?:in)?|working students?|students?)\s*$/i;

export function detectInternship({ title, description = '', employmentType = '' }) {
  const t = oneLine(title);
  const reasons = [];
  if (NOT_A_ROLE.test(t)) return { is_internship: false, type: null, reasons: ['not a specific role (talent pool / resume drop)'] };
  const positive = INTERN_WORD.test(t) || STUDENT_ROLE.test(t);
  const negative = NOT_INTERN.some((re) => re.test(t));
  const et = String(employmentType || '').toLowerCase();
  const structured = /intern|co-?op|student|werkstudent|trainee/.test(et);
  let is = false;
  if (positive && !negative) { is = true; reasons.push('title names an internship/co-op/student role'); }
  else if (positive && negative) {
    if (ENDS_WITH_INTERN.test(firstSegment(t))) { is = true; reasons.push('title role noun is intern'); }
    else reasons.push('intern word modifies a non-intern role (recruiter/coordinator/manager)');
  } else if (structured && !negative) { is = true; reasons.push(`ATS employment type "${employmentType}"`); }
  else if (!negative && extractTerms(t).terms.length && /\b(?:internship|intern|co-?op)\b/i.test(description)) {
    is = true; reasons.push('title names a term and the description calls it an internship/co-op');
  }
  const type = is ? (COOP_RE.test(t) || /co-?op/.test(et) ? 'co-op' : 'internship') : null;
  return { is_internship: is, type, reasons };
}

// ---------------------------------------------------------------- terms
const SEASON = { summer: 'Summer', fall: 'Fall', autumn: 'Fall', spring: 'Spring', winter: 'Winter' };
const TERM_RE = /\b(summer|fall|autumn|spring|winter)(?:\s*(?:\/|&|and|or|-|–)\s*(summer|fall|autumn|spring|winter))?\s*(?:(?:co-?op|c0-?op|intern(?:ship)?s?|term|semester|session|of)\s*)?(?:['’](\d{2})\b|(20\d{2})\b)/gi;
const TERM_REV_RE = /\b(20\d{2})\s*(summer|fall|autumn|spring|winter)(?:\s*(?:\/|&|and|or|-|–)\s*(summer|fall|autumn|spring|winter))?\b/gi;
const YEAR_ONLY_RE = /(?:^|[\s(\[])(20\d{2})(?=[\s)\]:,-]|$)/;

/** Extract "Season YYYY" terms from text. Years outside [nowYear-1, nowYear+3] are ignored. */
export function extractTerms(text, nowYear = null, { maxAhead = 3 } = {}) {
  const found = [];
  const add = (season, year) => {
    const s = SEASON[String(season).toLowerCase()];
    const y = Number(year);
    if (!s || !y) return;
    if (nowYear && (y < nowYear - 1 || y > nowYear + maxAhead)) return;
    const label = `${s} ${y}`;
    if (!found.includes(label)) found.push(label);
  };
  const str = String(text || '');
  for (const m of str.matchAll(TERM_RE)) {
    const year = m[3] ? 2000 + Number(m[3]) : Number(m[4]);
    add(m[1], year);
    if (m[2]) add(m[2], year);
  }
  for (const m of str.matchAll(TERM_REV_RE)) {
    add(m[2], m[1]);
    if (m[3]) add(m[3], m[1]);
  }
  return { terms: found };
}

const SEASON_ORDER = { Winter: 0, Spring: 1, Summer: 2, Fall: 3 };
export function sortTerms(terms) {
  return [...terms].sort((a, b) => {
    const [sa, ya] = a.split(' ');
    const [sb, yb] = b.split(' ');
    return Number(ya) - Number(yb) || SEASON_ORDER[sa] - SEASON_ORDER[sb];
  });
}

// ---------------------------------------------------------------- disciplines + hardware relevance
const DISC_RULES = DISCIPLINES.map((d) => ({
  slug: d.slug,
  title: d.title.map((s) => new RegExp(s, 'i')),
  titleWeak: (d.titleWeak || []).map((s) => new RegExp(s, 'i')),
  desc: d.desc.map((s) => new RegExp(s, 'i')),
  needsContext: Boolean(d.titleNeedsContext),
}));

const GENERIC_HW_TITLE = /\b(?:electrical|electronics?|hardware|silicon|semiconductors?|chips?|circuits?|ee|ece|dsp|signal processing|electromagnetics?)\b/i;
const MEDIUM_TITLE = [
  [/\bsystems? engineer(?:ing)?\b/i, 30],
  [/\bmanufacturing\b/i, 30],
  [/\bfield applications? engineer(?:ing)?\b|\bapplications? engineer(?:ing)?\b/i, 30],
  [/\bneuro ?engineer(?:ing)?\b/i, 30],
  [/\bsensors?\b/i, 30],
  [/\binstrumentation\b/i, 35],
  [/\btest\b/i, 30],
  [/\bintegration\b/i, 20],
  [/\bquality\b/i, 20],
  [/\b(?:lab|laboratory)\b/i, 20],
  [/\btechnician\b/i, 20],
  [/\bmechanical\b/i, 15],
  [/\b(?:aerospace|aeronautical|physics|nuclear)\b/i, 10],
];
const NEG_TITLE = new RegExp(
  '\\b(?:' +
    [
      'software', 'front[- ]?end', 'back[- ]?end', 'full[- ]?stack', 'web', 'mobile', 'ios', 'android', 'devops', 'site reliability',
      'sre', 'cloud', 'data (?:scien\\w*|analy\\w*|engineer\\w*|platform)', 'analytics', 'machine learning', 'ml', 'ai', 'deep learning',
      'computer vision', 'nlp', 'llm', 'product manage\\w*', 'program manage\\w*', 'project manage\\w*', 'marketing', 'sales',
      'business', 'finance', 'financial', 'accounting', 'legal', 'counsel', 'human resources', 'people', 'recruit\\w*', 'talent',
      'communications?(?! (?:systems?|hardware|engineer\\w*))', 'community', 'operations', 'strategy', 'supply chain', 'sourcing',
      'procurement', 'buyer', 'purchasing', 'logistics', 'construction', 'civil', 'structures', 'structural', 'architect(?:ure)?',
      'ux', 'ui', 'graphic', 'industrial design', 'content', 'writer', 'editor', 'security', 'cyber\\w*', 'it', 'systems administrator',
      'quantitative', 'economics', 'policy', 'ehs', 'environmental health', 'facilities', 'real estate', 'mba', 'biolog\\w*',
      'chemist\\w*', 'chemical', 'formulation', 'clinical', 'regulatory', 'customer', 'account', 'analyst', 'change management',
      'commercial', 'research scientist', 'scientist', 'propulsion', 'fluids?', 'aerodynamics', 'cad', 'thermal', 'mechanisms',
    ].join('|') +
    ')\\b',
  'i',
);
const HW_EXEMPT = /\b(?:embedded|firmware|fpga|asic|rtl|hardware|electrical|electronics?|robotics?|robot|controls?|mechatronics?|gnc|avionics|flight software|drivers?|kernel|bsp|test automation|test engineer\w*|hil|hitl|hardware[- ]in[- ]the[- ]loop|silicon|chips?|semiconductors?|dsp|signal processing|design verification|verification engineer|validation|(?:computer|cpu|gpu|hardware|soc|silicon|chip|accelerator|memory) architecture|accelerators?|photonics?|optical|rf|antennas?|radar|power electronics|pcb|analog|mixed[- ]signal|circuits?)\b/i;
const DESC_HW_GENERIC = [/\bhardware\b/i, /\boscilloscopes?\b/i, /\bmultimeters?\b/i, /\bsolder(?:ing|ed)?\b/i, /\bschematics?\b/i, /\bcircuits?\b/i, /\belectronics?\b/i, /\bbench\b/i, /\blab(?:oratory)?\b/i, /\bsignal processing\b/i];
// A title that only says "Engineering Intern" is neutral: the description decides.
const NEUTRAL_ENGINEERING_TITLE = /\bengineer(?:ing)?\b/i;
const DESC_EE_DEGREE = /\b(?:electrical|computer|electrical and computer) engineering\b|\bEE\b|\bECE\b/;
const DESC_SW = [/\bselenium\b/i, /\bcypress\b/i, /\bqa automation\b/i, /\bweb (?:app|application|testing)s?\b/i, /\brest(?:ful)? apis?\b/i, /\breact\b/i, /\btypescript\b/i, /\bjavascript\b/i, /\bnode\.js\b/i, /\bkubernetes\b/i, /\bdocker\b/i, /\bmicroservices?\b/i, /\bsql\b/i, /\bdjango\b/i, /\bgraphql\b/i, /\bhtml\b/i, /\bcss\b/i, /\baws\b/i, /\bgcp\b/i, /\bazure\b/i, /\bspark\b/i, /\btableau\b/i, /\bsalesforce\b/i, /\bfigma\b/i, /\bpytorch\b/i, /\btensorflow\b/i, /\bfront[- ]?end\b/i, /\bback[- ]?end\b/i];
const HW_CATEGORY = new Set(['semiconductors', 'eda', 'photonics', 'quantum']);

/** Title discipline hits split into strong and weak (ambiguous) matches. */
function titleDisciplineHits(title, description, category) {
  const strong = [];
  const weak = [];
  for (const r of DISC_RULES) {
    const s = r.title.some((re) => re.test(title));
    const w = r.titleWeak.some((re) => re.test(title));
    if (!s && !w) continue;
    const contextOk = !r.needsContext || HW_CATEGORY.has(category) || r.desc.some((re) => re.test(description));
    if (s && contextOk) strong.push(r.slug);
    else if (s || (w && contextOk)) weak.push(r.slug);
    else if (w) weak.push(r.slug);
  }
  return { strong, weak };
}
function descDisciplineHits(desc) {
  const out = [];
  for (const r of DISC_RULES) {
    const n = r.desc.reduce((acc, re) => acc + (re.test(desc) ? 1 : 0), 0);
    if (n > 0) out.push({ slug: r.slug, n });
  }
  return out.sort((a, b) => b.n - a.n);
}

export function scoreHardware({ title, description = '', category = '' }) {
  const t = oneLine(title);
  const d = String(description || '');
  const reasons = [];
  let score = 0;
  const { strong, weak } = titleDisciplineHits(t, d, category);
  const titleTags = [...strong, ...weak.filter((w) => !strong.includes(w))];
  const neg = NEG_TITLE.test(t);
  const exempt = HW_EXEMPT.test(t);
  if (strong.length) {
    score += 55 + Math.min(16, 8 * (titleTags.length - 1));
    reasons.push(`title matches ${strong.join(', ')}`);
  } else if (GENERIC_HW_TITLE.test(t)) {
    score += 55;
    reasons.push('title has a general hardware/EE term');
  } else {
    const medium = MEDIUM_TITLE.filter(([re]) => re.test(t)).map(([, v]) => v);
    if (weak.length) medium.push(35);
    if (medium.length) {
      score += Math.max(...medium);
      reasons.push('title has an adjacent or ambiguous engineering term');
    } else if (NEUTRAL_ENGINEERING_TITLE.test(t) && !neg) {
      score += 15;
      reasons.push('neutral engineering title; description decides');
    }
  }
  if (neg && !exempt) {
    score -= 60;
    reasons.push('title is software/business/other non-hardware');
  }
  const descHits = descDisciplineHits(d);
  const distinct = descHits.reduce((acc, h) => acc + h.n, 0);
  if (distinct) {
    score += Math.min(40, 6 * distinct);
    reasons.push(`description mentions ${distinct} hardware keywords`);
  }
  const generic = DESC_HW_GENERIC.filter((re) => re.test(d)).length;
  score += Math.min(12, 3 * generic);
  if (DESC_EE_DEGREE.test(d)) score += 8;
  const sw = DESC_SW.filter((re) => re.test(d)).length;
  if (sw) {
    score -= Math.min(18, 3 * sw);
    reasons.push(`description mentions ${sw} web/data/ML tools`);
  }
  if (HW_CATEGORY.has(category) && !(neg && !exempt)) score += 8;
  score = Math.max(0, Math.min(100, score));
  return { hw_score: score, is_hardware: score >= HW_THRESHOLD, titleTags, descHits, reasons };
}

export function assignDisciplines(titleTags, descHits) {
  const tags = [...titleTags];
  if (tags.length === 0) {
    for (const h of descHits) if (h.n >= 2 && tags.length < 3) tags.push(h.slug);
  } else {
    let extra = 0;
    for (const h of descHits) {
      if (extra >= 2) break;
      if (!tags.includes(h.slug) && h.n >= 3) { tags.push(h.slug); extra++; }
    }
  }
  const order = DISCIPLINES.map((x) => x.slug);
  const sorted = order.filter((s) => tags.includes(s));
  return sorted.length ? sorted : ['general'];
}

// ---------------------------------------------------------------- class year
/** Academic-year start: July or later belongs to the year that started that fall. */
export function academicYearStart(now) {
  const d = now instanceof Date ? now : new Date(now);
  return d.getUTCMonth() >= 6 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
}

/** Graduation-year windows used by the class-year rules, e.g. {fs:[2029,2030], jplus:[2027,2028]} in fall 2026. */
export function classYearWindows(now) {
  const start = academicYearStart(now);
  return { fs: [start + 3, start + 4], jplus: [start + 1, start + 2] };
}

const FS_PATTERNS = [
  /\b(?:first|1st)[- ]years?\s+(?:students?|undergrad(?:uate)?s?|college|university|engineering|electrical|stem|in college|of (?:college|university|undergrad\w*|study|school))\b/i,
  /\bfreshm[ae]n\b/i,
  /\bsophomores?\b/i,
  /\b(?:second|2nd)[- ]years?\s+(?:students?|undergrad(?:uate)?s?|college|university|engineering|electrical|stem|in college|of (?:college|university|undergrad\w*|study|school))\b/i,
  /\brising (?:sophomores?|juniors?)\b/i,
  /\b(?:all|any) (?:class years?|academic years?|years of study|class standings?|undergraduate (?:years|levels|class(?:es)?|class years))\b/i,
  /\bstudents? (?:of|in) (?:all|any) (?:class )?years\b/i,
  /\bregardless of (?:class )?(?:year|standing)\b/i,
  /\bno (?:minimum )?class[- ](?:year|standing) (?:requirement|minimum)\b/i,
  /\bunderclass(?:men|man|people|persons?)\b/i,
  /\bentering (?:their |his or her |your )?(?:sophomore|junior) year\b/i,
  /\b(?:completed|finished|completion of) (?:at least )?(?:their |your )?(?:one|1|first) (?:full )?(?:year|semester)\b/i,
  /\b(?:early[- ]insight|explore (?:intern(?:ship)?|program)|discovery (?:intern(?:ship)?|program)|pre[- ]junior|freshman\/sophomore|first[- ] and second[- ]year|early career exploration)\b/i,
];
const JP_PATTERNS = [
  /\b(?:junior|senior)[- ](?:standing|status|level students?)\b/i,
  /\bjuniors?,? (?:or|and|\/) seniors?\b/i,
  /\b(?:at least|minimum of|must be) (?:a |an )?(?:junior|senior|third[- ]year|fourth[- ]year|rising senior)\b/i,
  /\brising seniors?\b/i,
  /\b(?:third|3rd|fourth|4th|final|last)[- ]year (?:students?|undergrad(?:uate)?s?|of (?:study|university|college|undergrad\w*))\b/i,
  /\bupperclass(?:men|man|people|persons?)\b/i,
  /\bcompleted (?:at least )?(?:three|3|four|4|five|5) (?:full )?(?:years|academic years)\b/i,
  /\bentering (?:their |your )?(?:senior|final|fourth) year\b/i,
  /\b(?:completed|finished|completion of) (?:at least )?(?:their |your )?(?:sophomore|second|2nd) year\b/i,
];
// Graduate-degree requirement (only when the same sentence does not also welcome undergrads).
const GRAD_ONLY = /\b(?:currently )?(?:pursuing|enrolled in|working towards?|candidates? for) (?:an? |their )?(?:ph\.?d\.?|doctoral|doctorate|master'?s|m\.?s\.?|graduate)(?: degree| program| student)?\b|\b(?:for|open to|only|seeking|looking for|must be|intended for)\b[^.;]{0,30}\b(?:ph\.?d\.?|doctoral|master'?s|graduate) students?\b|\b(?:first|second|third|1st|2nd|3rd)[- ]year (?:ph\.?d|doctoral|master'?s|graduate) students?\b/i;
const UNDERGRAD_WORD = /\b(?:bachelor'?s?|b\.?s\.?|b\.?sc|undergrad(?:uate)?s?|ba\/bs|bs\/ms)\b/i;
const TITLE_GRAD = /\b(?:ph\.?d\.?|phd|doctoral|master'?s|masters|ms\/phd|m\.s\.\/ph\.d\.|mba|graduate)\b/i;
const TITLE_UNDERGRAD = /\b(?:bs|b\.s\.|ba|undergrad(?:uate)?|bachelor'?s?)\b/i;
const NEGATION = /\b(?:not eligible|ineligible|not open|not accepting|(?:are|is|will) not (?:be )?(?:considered|eligible|accepted)|excluding|except(?: for)?|must not|cannot|can not|unable to accept|no (?:freshm|first|second|sophom))/i;
const COMPLETED_SOPH = /\b(?:completed|finished|completion of) (?:at least )?(?:their |your )?(?:sophomore|second|2nd) year\b/gi;
const GRAD_CONTEXT = /\bgraduat\w*|\bclass of\b|\bdegree (?:completion|conferral|date)|\bexpected to (?:complete|finish)|\bcompletion date\b|\bgrad date\b/i;

function gradYearsIn(sentence) {
  const years = new Set();
  const re = /(graduat\w*|class of|degree (?:completion|conferral|date)|expected to (?:complete|finish)|completion date|grad date)([^.;]{0,60})/gi;
  for (const m of sentence.matchAll(re)) {
    const win = m[2];
    for (const r of win.matchAll(/(20\d{2})\s*(?:-|–|—|to|through|and|or)\s*(?:[A-Za-z]+\.?\s+)?(20\d{2})/gi)) {
      const a = Number(r[1]);
      const b = Number(r[2]);
      if (b >= a && b - a <= 6) for (let y = a; y <= b; y++) years.add(y);
    }
    for (const y of win.matchAll(/\b(20\d{2})\b/g)) years.add(Number(y[1]));
  }
  return [...years];
}

export function detectClassYear({ title, description = '' }, { now = new Date() } = {}) {
  const start = academicYearStart(now);
  const fsYears = new Set([start + 3, start + 4, start + 5]);
  const jpYears = new Set([start - 1, start, start + 1, start + 2]);
  const fsEvidence = [];
  const jpEvidence = [];
  const t = oneLine(title);

  // Title-level signals.
  if (FS_PATTERNS.some((re) => re.test(t))) fsEvidence.push(t);
  if (TITLE_GRAD.test(t) && !TITLE_UNDERGRAD.test(t)) jpEvidence.push(t);

  for (const sentence of splitSentences(description)) {
    const negated = NEGATION.test(sentence);
    const jp = JP_PATTERNS.some((re) => re.test(sentence));
    // "Completed sophomore year" means a current junior: drop that phrase before testing friendly patterns.
    const rest = sentence.replace(COMPLETED_SOPH, ' ');
    const fsHit = FS_PATTERNS.some((re) => re.test(rest));
    if (fsHit && !negated) fsEvidence.push(sentence);
    if (fsHit && negated) jpEvidence.push(sentence);
    if (jp) jpEvidence.push(sentence);
    if (GRAD_ONLY.test(sentence) && !UNDERGRAD_WORD.test(sentence)) jpEvidence.push(sentence);
    if (GRAD_CONTEXT.test(sentence)) {
      const years = gradYearsIn(sentence);
      if (years.some((y) => fsYears.has(y))) fsEvidence.push(sentence);
      else if (years.length && years.every((y) => jpYears.has(y))) jpEvidence.push(sentence);
    }
  }
  const uniq = (a) => [...new Set(a)];
  if (fsEvidence.length) return { class_year: 'fs', evidence: uniq(fsEvidence) };
  if (jpEvidence.length) return { class_year: 'jplus', evidence: uniq(jpEvidence) };
  return { class_year: 'unspecified', evidence: [] };
}

// ---------------------------------------------------------------- flags
const EEO = /\b(?:regardless of|without regard to|irrespective of|discriminat\w*|equal (?:employment )?opportunity|protected (?:class|characteristics?|status|veteran)|affirmative action|e-verify|pay transparency|reasonable accommodations?)\b/i;
const CITIZEN = /\b(?:u\.?\s?s\.?|united states|american)\s+citizen(?:ship|s)?\b|\bcitizens? of the united states\b/i;
const RESIDENCY = /\b(?:u\.?\s?s\.?|united states)\s+persons?\b|\b(?:lawful\s+)?permanent residen(?:t|ts|cy|ce)\b|\bgreen card(?: holders?)?\b|\bprotected individuals?\b/i;
const EXPORT_CS = /\bITAR\b|\bEAR\b/;
const EXPORT_CI = /\bexport[- ]control(?:led|s)?\b|\bexport (?:administration )?regulations\b|\binternational traffic in arms\b|\bexport licens(?:e|es|ing)\b|\bdeemed exports?\b/i;
const CLEARANCE = /\b(?:security|secret|top secret|ts\/sci|ts-sci|dod|government|public trust|federal)\s+clearances?\b|\bclearances? (?:is |are )?(?:required|eligib\w*|preferred)\b|\b(?:obtain|maintain|hold|active|interim|eligible for) (?:an? )?(?:active |current )?(?:security |secret |government )?clearances?\b|\bTS\/SCI\b/i;
const NOT_REQUIRED = /\b(?:not|no)\b[^.;]{0,25}\b(?:required|needed|necessary)\b|\bis not a requirement\b/i;
const NO_SPONSOR = [
  /\b(?:not|unable to|cannot|can ?not|won'?t|will not|do(?:es)? not|no)\b[^.;]{0,60}\bsponsor(?:ship|ed|ing)?\b/i,
  /\bwithout (?:the )?(?:need for |requiring )?(?:current or future )?(?:visa |employer |immigration |work )?sponsorship\b/i,
  /\bsponsorship (?:is |will )?(?:not|un)\s?(?:available|offered|provided|possible)\b/i,
];
const SPONSOR_OK = /\b(?:will|can|do|does)\s+sponsor\b|\bsponsorship (?:is )?available\b/i;

export { FLAG_LABELS, RESTRICTIVE_FLAGS } from './labels.mjs';

export function detectFlags({ title = '', description = '' }) {
  const flags = new Set();
  const evidence = [];
  const sentences = [oneLine(title), ...splitSentences(description)];
  for (const s of sentences) {
    const eeo = EEO.test(s);
    let hit = false;
    if (EXPORT_CS.test(s) || EXPORT_CI.test(s)) { flags.add('export'); hit = true; }
    if (!eeo) {
      const notReq = NOT_REQUIRED.test(s);
      const cit = CITIZEN.test(s) && !notReq;
      const res = RESIDENCY.test(s) && !notReq;
      if (res) { flags.add('residency'); hit = true; }
      else if (cit) { flags.add('citizenship'); hit = true; }
      if (CLEARANCE.test(s) && !notReq) { flags.add('clearance'); hit = true; }
      if (NO_SPONSOR.some((re) => re.test(s)) && !SPONSOR_OK.test(s)) { flags.add('no_sponsorship'); hit = true; }
    }
    if (hit) evidence.push(s);
  }
  const order = ['citizenship', 'residency', 'export', 'clearance', 'no_sponsorship'];
  return { flags: order.filter((f) => flags.has(f)), evidence: [...new Set(evidence)] };
}

// ---------------------------------------------------------------- snippet
export function buildSnippet(classEvidence, flagEvidence, max = SNIPPET_MAX) {
  const parts = [];
  if (classEvidence[0]) parts.push(truncate(classEvidence[0], flagEvidence[0] ? 170 : max));
  if (flagEvidence[0]) {
    const used = parts.join(' ').length + (parts.length ? 1 : 0);
    const room = max - used;
    if (room > 40) parts.push(truncate(flagEvidence[0], room));
  }
  const s = parts.join(' ');
  return s.length > max ? truncate(s, max) : s;
}

// ---------------------------------------------------------------- main entry
export function classify(posting, { now = new Date() } = {}) {
  const title = oneLine(posting.title);
  const description = String(posting.description || '');
  const nowYear = (now instanceof Date ? now : new Date(now)).getUTCFullYear();
  const intern = detectInternship({ title, description, employmentType: posting.employmentType });
  let { terms } = extractTerms(title, nowYear, { maxAhead: 2 });
  if (!terms.length) {
    // Description terms: skip graduation-date sentences and look at most ~1 year ahead.
    const text = splitSentences(description).filter((x) => !GRAD_CONTEXT.test(x)).join('\n');
    terms = extractTerms(text, nowYear, { maxAhead: 1 }).terms.slice(0, 3);
  }
  const yh = terms.length ? null : (title.match(YEAR_ONLY_RE) || [])[1];
  const year_hint = yh && Math.abs(Number(yh) - nowYear) <= 2 ? Number(yh) : null;
  const hw = scoreHardware({ title, description, category: posting.category });
  const disciplines = hw.is_hardware ? assignDisciplines(hw.titleTags, hw.descHits) : [];
  const cy = detectClassYear({ title, description }, { now });
  const fl = detectFlags({ title, description });
  const snippet = buildSnippet(cy.evidence, fl.evidence);
  return {
    is_internship: intern.is_internship,
    type: intern.type,
    terms: sortTerms(terms),
    year_hint,
    disciplines,
    hw_score: hw.hw_score,
    is_hardware: hw.is_hardware,
    class_year: cy.class_year,
    flags: fl.flags,
    snippet,
    evidence: { class_year: cy.evidence, flags: fl.evidence },
    reasons: [...intern.reasons, ...hw.reasons],
  };
}
