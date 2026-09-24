// Lead forms (subscribe, contact, sponsor) posting through Portfolio Pulse's pulseLead().
// The site must work when the Pulse script is missing or blocked: never lose typed text.

const FALLBACK = "Couldn't send. Please try again later.";

function setStatus(form, text, kind) {
  const el = form.querySelector('[data-status]');
  if (!el) return;
  el.textContent = text;
  el.className = `form-status ${kind || ''}`.trim();
}

export function validEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || '').trim());
}

export function collectFields(form) {
  const fields = {};
  for (const el of form.querySelectorAll('input, select, textarea')) {
    if (!el.name || el.type === 'submit') continue;
    if (el.type === 'checkbox') {
      if (el.checked) fields[el.name] = fields[el.name] ? `${fields[el.name]},${el.value}` : el.value;
    } else {
      fields[el.name] = String(el.value || '').trim().slice(0, el.name === 'message' ? 2000 : 200);
    }
  }
  return fields;
}

async function submit(form) {
  const kind = form.getAttribute('data-lead');
  const fields = collectFields(form);
  const emailInput = form.querySelector('input[type="email"]');
  if (emailInput && !validEmail(emailInput.value)) {
    emailInput.setAttribute('aria-invalid', 'true');
    setStatus(form, 'Please enter a valid email address.', 'error');
    emailInput.focus();
    return;
  }
  if (emailInput) emailInput.removeAttribute('aria-invalid');
  const required = [...form.querySelectorAll('[required]')].find((el) => !String(el.value || '').trim());
  if (required) {
    required.setAttribute('aria-invalid', 'true');
    setStatus(form, 'Please fill in the required fields.', 'error');
    required.focus();
    return;
  }
  // Honeypot: real people never see the "website" field. Pretend success, send nothing.
  if (fields.website) {
    setStatus(form, form.getAttribute('data-success') || 'Thanks!', 'ok');
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  if (button) button.disabled = true;
  setStatus(form, 'Sending…', '');
  let result = { ok: false };
  try {
    if (typeof window.pulseLead === 'function') {
      result = (await window.pulseLead(kind, fields)) || { ok: false };
    }
  } catch {
    result = { ok: false };
  }
  if (button) button.disabled = false;
  if (result.ok) {
    setStatus(form, form.getAttribute('data-success') || 'Thanks, it is sent.', 'ok');
    for (const el of form.querySelectorAll('input:not([type="hidden"]):not([name="website"]), textarea')) {
      if (el.type !== 'checkbox') el.value = '';
    }
    if (kind === 'subscribe' && window.pulse) window.pulse('subscribe', { src: form.getAttribute('data-src') || 'site' });
  } else {
    // Keep everything the person typed.
    setStatus(form, FALLBACK, 'error');
  }
}

export function initForms(root = document) {
  for (const form of root.querySelectorAll('form[data-lead]')) {
    form.setAttribute('novalidate', '');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      submit(form);
    });
  }
}
