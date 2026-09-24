// Polite JSON fetching: identifying User-Agent, timeout, retries with exponential backoff,
// Retry-After support, and no retries on 4xx other than 429.

export const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Parse a Retry-After header (seconds or HTTP date). Returns milliseconds (capped) or null. */
export function parseRetryAfter(value, nowMs = Date.now(), capMs = 60000) {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Math.min(capMs, Math.round(Number(s) * 1000));
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.min(capMs, t - nowMs));
}

/** Exponential backoff: base, 2x base, 4x base ... capped at 30 s. */
export function backoffMs(attempt, baseMs = 1000) {
  return Math.min(30000, baseMs * 2 ** Math.max(0, attempt - 1));
}

/**
 * GET a URL and parse JSON.
 * @returns {Promise<{ok: boolean, status: number, data?: any, error?: string, attempts: number}>}
 */
export async function fetchJson(url, opts = {}) {
  const {
    fetchImpl = globalThis.fetch,
    userAgent = 'FirstSiliconBot/1.0',
    timeoutMs = 20000,
    retries = 3,
    baseDelayMs = 1000,
    sleep = defaultSleep,
  } = opts;
  let attempt = 0;
  for (;;) {
    attempt++;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(url, {
        headers: { 'User-Agent': userAgent, Accept: 'application/json' },
        signal: ctrl.signal,
        redirect: 'follow',
      });
    } catch (err) {
      clearTimeout(timer);
      const error = err && err.name === 'AbortError' ? 'timeout' : 'network';
      if (attempt > retries) return { ok: false, status: 0, error, attempts: attempt };
      await sleep(backoffMs(attempt, baseDelayMs));
      continue;
    }
    clearTimeout(timer);
    if (res.status === 429 || res.status >= 500) {
      if (attempt > retries) return { ok: false, status: res.status, error: `http_${res.status}`, attempts: attempt };
      const header = res.headers && typeof res.headers.get === 'function' ? res.headers.get('retry-after') : null;
      const wait = parseRetryAfter(header) ?? backoffMs(attempt, baseDelayMs);
      await sleep(wait);
      continue;
    }
    if (res.status === 404) return { ok: false, status: 404, error: 'not_found', attempts: attempt };
    if (!res.ok) return { ok: false, status: res.status, error: `http_${res.status}`, attempts: attempt };
    let text;
    try {
      text = await res.text();
    } catch {
      if (attempt > retries) return { ok: false, status: res.status, error: 'read_failed', attempts: attempt };
      await sleep(backoffMs(attempt, baseDelayMs));
      continue;
    }
    try {
      return { ok: true, status: res.status, data: JSON.parse(text), attempts: attempt };
    } catch {
      return { ok: false, status: res.status, error: 'bad_json', attempts: attempt };
    }
  }
}
