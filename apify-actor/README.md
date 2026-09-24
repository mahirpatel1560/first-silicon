# ATS Internship & Job Feed — Greenhouse, Lever, Ashby

Turn public **Greenhouse**, **Lever** and **Ashby** job boards into clean, labeled JSON. Give it board tokens or job-board URLs (or pick a preset of hardware-heavy employers) and get one dataset item per posting with:

- **Internship / co-op detection**: intern, internship, co-op, student and working-student roles. It excludes look-alikes such as "Internal Tools" and "International Trade", plus recruiter jobs that only mention interns.
- **Term**: `Summer 2027`, `Fall 2026`, `Spring 2027`, `Winter 2027`, including formats like `Summer/Fall 2026` and `Spring '27`.
- **Hardware discipline tags**: embedded/firmware, FPGA/RTL/ASIC, analog/mixed-signal, RF, power electronics, PCB/hardware design, test/validation, controls/robotics, semiconductor process/device, photonics. There is also a 0 to 100 hardware-relevance score.
- **Class year**: `fs` means the posting says freshmen, sophomores, first-years, second-years, rising juniors or all class years can apply, or gives a freshman/sophomore graduation year. `jplus` means junior/senior standing, an earlier graduation date or a graduate degree. `unspecified` means the posting does not say, which is the most common case; it does not mean juniors only.
- **Restriction flags**: US citizenship, US person / permanent residency, ITAR/EAR export control, security clearance and "no visa sponsorship". Equal-opportunity boilerplate is ignored.
- **Locations, regions and workplace** (remote, hybrid, onsite), plus publish date and pay when the board publishes it.

It never stores full job descriptions. Each item includes a link to the original posting and, optionally, an excerpt of at most 300 characters showing why a label was applied.

## Who it is for

- Career sites, student organizations and newsletters that list internships.
- Recruiters and researchers tracking hiring at a set of companies.
- Anyone who wants a daily, structured feed from company job boards without writing three different API clients.

## Input

| Field | Type | Default | What it does |
| --- | --- | --- | --- |
| `preset` | select | `hardware` | Curated employer lists: `hardware` (89 boards), `semiconductors`, `space_aerospace_defense`, `robotics_autonomy`, `energy_ev`, `devices_consumer_medical`, or `none`. |
| `companies` | list | | Boards to read: `greenhouse:TOKEN`, `lever:SITE`, `ashby:BOARD`, or a URL such as `https://boards.greenhouse.io/acme`, `https://jobs.lever.co/acme`, `https://jobs.ashbyhq.com/acme`. |
| `keywords` | list | | Keep postings whose title or description contains any keyword. |
| `internshipOnly` | boolean | `true` | Keep internships, co-ops and student roles only. |
| `hardwareOnly` | boolean | `false` | Keep hardware/EE roles only. |
| `disciplines` | multi-select | | Keep postings tagged with any selected discipline. |
| `classYear` | select | `any` | `any` (every posting), `fs`, `open` (anything but `jplus`, including postings that state no class year) or `jplus`. |
| `excludeRestricted` | boolean | `false` | Drop postings flagged for citizenship, permanent residency, export control or clearance. |
| `maxItems` | integer | `1000` | Stop after this many items. |
| `includeSnippet` | boolean | `true` | Include the evidence excerpt (at most 300 characters). |
| `requestDelayMs` | integer | `800` | Pause between boards. |

Example input:

```json
{
  "preset": "none",
  "companies": ["greenhouse:spacex", "lever:zoox", "https://jobs.ashbyhq.com/etched"],
  "internshipOnly": true,
  "hardwareOnly": true,
  "classYear": "open",
  "maxItems": 500
}
```

## Output

One item per posting. This example comes from the Actor's offline test fixtures, so the company is fictional:

```json
{
  "company": "Vireo Silicon",
  "title": "Design Verification Intern (Summer 2027)",
  "url": "https://job-boards.greenhouse.io/vireosilicon/jobs/7100137",
  "ats": "greenhouse",
  "boardToken": "vireosilicon",
  "sourceId": "7100137",
  "locations": ["San Jose, CA"],
  "regions": ["us"],
  "workplace": "onsite",
  "employmentType": null,
  "department": "Engineering",
  "isInternship": true,
  "type": "internship",
  "terms": ["Summer 2027"],
  "disciplines": ["digital"],
  "isHardware": true,
  "hardwareScore": 87,
  "classYear": "fs",
  "flags": [],
  "postedAt": "2026-09-21",
  "updatedAt": "2026-09-21",
  "pay": null,
  "snippet": "Open to undergraduates of all class years studying electrical or computer engineering.",
  "fetchedAt": "2026-09-24T03:23:37.648Z"
}
```

The dataset has two views: **Overview** (company, role, link, locations, terms, disciplines, class year, flags, posted date) and **Labels and evidence**. A `RUN_SUMMARY` record in the key-value store lists every board with its status and item count.

## Is this allowed?

The Actor only calls job-board endpoints that the ATS vendors publish for anyone to read, without logging in:

- Greenhouse's Job Board API documentation says job board data is publicly available and its GET endpoints need no authentication.
- Lever's postings API README says postings in the published state are publicly viewable.
- Ashby documents a public job posting API for job boards.

It reads no candidate or personal data, sends one request per board with a pause between boards, retries politely with backoff, honors `Retry-After`, and identifies itself with a descriptive User-Agent. It stores labels and short excerpts, not full descriptions, and every item links to the original posting. You are responsible for how you use the data, including any employer or vendor terms and the laws that apply to you. When you republish listings, link back to the original posting. This is not legal advice.

## Limits

- Only Greenhouse, Lever and Ashby. Employers on Workday, iCIMS, SmartRecruiters and similar systems are not supported.
- Labels come from pattern matching, not a human reading each posting. On 40 hand-written test cases set aside after tuning, 94% of label checks matched a person's judgment on first scoring. Real postings are messier, so treat labels as hints.
- Lever site names are case-sensitive (`CesiumAstro` works, `cesiumastro` does not).
- For boards you add yourself, the company name comes from Greenhouse's `company_name` field; for Lever and Ashby it is the board token.
- Presets were verified on 2026-09-23. Boards change; a board that disappears shows up as failed in `RUN_SUMMARY`.

## Pricing

Pay per result: you are charged for each item saved to the dataset (see the Pricing tab for the current rate). The run stops early when your maximum charge for the run is reached.

## FAQ

**How do I find a company's board token?** Open the company's careers page and look at a job link. `boards.greenhouse.io/acme/jobs/123` means `greenhouse:acme`, `jobs.lever.co/acme/...` means `lever:acme`, and `jobs.ashbyhq.com/acme/...` means `ashby:acme`. You can also paste those URLs directly.

**How fresh is the data?** Every run reads the boards live. Schedule the Actor daily to track changes.

**Why did an internship get `unspecified` for class year?** Most postings never mention it. `unspecified` does not mean juniors only. To find roles a first- or second-year student can apply to, use `classYear: "open"`: it keeps postings that say so plus every posting that does not state a class year.
