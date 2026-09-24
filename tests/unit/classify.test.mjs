import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  classify, detectInternship, extractTerms, detectClassYear, detectFlags, scoreHardware, academicYearStart,
  classYearWindows, buildSnippet, sortTerms, SNIPPET_MAX,
} from '../../src/lib/classify.mjs';
import { evaluate } from '../lib/evaluate.mjs';

const NOW = new Date('2026-09-23T12:00:00Z');

test('labeled fixtures: >= 60 cases and per-field accuracy thresholds', () => {
  const r = evaluate('labeled');
  console.log(`labeled: ${r.cases} cases, ${r.right}/${r.checks} checks = ${(100 * r.accuracy).toFixed(1)}%`);
  for (const [f, t] of Object.entries(r.byField)) if (t.total) console.log(`  ${f}: ${t.right}/${t.total}`);
  for (const m of r.misses) console.log('  miss', m.id, m.field, JSON.stringify(m.want), JSON.stringify(m.got));
  assert.ok(r.cases >= 60, 'at least 60 labeled fixtures');
  assert.ok(r.accuracy >= 0.97, `overall accuracy ${r.accuracy}`);
  for (const [field, t] of Object.entries(r.byField)) {
    if (t.total) assert.ok(t.right / t.total >= 0.95, `${field} accuracy ${t.right}/${t.total}`);
  }
});

test('held-out fixtures: accuracy stays >= 0.90 (keeps the claim on /how-it-works honest)', () => {
  const r = evaluate('holdout');
  console.log(`holdout: ${r.cases} cases, ${r.right}/${r.checks} checks = ${(100 * r.accuracy).toFixed(1)}%`);
  for (const m of r.misses) console.log('  known miss', m.id, m.field);
  assert.ok(r.accuracy >= 0.9);
});

test('intern detection excludes internal/international and recruiter roles', () => {
  const yes = ['Hardware Intern', 'Firmware Internship', 'Co-op, Electrical', 'Electrical Coop', 'Student Researcher', 'Working Student Hardware', 'Werkstudent Elektronik', 'Intern, Photonics Test'];
  const no = ['Internal Audit Manager', 'International Sales Engineer', 'University Recruiter - Interns', 'Internship Program Coordinator', 'Postdoc, Devices', 'Student Loan Analyst', 'Senior Hardware Engineer'];
  for (const t of yes) assert.equal(detectInternship({ title: t }).is_internship, true, t);
  for (const t of no) assert.equal(detectInternship({ title: t }).is_internship, false, t);
  assert.equal(detectInternship({ title: 'Electrical Engineer', employmentType: 'Intern' }).is_internship, true, 'ATS employment type');
  assert.equal(detectInternship({ title: 'Electrical Coop' }).type, 'co-op');
  assert.equal(detectInternship({ title: 'General Application - Future Internships' }).is_internship, false, 'talent pool');
});

test('term extraction handles seasons, ranges, apostrophes and year-first formats', () => {
  assert.deepEqual(extractTerms('Summer 2027 Intern', 2026).terms, ['Summer 2027']);
  assert.deepEqual(extractTerms('Intern (Summer/Fall 2026)', 2026).terms, ['Summer 2026', 'Fall 2026']);
  assert.deepEqual(extractTerms("Intern - Spring '27", 2026).terms, ['Spring 2027']);
  assert.deepEqual(extractTerms('2027 Summer Intern', 2026).terms, ['Summer 2027']);
  assert.deepEqual(extractTerms('Autumn 2026 co-op', 2026).terms, ['Fall 2026']);
  assert.deepEqual(extractTerms('Summer 2031', 2026).terms, [], 'far-future years ignored');
  assert.deepEqual(sortTerms(['Summer 2027', 'Fall 2026', 'Spring 2027']), ['Fall 2026', 'Spring 2027', 'Summer 2027']);
  const c = classify({ title: 'Hardware Engineering Intern', description: 'Students graduating in Spring 2029 may apply. The internship runs Summer 2027.' }, { now: NOW });
  assert.deepEqual(c.terms, ['Summer 2027'], 'graduation sentence is not a term');
  assert.equal(classify({ title: '2027 Hardware Engineer Intern', description: '' }, { now: NOW }).year_hint, 2027);
});

test('class-year windows move with the academic year', () => {
  assert.equal(academicYearStart(new Date('2026-09-23T00:00:00Z')), 2026);
  assert.equal(academicYearStart(new Date('2027-03-01T00:00:00Z')), 2026);
  assert.equal(academicYearStart(new Date('2027-07-15T00:00:00Z')), 2027);
  assert.deepEqual(classYearWindows(NOW), { fs: [2029, 2030], jplus: [2027, 2028] });
  const d = { title: 'Hardware Intern', description: 'Expected graduation in May 2029.' };
  assert.equal(detectClassYear(d, { now: NOW }).class_year, 'fs');
  assert.equal(detectClassYear(d, { now: new Date('2027-09-01T00:00:00Z') }).class_year, 'jplus', 'a year later, 2029 grads are juniors');
});

test('class year: negation, completed sophomore year, graduate-only and mixed statements', () => {
  const cy = (description, title = 'Hardware Intern') => detectClassYear({ title, description }, { now: NOW }).class_year;
  assert.equal(cy('Freshmen and sophomores are not eligible.'), 'jplus');
  assert.equal(cy('Must have completed sophomore year.'), 'jplus');
  assert.equal(cy('Rising juniors and seniors only.'), 'fs');
  assert.equal(cy('Open to sophomores, juniors and seniors.'), 'fs');
  assert.equal(cy('Pursuing a PhD in EE.'), 'jplus');
  assert.equal(cy('Pursuing a BS or MS in EE.'), 'unspecified');
  assert.equal(cy('Great first year for the team!'), 'unspecified', '"first year" without student context');
  assert.equal(cy('', 'PhD Intern - Analog'), 'jplus');
  assert.equal(cy('', 'Sophomore Hardware Intern'), 'fs');
});

test('flags ignore EEO boilerplate and "not required" statements', () => {
  const f = (d) => detectFlags({ title: 'Hardware Intern', description: d }).flags;
  assert.deepEqual(f('We do not discriminate on the basis of citizenship status or national origin.'), []);
  assert.deepEqual(f('U.S. citizenship is not required.'), []);
  assert.deepEqual(f('Must be a U.S. citizen.'), ['citizenship']);
  assert.deepEqual(f('Due to ITAR, applicants must be U.S. persons.'), ['residency', 'export']);
  assert.deepEqual(f('Requires an active TS/SCI clearance.'), ['clearance']);
  assert.deepEqual(f('This role involves EAR-controlled technology.'), ['export']);
  assert.deepEqual(f('We will not sponsor work visas.'), ['no_sponsorship']);
  assert.deepEqual(f('Visa sponsorship is available.'), []);
  assert.deepEqual(f('The ear canal sensor team.'), [], 'lowercase "ear" is not EAR');
});

test('hardware score: software titles are excluded unless hardware-facing', () => {
  const hw = (title, description = '', category = '') => scoreHardware({ title, description, category }).is_hardware;
  assert.equal(hw('Software Engineering Intern', 'React and SQL'), false);
  assert.equal(hw('Embedded Software Intern', 'C on microcontrollers'), true);
  assert.equal(hw('Software Engineer Intern, Robotics', 'motion control on robot hardware'), true);
  assert.equal(hw('Marketing Intern'), false);
  assert.equal(hw('Process Engineering Intern', 'leaching and solvent extraction', 'energy'), false);
  assert.equal(hw('Process Engineering Intern', 'lithography and etch', 'semiconductors'), true);
});

test('snippets never exceed 300 characters and prefer class-year evidence', () => {
  const long = 'Open to sophomores and juniors studying electrical engineering, computer engineering, physics or related fields at any accredited university in the United States or abroad, provided they return to school after the internship and can work full time for twelve weeks. '.repeat(3);
  const c = classify({ title: 'Hardware Intern', description: `${long} Must be a U.S. citizen.` }, { now: NOW });
  assert.ok(c.snippet.length <= SNIPPET_MAX);
  assert.match(c.snippet, /^Open to sophomores/);
  assert.equal(buildSnippet([], []), '');
  assert.ok(buildSnippet(['a'.repeat(500)], ['b'.repeat(500)]).length <= 300);
});

test('classify is deterministic', () => {
  const p = { title: 'FPGA Intern (Summer 2027)', description: 'Verilog, Vivado, testbenches. Open to all class years. ITAR applies.' };
  assert.deepEqual(classify(p, { now: NOW }), classify(p, { now: NOW }));
});
