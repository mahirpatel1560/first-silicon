// Single source of truth for site-wide settings.
// Custom domain later? Change BASE_URL (one line), rebuild with `node build.mjs`, redeploy dist/.

export const BASE_URL = 'https://firstsilicon.pages.dev';

// Raw GitHub base for the public data repo, e.g.
// 'https://raw.githubusercontent.com/<github-user>/firstsilicon/main'
// Leave empty until the founder creates the public repo. When set, the site loads
// `${REPO_RAW_BASE}/data/jobs.json` at runtime (and falls back to the bundled copy),
// and the build adds the raw host to the CSP connect-src automatically.
export const REPO_RAW_BASE = 'https://raw.githubusercontent.com/mahirpatel1560/first-silicon/main';

// Public repo URL shown on /how-it-works and in the README once it exists (empty = hidden).
export const REPO_URL = 'https://github.com/mahirpatel1560/first-silicon';

export const SITE_NAME = 'First Silicon';
export const SITE_KEY = 'fs'; // Portfolio Pulse site key
export const PULSE_ORIGIN = 'https://pulse.ringlatch.workers.dev';
export const PULSE_SRC = `${PULSE_ORIGIN}/pulse.js`;

export const TAGLINE = 'Hardware internships you can apply to as a freshman or sophomore.';
export const DESCRIPTION =
  'Hardware, EE, embedded and semiconductor internships and co-ops from employer job boards, labeled by discipline, class year and citizenship flags. Updated daily.';

export const FOUNDER_LINE =
  'Built by Mahir Patel, an electrical-engineering student at the University of Illinois Urbana-Champaign.';

// Discipline pages are generated only when at least this many open roles carry the tag.
export const MIN_ROLES_FOR_DISCIPLINE_PAGE = 5;

// "New this week" window (days) used by the badge, README and newsletter.
export const NEW_DAYS = 7;

// Sponsorship placeholder threshold shown on /sponsor (a policy, not a claim).
export const SPONSOR_THRESHOLD = 1000;

// Crawler identity for the job-board fetchers.
export const USER_AGENT = `FirstSiliconBot/1.0 (+${BASE_URL}/how-it-works/; daily fetch of public job-board APIs)`;

// Fetch politeness.
export const FETCH_DELAY_MS = 900; // pause between requests (sequential)
export const FETCH_TIMEOUT_MS = 20000;
export const FETCH_RETRIES = 3;

// Number of roles server-rendered into the landing HTML (the rest load from data/jobs.json).
export const SSR_ROWS = 30;
// Number of roles placed in the landing ItemList JSON-LD.
export const ITEMLIST_MAX = 50;

// Contact address is intentionally not published; the contact form posts to Pulse.
export const CONTENT_UPDATED = '2026-09-23'; // date the static copy was last reviewed

// Shown on /how-it-works. Keep it true: tests/unit/classify.test.mjs asserts the held-out score stays >= 0.9.
export const LABEL_ACCURACY_NOTE =
  'On 40 hand-written test cases set aside after the rules were tuned, 94% of label checks matched a person\'s judgment the first time they were scored.';
