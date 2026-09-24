#!/usr/bin/env node
// Renders static brand images with Playwright (local Chromium): og.png (1200x630), favicon PNGs, icon-512.
// Output goes to src/static/ and is committed, so the site build itself needs no browser.
// The OG image carries no counts on purpose: it is rendered by hand, not by the daily data run, so any number
// in it would go stale the next morning. Live counts belong in the page copy (src/lib/copy.mjs).
// Usage: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node scripts/og.mjs

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { LOGO_SVG } from '../src/site/layout.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'src/static');

const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><style>.c{color:#16181d}@media (prefers-color-scheme: dark){.c{color:#ecebe6}}</style><g class="c">${LOGO_SVG.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')}</g></svg>`;

const OG_HTML = `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:1200px;height:630px;}
  body{background:#f8f7f3;color:#16181d;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Arial,sans-serif;display:flex;flex-direction:column;justify-content:space-between;padding:64px 72px;box-sizing:border-box;position:relative;overflow:hidden}
  .grid{position:absolute;inset:0;background-image:linear-gradient(#e7e3da 1px,transparent 1px),linear-gradient(90deg,#e7e3da 1px,transparent 1px);background-size:40px 40px;opacity:.55}
  .top{display:flex;align-items:center;gap:18px;position:relative}
  .top svg{width:72px;height:72px;color:#16181d}
  .name{font-size:40px;font-weight:800;letter-spacing:-0.02em}
  .kicker{font:600 22px ui-monospace,Menlo,Consolas,monospace;letter-spacing:.08em;text-transform:uppercase;color:#9a4513;position:relative}
  h1{font-size:60px;line-height:1.08;margin:14px 0 0;letter-spacing:-0.025em;max-width:900px;position:relative}
  .chips{display:flex;gap:12px;flex-wrap:wrap;position:relative}
  .chip{font:600 22px ui-monospace,Menlo,Consolas,monospace;border:2px solid #16181d;border-radius:999px;padding:6px 16px;background:#fff}
  .chip.g{border-color:#1d6a45;color:#1d6a45;background:#e3f1e9}
  .chip.a{border-color:#7d4f00;color:#7d4f00;background:#fbf0d9}
  .chips{max-width:1056px}
  .sub{font-size:27px;line-height:1.3;color:#4b5260;margin:16px 0 0;max-width:860px;position:relative}
  .trace{position:absolute;right:-70px;top:170px;width:250px;height:250px;border:3px solid #c0612b;border-radius:24px;opacity:.9}
  .trace:after{content:'';position:absolute;inset:36px;border:3px dashed #c0612b;border-radius:14px}
</style></head><body><div class="grid"></div><div class="trace"></div>
  <div class="top">${LOGO_SVG}<span class="name">First Silicon</span></div>
  <div><div class="kicker">Hardware · EE · Embedded · Semiconductors</div><h1>Every hardware internship, labeled.</h1><p class="sub">Internships and co-ops from hardware companies' own job boards, tagged by class year, discipline and citizenship. Updated every morning.</p></div>
  <div class="chips"><span class="chip">PCB</span><span class="chip">Embedded</span><span class="chip">RF</span><span class="chip">Test</span><span class="chip">Silicon</span><span class="chip g">Class year</span><span class="chip a">Citizenship</span></div>
</body></html>`;

async function main() {
  await fs.mkdir(OUT, { recursive: true });
  await fs.writeFile(path.join(OUT, 'favicon.svg'), FAVICON_SVG);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
    await page.setContent(OG_HTML);
    await page.screenshot({ path: path.join(OUT, 'og.png'), type: 'png' });
    for (const [file, size, pad, bg] of [
      ['favicon-32.png', 32, 0, 'transparent'],
      ['apple-touch-icon.png', 180, 22, '#f8f7f3'],
      ['icon-512.png', 512, 64, '#f8f7f3'],
    ]) {
      const p = await browser.newPage({ viewport: { width: size, height: size } });
      await p.setContent(`<html><body style="margin:0;background:${bg};width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;color:#16181d"><div style="width:${size - 2 * pad}px;height:${size - 2 * pad}px">${LOGO_SVG.replace('<svg ', `<svg width="${size - 2 * pad}" height="${size - 2 * pad}" `)}</div></body></html>`);
      await p.screenshot({ path: path.join(OUT, file), type: 'png', omitBackground: bg === 'transparent' });
      await p.close();
    }
  } finally {
    await browser.close();
  }
  console.log('Wrote src/static/{favicon.svg,favicon-32.png,apple-touch-icon.png,icon-512.png,og.png}');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
