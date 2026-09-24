// Browser entry: role finder (filters, URL state, data refresh) + lead forms + analytics hooks.
// Works without the Pulse script: every analytics call is guarded.

import { parseState, serializeState, applyFilters, facets, classYearOptionCounts, isActive, DEFAULT_STATE } from './filters.mjs';
import { rolesHtml } from './render.mjs';
import { initForms } from './forms.mjs';
import { classYearGuidance } from '../../lib/copy.mjs';

const PAGE = 50;

function safe(fn) {
  try {
    return fn();
  } catch {
    return undefined;
  }
}
function track(type, props) {
  if (typeof window.pulse === 'function') safe(() => window.pulse(type, props || {}));
}
function activateOnce(via) {
  if (safe(() => sessionStorage.getItem('fs_activated'))) return;
  safe(() => sessionStorage.setItem('fs_activated', '1'));
  track('activate', { via });
}

async function fetchJson(url, timeoutMs) {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs || 8000) : null;
  try {
    const res = await fetch(url, { signal: ctrl ? ctrl.signal : undefined, cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Latest data: the public repo copy when configured and newer, else the bundled copy. */
async function loadJobs(rawBase, bundledRun) {
  if (rawBase) {
    try {
      const remote = await fetchJson(`${rawBase.replace(/\/$/, '')}/data/jobs.json`, 4000);
      if (remote && Array.isArray(remote.jobs) && String(remote.generated_at || '') >= String(bundledRun || '')) {
        return { jobs: remote.jobs, generatedAt: remote.generated_at, source: 'repo' };
      }
    } catch {
      /* fall back to the bundled copy */
    }
  }
  const local = await fetchJson('/data/jobs.json', 8000);
  return { jobs: local.jobs || [], generatedAt: local.generated_at, source: 'bundled' };
}

function readForm(form) {
  const v = (name) => {
    const el = form.elements.namedItem(name);
    return el ? el.value : '';
  };
  const c = (name) => {
    const el = form.elements.namedItem(name);
    return Boolean(el && el.checked);
  };
  return { q: v('q').trim().slice(0, 80), d: v('d'), cy: v('cy'), t: v('t'), loc: v('loc'), cf: c('cf'), nw: c('new') };
}

function writeForm(form, s) {
  const set = (name, val) => {
    const el = form.elements.namedItem(name);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = Boolean(val);
    else if (el.tagName === 'SELECT' && val && ![...el.options].some((o) => o.value === val)) {
      const o = document.createElement('option');
      o.value = val;
      o.textContent = val;
      el.appendChild(o);
      el.value = val;
    } else el.value = val || '';
  };
  set('q', s.q);
  set('d', s.d);
  set('cy', s.cy);
  set('t', s.t);
  set('loc', s.loc);
  set('cf', s.cf);
  set('new', s.nw);
}

/** Refresh option labels with live counts; rebuild the term list from the data. */
function updateFacetLabels(form, jobs) {
  const f = facets(jobs);
  const relabel = (select, countFor) => {
    if (!select) return;
    for (const o of select.options) {
      if (!o.value) continue;
      const base = o.getAttribute('data-label') || o.textContent.replace(/\s*\(\d+\)$/, '');
      o.setAttribute('data-label', base);
      o.textContent = `${base} (${countFor(o.value)})`;
    }
  };
  relabel(form.elements.namedItem('d'), (v) => f.disciplines[v] || 0);
  const cyCounts = classYearOptionCounts(f);
  relabel(form.elements.namedItem('cy'), (v) => cyCounts[v] || 0);
  // Class-year guidance next to the filter: same text as the build, from the list actually loaded.
  const guide = document.getElementById('cy-guide');
  if (guide) {
    const text = classYearGuidance({ roles: jobs.length, fs: f.classYears.fs, unspecified: f.classYears.unspecified });
    if (guide.textContent !== text) guide.textContent = text;
    guide.hidden = !text;
  }
  const t = form.elements.namedItem('t');
  if (t) {
    const current = t.value;
    const opts = [['', 'Any term']]
      .concat(f.terms.map((x) => [x.term, `${x.term} (${x.count})`]))
      .concat([['coop', `Co-ops only (${f.coop})`], ['none', `Term not stated (${f.noterm})`]]);
    t.innerHTML = '';
    for (const [value, label] of opts) {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = label;
      t.appendChild(o);
    }
    t.value = opts.some(([v]) => v === current) ? current : '';
  }
}

function initFinder() {
  const root = document.getElementById('finder');
  if (!root) return;
  const form = root.querySelector('#filters');
  const list = root.querySelector('#roles');
  const count = root.querySelector('#result-count');
  const more = root.querySelector('#more');
  const notice = root.querySelector('#data-notice');
  const newDays = Number(root.getAttribute('data-new-days') || 7);
  const rawBase = root.getAttribute('data-raw-base') || '';
  const bundledRun = root.getAttribute('data-last-run') || '';
  const today = new Date().toISOString().slice(0, 10);
  let jobs = null;
  let shown = PAGE;
  let state = parseState(window.location.search);
  let searchTimer = null;
  let lastFiltered = [];
  writeForm(form, state);

  const render = ({ focusFrom = -1 } = {}) => {
    if (!jobs) return;
    const filtered = applyFilters(jobs, state, today, newDays);
    lastFiltered = filtered;
    const slice = filtered.slice(0, shown);
    if (slice.length) {
      list.innerHTML = rolesHtml(slice, { today, newDays });
    } else if (!jobs.length) {
      list.innerHTML = '<li class="empty">No roles yet: the first automatic update has not run. The <a href="/programs/">programs calendar</a> is ready now, and you can <a href="/newsletter/">get the weekly email</a>.</li>';
    } else {
      list.innerHTML = '<li class="empty">No roles match these filters. Try removing one, or <button type="button" class="linklike" data-reset>reset all filters</button>.</li>';
    }
    count.textContent = !jobs.length
      ? 'No roles yet'
      : isActive(state)
        ? `Showing ${Math.min(shown, filtered.length)} of ${filtered.length} matching roles (${jobs.length} total)`
        : `Showing ${Math.min(shown, filtered.length)} of ${jobs.length} roles, newest first`;
    more.hidden = filtered.length <= shown;
    if (focusFrom >= 0) {
      const items = list.querySelectorAll('.role .role-title');
      if (items[focusFrom]) items[focusFrom].focus();
    }
  };

  const onChange = (source) => {
    state = readForm(form);
    shown = PAGE;
    safe(() => window.history.replaceState(null, '', window.location.pathname + serializeState(state) + window.location.hash));
    render();
    if (isActive(state)) activateOnce('filter');
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      track('search', {
        d: state.d || '-',
        cy: state.cy || '-',
        t: state.t || '-',
        loc: state.loc || '-',
        cf: state.cf ? 1 : 0,
        nw: state.nw ? 1 : 0,
        q: state.q ? 1 : 0,
        n: lastFiltered.length,
        via: source,
      });
    }, 1500);
  };

  let inputTimer = null;
  form.addEventListener('input', (e) => {
    if (e.target && e.target.name === 'q') {
      clearTimeout(inputTimer);
      inputTimer = setTimeout(() => onChange('search'), 180);
    }
  });
  form.addEventListener('change', (e) => {
    if (e.target && e.target.name !== 'q') onChange(e.target.name);
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    onChange('submit');
  });
  const reset = () => {
    state = { ...DEFAULT_STATE };
    writeForm(form, state);
    onChange('reset');
  };
  root.addEventListener('click', (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('[data-reset]')) {
      e.preventDefault();
      reset();
      const q = form.elements.namedItem('q');
      if (q) q.focus();
      return;
    }
    const link = t.closest('a.role-title');
    if (link) {
      const li = link.closest('.role');
      const job = jobs && li ? jobs.find((j) => j.id === li.getAttribute('data-id')) : null;
      track('outbound', {
        company: (link.getAttribute('data-company') || '').slice(0, 40),
        d: job && job.disciplines ? job.disciplines[0] : '-',
        cy: job ? job.class_year : '-',
      });
      activateOnce('role');
    }
  });
  more.addEventListener('click', () => {
    const from = shown;
    shown += PAGE;
    render({ focusFrom: from });
  });

  loadJobs(rawBase, bundledRun).then(
    (data) => {
      jobs = data.jobs;
      updateFacetLabels(form, jobs);
      writeForm(form, state);
      if (notice && data.source === 'repo') {
        notice.textContent = `Loaded the latest list from the public data repo (updated ${String(data.generatedAt || '').slice(0, 10)}).`;
        notice.hidden = false;
      }
      root.classList.add('is-live');
      render();
    },
    () => {
      if (notice) {
        notice.textContent = 'Could not load the full list. Showing the newest roles only; filters are unavailable right now.';
        notice.hidden = false;
      }
      track('error', { where: 'jobs_load' });
    },
  );
}

function boot() {
  initFinder();
  initForms();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
