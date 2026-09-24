GITHUB LIST LAUNCH (the public repo is the second front door: a Simplify-style README table)

RULES
- GitHub Acceptable Use Policies (not fetched; UNVERIFIED): https://docs.github.com/en/site-policy/acceptable-use-policies
- Do not open unsolicited pull requests that add promotional links to unrelated repositories.

SET UP THE REPO (after DEPLOY.txt step 0 has produced real data)
1. Name: firstsilicon (or hardware-internships). Public.
2. About / description (under 350 characters):
   Hardware, EE, embedded and semiconductor internships and co-ops, updated daily from employers' public job boards, labeled by discipline, class year (Fr/So friendly) and ITAR/citizenship flags.
3. Website field: https://firstsilicon.pages.dev/?ref=github
4. Topics: internships, hardware-internships, electrical-engineering, computer-engineering, embedded-systems,
   fpga, asic, semiconductors, co-op, student-jobs, summer-2027
   (The founder's research found no repos under the "hardware-internships" topic; check again before launch.)
5. Social preview: Settings > General > Social preview > upload src/static/og.png.
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
Right after the first successful daily run, then again at the start of each recruiting season
(late August for summer internships). Any weekday morning US time is fine for GitHub.

LAUNCH BLURB (for the repo's first Discussion or a pinned issue)
Welcome! This repo is updated every morning by a GitHub Action that reads hardware employers' public job boards (Greenhouse, Lever, Ashby) and keeps the internships and co-ops. Each row shows the discipline, a class-year signal (Fr/So = the posting mentions freshman or sophomore eligibility) and any US-citizenship/ITAR/clearance flags. Labels are automatic, so please open a "Wrong label" issue when one is off. Missing a company? Open "Suggest an employer" with its careers page link. The filterable version is at https://firstsilicon.pages.dev/?ref=github
