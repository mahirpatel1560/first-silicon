#!/usr/bin/env node
// Minimal static server for local testing that mimics Cloudflare Pages:
// directory index.html, /404.html for misses, and headers from dist/_headers (including "! Name" detach).
// Usage: node scripts/serve.mjs <dir> [port]

import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.ico': 'image/x-icon',
};

export function parseHeadersFile(text) {
  const rules = [];
  let cur = null;
  for (const raw of String(text || '').split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    if (!/^\s/.test(raw)) {
      cur = { pattern: raw.trim(), ops: [] };
      rules.push(cur);
    } else if (cur) {
      const line = raw.trim();
      if (line.startsWith('!')) cur.ops.push({ op: 'detach', name: line.slice(1).trim().toLowerCase() });
      else {
        const i = line.indexOf(':');
        cur.ops.push({ op: 'set', name: line.slice(0, i).trim().toLowerCase(), value: line.slice(i + 1).trim() });
      }
    }
  }
  return rules;
}

function matches(pattern, urlPath) {
  const re = new RegExp(`^${pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  return re.test(urlPath);
}

export function headersFor(rules, urlPath) {
  const out = {};
  for (const r of rules) {
    if (!matches(r.pattern, urlPath)) continue;
    for (const op of r.ops) {
      if (op.op === 'detach') delete out[op.name];
      else out[op.name] = out[op.name] ? `${out[op.name]}, ${op.value}` : op.value;
    }
  }
  return out;
}

export async function startServer(dir, port = 0) {
  const root = path.resolve(dir);
  let rules = [];
  try {
    rules = parseHeadersFile(await fs.readFile(path.join(root, '_headers'), 'utf8'));
  } catch {
    rules = [];
  }
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    let p = decodeURIComponent(url.pathname);
    if (p.includes('..')) {
      res.writeHead(400);
      res.end('bad path');
      return;
    }
    let file = path.join(root, p);
    let status = 200;
    try {
      const st = await fs.stat(file);
      if (st.isDirectory()) {
        if (!p.endsWith('/')) {
          res.writeHead(308, { Location: `${p}/${url.search}` });
          res.end();
          return;
        }
        file = path.join(file, 'index.html');
      }
      await fs.access(file);
    } catch {
      file = path.join(root, '404.html');
      status = 404;
    }
    try {
      const body = await fs.readFile(file);
      const headers = { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', ...headersFor(rules, p) };
      res.writeHead(status, headers);
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
  });
  await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
  const { port: actual } = server.address();
  return { server, url: `http://127.0.0.1:${actual}`, close: () => new Promise((r) => server.close(r)) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2] || 'dist';
  const port = Number(process.argv[3] || 8080);
  startServer(dir, port).then((s) => console.log(`Serving ${dir} at ${s.url}`));
}
