import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heroSubhead, classYearGuidance, homeDescription } from '../../src/lib/copy.mjs';
import * as site from '../../config/site.mjs';

test('headline is the new positioning, with no class-year promise', () => {
  assert.equal(site.TAGLINE, 'Every hardware internship, labeled.');
  assert.doesNotMatch(site.TAGLINE, /freshm|sophom/i);
});

test('subhead puts the role and company counts in the sentence', () => {
  assert.equal(
    heroSubhead({ roles: 191, companies: 34 }),
    "191 internships and co-ops at 34 companies — PCB, embedded, RF, test, silicon — tagged by class year, discipline and citizenship. Updated every morning from the companies' own job boards.",
  );
  assert.match(heroSubhead({ roles: 1234, companies: 101 }), /^1,234 internships and co-ops at 101 companies — /);
  assert.match(heroSubhead({ roles: 1, companies: 1 }), /^1 internship or co-op at 1 company — .* from the company's own job board\.$/);
});

test('class-year guidance: counts, "Only" while explicit Fr/So roles are under a quarter, singular/plural and zero cases', () => {
  const tail = "unless the posting says juniors/seniors or a graduation date you can't meet.";
  assert.equal(
    classYearGuidance({ roles: 191, fs: 4, unspecified: 172 }),
    `Only 4 postings say freshmen or sophomores can apply. 172 don't list a class year at all: apply to those ${tail}`,
  );
  assert.equal(classYearGuidance({ roles: 5, fs: 1, unspecified: 3 }), `Only 1 posting says freshmen or sophomores can apply. 3 don't list a class year at all: apply to those ${tail}`);
  assert.equal(classYearGuidance({ roles: 4, fs: 2, unspecified: 1 }), `2 postings say freshmen or sophomores can apply. 1 doesn't list a class year at all: apply to it ${tail}`);
  assert.equal(classYearGuidance({ roles: 10, fs: 0, unspecified: 10 }), `No postings say freshmen or sophomores can apply right now. 10 don't list a class year at all: apply to those ${tail}`);
  assert.equal(classYearGuidance({ roles: 3, fs: 3, unspecified: 0 }), '3 postings say freshmen or sophomores can apply.');
  assert.match(classYearGuidance({ roles: 2000, fs: 12, unspecified: 1500 }), /^Only 12 postings say freshmen or sophomores can apply\. 1,500 don't list/);
  assert.equal(classYearGuidance({ roles: 0, fs: 0, unspecified: 0 }), '', 'no guidance before the first data run');
});

test('home meta description: counts when it fits in 155 characters, number-free otherwise', () => {
  const d = homeDescription({ roles: 191, companies: 34 });
  assert.equal(d, '191 hardware internships and co-ops at 34 companies, labeled by discipline, class year and citizenship. Updated every morning.');
  assert.ok(d.length >= 50 && d.length <= 155);
  const pending = homeDescription({});
  assert.doesNotMatch(pending, /\d/);
  assert.ok(pending.length >= 50 && pending.length <= 155);
  assert.ok(homeDescription({ roles: 123456789, companies: 123456789 }).length <= 155);
});
