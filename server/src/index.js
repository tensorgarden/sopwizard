import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { run } from './pipeline.js';
import { review } from './review.js';
import { applyAnswers, applyCorrection, approve } from './revise.js';
import { persist, load, DATA_DIR } from './store.js';
import { meter } from './usage.js';
import { landingPage } from './export/landing.js';
import { practicePage } from './export/practice.js';

const PORT = process.env.PORT || 8787;
const SOP_FILES = new Set(['index.html', 'review.html', 'sop.md', 'sop.docx']);
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const EXTENSION_ZIP = join(ROOT, 'dist', 'sopwizard-extension.zip');

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

function sendHtml(res, html) {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
}

// This server binds to loopback and holds workflow recordings, so requests
// initiated by other websites in the browser are rejected: state changes must
// come from the extension or our own pages, and the Host header must be a
// local one (which also blocks DNS-rebinding tricks).
function requestAllowed(req) {
  const host = (req.headers.host || '').split(':')[0];
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) return false;
  if (req.method === 'GET') return true;

  const origin = req.headers.origin;
  if (!origin) return true; // extension service worker and CLI clients
  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === 'chrome-extension:' || ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  } catch {
    return false;
  }
}

const server = createServer(async (req, res) => {
  if (!requestAllowed(req)) {
    return send(res, 403, { error: 'forbidden' });
  }

  const { pathname } = new URL(req.url, 'http://localhost');
  const parts = pathname.split('/').filter(Boolean);

  if (req.method === 'GET' && pathname === '/') {
    return sendHtml(res, landingPage(await listSops()));
  }

  if (req.method === 'GET' && pathname === '/practice') {
    return sendHtml(res, practicePage());
  }

  if (req.method === 'GET' && pathname === '/health') {
    return send(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/extension.zip') {
    try {
      const buf = await readFile(EXTENSION_ZIP);
      res.writeHead(200, {
        'content-type': 'application/zip',
        'content-disposition': 'attachment; filename="sopwizard-extension.zip"',
      });
      return res.end(buf);
    } catch {
      return send(res, 404, { error: 'not built — run `npm run pack:extension` from the repo root' });
    }
  }

  if (req.method === 'POST' && pathname === '/recordings') {
    try {
      const body = await readJson(req);
      const { sop, clarifications } = await run(body, body.context || {});
      const id = randomUUID();
      await persist(id, sop, clarifications);
      await meter(id, sop);
      return send(res, 201, {
        id,
        steps: sop.steps.length,
        clarifications,
        review: `/sops/${id}/review`,
        view: `/sops/${id}`,
      });
    } catch (err) {
      return send(res, 400, { error: err.message });
    }
  }

  if (parts[0] === 'sops' && parts[1]) {
    const id = parts[1];
    const action = parts[2];

    if (req.method === 'POST' && action === 'answers') {
      return editSop(req, res, id, (sop, body) => applyAnswers(sop, body.answers));
    }
    if (req.method === 'POST' && action === 'corrections') {
      return editSop(req, res, id, (sop, body) => applyCorrection(sop, body));
    }
    if (req.method === 'POST' && action === 'approve') {
      return editSop(req, res, id, (sop) => approve(sop));
    }
    if (req.method === 'GET') {
      return serveFile(res, id, action === 'review' ? 'review.html' : action || 'index.html');
    }
  }

  send(res, 404, { error: 'not found' });
});

async function listSops() {
  let entries = [];
  try {
    entries = (await readdir(DATA_DIR, { withFileTypes: true })).filter((e) => e.isDirectory());
  } catch {
    return [];
  }

  const sops = [];
  for (const entry of entries) {
    try {
      const sop = await load(entry.name);
      sops.push({
        id: entry.name,
        title: sop.title,
        status: sop.status,
        steps: sop.steps.length,
        createdAt: sop.createdAt,
      });
    } catch {
      // skip anything unreadable
    }
  }
  return sops.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

async function editSop(req, res, id, edit) {
  try {
    const body = await readJson(req);
    const sop = await load(id);
    await edit(sop, body);
    const clarifications = review(sop);
    await persist(id, sop, clarifications);
    send(res, 200, { sop, clarifications });
  } catch (err) {
    send(res, 400, { error: err.message });
  }
}

async function serveFile(res, id, file) {
  // Ids are UUIDs and only rendered artifacts are served — the raw sop.json
  // (which carries the full recording) stays on disk.
  if (!/^[\w-]{1,64}$/.test(id) || !SOP_FILES.has(file)) {
    return send(res, 404, { error: 'not found' });
  }
  try {
    const content = await readFile(join(DATA_DIR, id, file));
    res.writeHead(200, { 'content-type': contentType(file) });
    res.end(content);
  } catch {
    send(res, 404, { error: 'not found' });
  }
}

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.md')) return 'text/markdown; charset=utf-8';
  if (file.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (file.endsWith('.json')) return 'application/json';
  return 'text/plain; charset=utf-8';
}

function packExtension() {
  execFile('zip', ['-qr', EXTENSION_ZIP, 'extension'], { cwd: ROOT }, (err) => {
    if (err) console.warn('could not build extension zip:', err.message);
  });
}

// Long recordings upload large batches of screenshots; never cut them off.
server.requestTimeout = 0;

server.listen(PORT, '127.0.0.1', () => {
  execFile('mkdir', ['-p', join(ROOT, 'dist')], () => packExtension());
  console.log(`SOPWizard running — open http://localhost:${PORT}`);
});
