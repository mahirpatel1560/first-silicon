// ATS Internship & Job Feed: Greenhouse, Lever, Ashby -> labeled JSON dataset.
// Apify SDK v3. Local test without the platform:
//   APIFY_LOCAL_STORAGE_DIR=./storage node src/main.js   (reads storage/key_value_stores/default/INPUT.json)
// FS_FIXTURES_DIR=<dir> reads <dir>/<ats>/<token>.json instead of calling the APIs (offline tests only).

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Actor, log } from 'apify';
import { normalizeInput, itemsFromPostings } from './core.js';
import { fetchBoard } from './lib/fetchers/index.mjs';

const USER_AGENT = 'ATSInternshipFeed/0.1 (Apify Actor; public job-board APIs; one request per board)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await Actor.main(async () => {
  const input = (await Actor.getInput()) ?? {};
  const opts = normalizeInput(input);
  for (const e of opts.errors) log.warning(e);
  if (!opts.boards.length) {
    throw new Error('No job boards to read. Add entries to "companies" (e.g. greenhouse:acme) or choose a preset.');
  }
  const fixturesDir = process.env.FS_FIXTURES_DIR;
  const source = fixturesDir
    ? {
        mode: 'fixtures',
        readFixture: async (ats, token) => {
          try {
            return JSON.parse(await readFile(path.join(fixturesDir, ats, `${token}.json`), 'utf8'));
          } catch {
            return null;
          }
        },
      }
    : { mode: 'live', userAgent: USER_AGENT, timeoutMs: 20000, retries: 3 };

  log.info(`Reading ${opts.boards.length} job board(s)${fixturesDir ? ' from fixtures' : ''}; max ${opts.maxItems} items.`);
  const boards = [];
  let pushed = 0;
  let budgetReached = false;
  for (let i = 0; i < opts.boards.length; i++) {
    const b = opts.boards[i];
    if (pushed >= opts.maxItems || budgetReached) break;
    const res = await fetchBoard(b, source);
    const row = { board: `${b.ats}:${b.token}`, ok: res.ok, postings: res.count, pushed: 0, error: res.error || null };
    if (!res.ok) {
      log.warning(`Board ${row.board} failed: ${res.error}`);
    } else {
      const items = itemsFromPostings(res.postings, opts, { room: opts.maxItems - pushed });
      if (items.length) {
        // Charged per saved item under pay-per-event ("result" event); a no-op without PPE pricing.
        const charge = await Actor.pushData(items, 'result');
        row.pushed = items.length;
        pushed += items.length;
        if (charge && charge.eventChargeLimitReached) {
          budgetReached = true;
          log.info('Maximum charge for this run reached; stopping.');
        }
      }
      log.info(`${row.board}: ${res.count} postings, ${row.pushed} matched.`);
    }
    boards.push(row);
    if (source.mode === 'live' && i < opts.boards.length - 1) await sleep(opts.delayMs);
  }
  const summary = {
    boardsRequested: opts.boards.length,
    boardsRead: boards.filter((r) => r.ok).length,
    boardsFailed: boards.filter((r) => !r.ok).length,
    itemsPushed: pushed,
    budgetReached,
    boards,
    finishedAt: new Date().toISOString(),
  };
  await Actor.setValue('RUN_SUMMARY', summary);
  log.info(`Done: ${pushed} item(s) from ${summary.boardsRead}/${summary.boardsRequested} board(s).`);
});
