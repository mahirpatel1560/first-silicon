// Scores the classifier against hand-labeled fixtures. Used by the unit test and the REPORT.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from '../../src/lib/classify.mjs';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'fixtures');

export function loadLabeled(name = 'labeled') {
  return JSON.parse(fs.readFileSync(path.join(DIR, `${name}.json`), 'utf8'));
}

const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

export function evaluate(name = 'labeled') {
  const data = loadLabeled(name);
  const now = new Date(data.now);
  const fields = ['is_internship', 'is_hardware', 'type', 'class_year', 'flags', 'terms', 'disciplines_include'];
  const tally = Object.fromEntries(fields.map((f) => [f, { right: 0, total: 0 }]));
  const misses = [];
  let casesAllRight = 0;
  for (const c of data.cases) {
    const r = classify({ title: c.title, description: c.description, employmentType: c.employmentType || '', category: c.category || '' }, { now });
    let allRight = true;
    for (const [field, want] of Object.entries(c.expect)) {
      let ok;
      let got;
      if (field === 'flags' || field === 'terms') { got = r[field]; ok = sameSet(got, want); }
      else if (field === 'disciplines_include') { got = r.disciplines; ok = want.every((d) => got.includes(d)); }
      else { got = r[field]; ok = got === want; }
      tally[field].total++;
      if (ok) tally[field].right++;
      else { allRight = false; misses.push({ id: c.id, title: c.title, field, want, got }); }
    }
    if (allRight) casesAllRight++;
  }
  const checks = Object.values(tally).reduce((a, t) => a + t.total, 0);
  const right = Object.values(tally).reduce((a, t) => a + t.right, 0);
  return { cases: data.cases.length, casesAllRight, checks, right, accuracy: right / checks, byField: tally, misses };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = evaluate(process.argv[2] || 'labeled');
  console.log(`cases ${r.cases}, fully correct ${r.casesAllRight}; checks ${r.right}/${r.checks} = ${(100 * r.accuracy).toFixed(1)}%`);
  for (const [f, t] of Object.entries(r.byField)) if (t.total) console.log(`  ${f.padEnd(20)} ${t.right}/${t.total}`);
  for (const m of r.misses) console.log('MISS', m.id, JSON.stringify(m.title), m.field, 'want', JSON.stringify(m.want), 'got', JSON.stringify(m.got));
}
