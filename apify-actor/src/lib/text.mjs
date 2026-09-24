// Pure text helpers shared by fetchers, classifier, README and newsletter generators.

const NAMED = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', bull: '•', middot: '·',
  copy: '©', reg: '®', trade: '™', deg: '°', plusmn: '±', times: '×', micro: 'µ',
  ohm: 'Ω', Omega: 'Ω', mu: 'μ', eacute: 'é', ouml: 'ö', uuml: 'ü', auml: 'ä', szlig: 'ß',
  zwj: '', zwnj: '', shy: '', ensp: ' ', emsp: ' ', thinsp: ' ',
};

/** Decode HTML entities (named, decimal, hex). Unknown named entities are left as-is. */
export function decodeEntities(input) {
  if (input == null) return '';
  return String(input).replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, body) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return m;
      try { return String.fromCodePoint(code); } catch { return m; }
    }
    return Object.prototype.hasOwnProperty.call(NAMED, body) ? NAMED[body] : m;
  });
}

/** Convert an HTML fragment to plain text, keeping block boundaries as newlines. */
export function htmlToText(html) {
  if (!html) return '';
  let s = String(html);
  s = s.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ');
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|table|section|article|blockquote)>/gi, '\n');
  s = s.replace(/<li[^>]*>/gi, '\n• ');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  return normalizeWhitespace(s);
}

/** Greenhouse `content` is HTML that has itself been entity-escaped once. */
export function greenhouseContentToText(content) {
  if (!content) return '';
  return htmlToText(decodeEntities(content));
}

export function normalizeWhitespace(s) {
  return String(s || '')
    .replace(/ /g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Collapse all whitespace (for single-line display). */
export function oneLine(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

/**
 * Split text into sentence-like chunks. Bullets and line breaks end a chunk too,
 * because job posts are mostly bullet lists.
 */
export function splitSentences(text) {
  if (!text) return [];
  const out = [];
  const lines = String(text).split(/\n+/).flatMap((l) => l.split(/\s[•·▪]\s/));
  for (const line of lines) {
    const cleaned = line.replace(/^[•\-*·▪\s]+/, '').trim();
    if (!cleaned) continue;
    // Split on sentence punctuation followed by space + capital/digit/quote. Keep abbreviations
    // like "U.S. citizen" intact by requiring 2+ lowercase letters before the period.
    const parts = cleaned.split(/(?<=[a-z0-9\)]{2}[.!?;])\s+(?=[A-Z0-9"“(])/);
    for (const p of parts) {
      const t = p.trim();
      if (t) out.push(t);
    }
  }
  return out;
}

/** Truncate to max characters on a word boundary, adding an ellipsis when cut. */
export function truncate(s, max) {
  const str = oneLine(s);
  if (str.length <= max) return str;
  const cut = str.slice(0, Math.max(0, max - 1));
  const lastSpace = cut.lastIndexOf(' ');
  const base = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut;
  return base.replace(/[\s,;:.\-–—]+$/, '') + '…';
}

/** Escape text for HTML element content and attribute values. */
export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escape text for a Markdown table cell. */
export function escapeMdCell(s) {
  return oneLine(s).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

/** Lowercase slug: letters, digits and single dashes. */
export function slugify(s) {
  return String(s || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** ISO date (YYYY-MM-DD) from a Date, ms number or date-ish string; null when invalid. */
export function isoDate(value) {
  if (value == null || value === '') return null;
  const d = value instanceof Date ? value : new Date(typeof value === 'number' ? value : String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

/** Whole days between two ISO dates (b - a). */
export function daysBetween(a, b) {
  const da = Date.parse(a + (a.length === 10 ? 'T00:00:00Z' : ''));
  const db = Date.parse(b + (b.length === 10 ? 'T00:00:00Z' : ''));
  if (Number.isNaN(da) || Number.isNaN(db)) return NaN;
  return Math.round((db - da) / 86400000);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "Sep 23" (or "Sep 23, 2025" when the year differs from refYear). */
export function shortDate(iso, refYear) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  const base = `${MONTHS[m - 1]} ${d}`;
  return refYear && refYear !== y ? `${base}, ${y}` : base;
}

/** "September 23, 2026". */
export function longDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  if (!y || !m || !d) return '';
  return `${MONTHS_LONG[m - 1]} ${d}, ${y}`;
}

/** Deterministic 32-bit FNV-1a hash as base36 (for stable ids without crypto). */
export function hashId(s) {
  let h = 0x811c9dc5;
  const str = String(s);
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // second round with a different seed to reduce collisions
  let h2 = 0x01000193;
  for (let i = str.length - 1; i >= 0; i--) {
    h2 ^= str.charCodeAt(i);
    h2 = Math.imul(h2, 0x5bd1e995) >>> 0;
  }
  return h.toString(36).padStart(7, '0') + h2.toString(36).padStart(7, '0');
}
