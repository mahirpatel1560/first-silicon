GITHUB LIST LAUNCH (the public repo is the second front door: a Simplify-style README table)

RULES
- GitHub Acceptable Use Policies (not fetched; UNVERIFIED): https://docs.github.com/en/site-policy/acceptable-use-policies
- Do not open unsolicited pull requests that add promotional links to unrelated repositories.

REPO SETUP CHECKLIST (github.com/mahirpatel1560/first-silicon; the daily Action produced real data on 2026-09-24)
1. Make sure the repo is public.
2. About / description (under 350 characters, no counts so it never goes stale):
   Every hardware, EE, embedded and semiconductor internship and co-op on hardware companies' public job boards, labeled by discipline, class year and ITAR/citizenship flags. Updated every morning.
3. Website field: https://firstsilicon.pages.dev/?ref=github
4. Topics: internships, hardware-internships, electrical-engineering, computer-engineering, embedded-systems,
   fpga, asic, semiconductors, co-op, student-jobs, summer-2027
   (The founder's research found no repos under the "hardware-internships" topic; check again before launch.)
5. Social preview: Settings > General > Social preview > upload src/static/og.png (re-upload it: the image now
   says "Every hardware internship, labeled.").
6. Turn on Issues. Add two issue templates: "Suggest an employer" (company, careers URL) and
   "Wrong label" (role link, which label, what the posting says).
7. Pin a first issue: "Which hardware companies are missing? Comment with the careers page link."
8. Check that Actions > "Daily data update" ran and that README.md shows the table.

WHERE TO SHARE THE REPO
- https://github.com/tramcar/awesome-job-boards is a curated list of niche job boards (checked 2026-09-23).
  It has no hardware or student category. Its CONTRIBUTING.md was not read (UNVERIFIED), so read it first.
  Propose adding First Silicon under "Tech", or suggest a small "Engineering / Hardware" section in the PR.
- Your own GitHub profile README: one line with the link.
- Show HN: see directories.txt (Show HN rules say lists and reading material are off-topic, so only
  post if you frame it around the open-source pipeline/classifier that people can run).

WHEN
Now that the daily run works, then again at the start of each recruiting season (late August for summer
internships). Any weekday morning US time is fine for GitHub.

NUMBERS IN THE BLURB (September 24, 2026 run; they change every morning)
Re-check on the day you post, from data/meta.json in the repo:
  191 = counts.roles   34 = counts.companies   4 / 15 / 172 = counts.fs / counts.jplus / counts.unspecified

LAUNCH BLURB (for the repo's first Discussion or a pinned issue)
This repo is updated every morning by a GitHub Action that reads hardware companies' public job boards (Greenhouse, Lever, Ashby) and keeps every hardware internship and co-op. Each row shows the discipline, the class year (Fr/So = the posting says freshmen or sophomores can apply, Jr+ = juniors or later, blank = not stated) and any US-citizenship/ITAR/clearance flags. On September 24 that was 191 roles at 34 companies: 4 Fr/So, 15 Jr+ and 172 with no class year stated. If you're a freshman or sophomore, read the blank ones too: apply unless the posting says juniors/seniors or a graduation date you can't meet. Labels are automatic, so please open a "Wrong label" issue when one is off. Missing a company? Open "Suggest an employer" with its careers page link. The filterable version is at https://firstsilicon.pages.dev/?ref=github
