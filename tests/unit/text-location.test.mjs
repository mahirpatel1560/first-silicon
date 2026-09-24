import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decodeEntities, htmlToText, greenhouseContentToText, splitSentences, truncate, escapeHtml, escapeMdCell,
  slugify, isoDate, daysBetween, shortDate, longDate, hashId,
} from '../../src/lib/text.mjs';
import { splitLocations, normalizeLocations, regionOf, detectRegions, detectWorkplace, displayLocations, shortenLocation } from '../../src/lib/location.mjs';

test('entity decoding and HTML to text', () => {
  assert.equal(decodeEntities('R&amp;D &lt;b&gt; &#8211; &#x2014;'), 'R&D <b> – —');
  assert.equal(decodeEntities('a&nbsp;b &unknown;'), 'a b &unknown;');
  const txt = htmlToText('<p>Hello <b>world</b></p><ul><li>One</li><li>Two</li></ul><script>x()</script>');
  assert.deepEqual(txt.split(/\n+/), ['Hello world', '• One', '• Two']);
  assert.doesNotMatch(txt, /x\(\)/, 'script content removed');
  assert.equal(greenhouseContentToText('&lt;p&gt;Pay &amp;amp; perks&lt;/p&gt;'), 'Pay & perks');
});

test('sentence splitting keeps U.S. abbreviations together', () => {
  const s = splitSentences('Must be a U.S. citizen. Open to sophomores! • Bullet item\nNext line here.');
  assert.deepEqual(s, ['Must be a U.S. citizen.', 'Open to sophomores!', 'Bullet item', 'Next line here.']);
});

test('truncate, escaping, slugs and dates', () => {
  assert.equal(truncate('short', 10), 'short');
  const t = truncate('word '.repeat(100), 50);
  assert.ok(t.length <= 50 && t.endsWith('…'));
  assert.equal(escapeHtml(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  assert.equal(escapeMdCell('A | B [x]\nC'), 'A \\| B \\[x\\] C');
  assert.equal(slugify('Ōura & Co. Robotics!'), 'oura-and-co-robotics');
  assert.equal(isoDate('2026-09-21T10:15:00-07:00'), '2026-09-21');
  assert.equal(isoDate(1777936261125), '2026-05-04');
  assert.equal(isoDate('garbage'), null);
  assert.equal(daysBetween('2026-09-16', '2026-09-23'), 7);
  assert.equal(shortDate('2026-09-03', 2026), 'Sep 3');
  assert.equal(shortDate('2025-12-30', 2026), 'Dec 30, 2025');
  assert.equal(longDate('2027-02-26'), 'February 26, 2027');
  assert.equal(hashId('a|b'), hashId('a|b'));
  assert.notEqual(hashId('a|b'), hashId('a|c'));
});

test('location splitting and normalization', () => {
  assert.deepEqual(splitLocations('Austin, TX; San Jose, CA | Remote'), ['Austin, TX', 'San Jose, CA', 'Remote']);
  assert.deepEqual(normalizeLocations(['Austin, TX', 'austin, tx', 'Boston, MA / Denver, CO']), ['Austin, TX', 'Boston, MA', 'Denver, CO']);
});

test('region detection', () => {
  assert.equal(regionOf('Hawthorne, CA'), 'us');
  assert.equal(regionOf('Austin, Texas, United States'), 'us');
  assert.equal(regionOf('Remote - US'), 'us');
  assert.equal(regionOf('Seattle'), 'us');
  assert.equal(regionOf('Redmond, Washington'), 'us');
  assert.equal(regionOf('Toronto, ON'), 'ca');
  assert.equal(regionOf('Vancouver, British Columbia, Canada'), 'ca');
  assert.equal(regionOf('Munich, Germany'), 'eu');
  assert.equal(regionOf('London, UK'), 'eu');
  assert.equal(regionOf('Hsinchu, Taiwan'), 'asia');
  assert.equal(regionOf('Tel Aviv, Israel'), 'other');
  assert.equal(regionOf('Remote'), null);
  assert.deepEqual(detectRegions(['Remote'], 'US'), ['us']);
  assert.deepEqual(detectRegions(['Munich'], 'DE'), ['eu']);
  assert.deepEqual(detectRegions(['San Jose, CA', 'Taipei, Taiwan']), ['us', 'asia']);
});

test('workplace detection from ATS hints and text', () => {
  assert.equal(detectWorkplace(['Pittsburgh, PA'], 'hybrid'), 'hybrid');
  assert.equal(detectWorkplace(['Tucson, AZ'], 'OnSite', false), 'onsite');
  assert.equal(detectWorkplace(['Anywhere'], 'Remote', true), 'remote');
  assert.equal(detectWorkplace(['Remote - US'], null, null), 'remote');
  assert.equal(detectWorkplace(['Hybrid - Boston, MA'], null, null), 'hybrid');
  assert.equal(detectWorkplace([], null, null), 'unknown');
});

test('location display', () => {
  assert.equal(shortenLocation('Austin, Texas, United States'), 'Austin, TX');
  assert.equal(shortenLocation('Toronto, ON, Canada'), 'Toronto, ON, Canada');
  assert.equal(displayLocations([]), 'Location not listed');
  assert.equal(displayLocations(['A, CA', 'B, TX', 'C, MA']), 'A, CA; B, TX +1 more');
});
