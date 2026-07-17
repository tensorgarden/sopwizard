import './env.js';
import { createServer } from 'node:http';
import { mkdirSync, existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { run } from './pipeline.js';
import { review } from './review.js';
import { applyAnswers, applyCorrection, applyGuidance, approve } from './revise.js';
import { persist, load, loadMeta, getArtifact, migrateLegacyData, DATA_DIR } from './store.js';
import { meter, record } from './usage.js';
import { syncSop, syncError, syncEnabled, syncStatus } from './sync.js';
import { contribute, corpusEnabled } from './corpus.js';
import { fingerprintsFor } from './fingerprint.js';
import { emitApproved, webhookEnabled } from './webhook.js';
import { zip } from './export/zip.js';
import { slug } from './export/format.js';
import { landingPage } from './export/landing.js';
import { practicePage } from './export/practice.js';
import { logLine, logError } from './logger.js';
import { BUILD } from './version.js';

const PORT = Number(process.env.PORT || 8787);
const SOP_FILES = new Set(['index.html', 'review.html', 'sop.md', 'sop.docx']);
const ID_RE = /^[\w-]{1,64}$/;
const MAX_BODY = 64 * 1024 * 1024; // a very long recording's own payload; bigger is refused, not OOM'd
const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const EXTENSION_ZIP = join(ROOT, 'dist', 'sopwizard-extension.zip');

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) {
      const err = new Error('recording too large — record shorter sessions');
      err.statusCode = 413;
      throw err;
    }
    chunks.push(chunk);
  }
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

function validId(value) {
  return typeof value === 'string' && ID_RE.test(value);
}

// Strip the operator's home path out of any message that might reach a client
// or the vendor error table, so an ENOENT can't leak a username.
function clean(message) {
  return String(message ?? '').split(homedir()).join('~');
}

// True only for a browser request that carries a foreign Origin/Referer — used
// to keep another site from forging side-effecting GETs (usage events, zip
// builds). Address-bar navigation and the extension carry no such header.
function foreignBrowser(req) {
  const ref = req.headers.origin || req.headers.referer;
  if (!ref) return false;
  try {
    const { protocol, hostname } = new URL(ref);
    if (protocol === 'chrome-extension:') return false;
    return !['localhost', '127.0.0.1', '[::1]'].includes(hostname);
  } catch {
    return true;
  }
}

// Reject browser requests from other origins and foreign Host headers
// (blocks cross-site writes and DNS rebinding).
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

// Serializes edits per SOP id: load-modify-persist is a read-modify-write, and
// the review page fires overlapping POSTs, so without this the second write
// silently clobbers the first. Chains run regardless of a prior failure and the
// map self-prunes at the tail.
const editLocks = new Map();
function serialize(id, task) {
  const prior = editLocks.get(id) ?? Promise.resolve();
  const run = prior.then(task, task);
  editLocks.set(id, run);
  run.then(
    () => {},
    () => {}
  ).finally(() => {
    if (editLocks.get(id) === run) editLocks.delete(id);
  });
  return run;
}

async function handle(req, res) {
  if (!requestAllowed(req)) return send(res, 403, { error: 'forbidden' });

  const { pathname } = new URL(req.url, 'http://localhost');
  const parts = pathname.split('/').filter(Boolean);

  if (req.method === 'GET' && pathname === '/') {
    return sendHtml(res, landingPage(await listSops()));
  }
  if (req.method === 'GET' && pathname === '/practice') {
    return sendHtml(res, practicePage());
  }
  if (req.method === 'GET' && pathname === '/health') {
    return send(res, 200, { ok: true, version: BUILD, sync: syncStatus(), corpus: corpusEnabled() });
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

  // Every approved SOP's Markdown in one archive, for bulk-loading a library
  // into a knowledge base.
  if (req.method === 'GET' && pathname === '/export/approved.zip') {
    if (foreignBrowser(req)) return send(res, 403, { error: 'forbidden' });
    const files = await approvedMarkdown();
    if (!files.length) return send(res, 404, { error: 'no approved SOPs yet' });
    void record('sop_exported', { format: 'zip', count: files.length });
    res.writeHead(200, {
      'content-type': 'application/zip',
      'content-disposition': 'attachment; filename="sopwizard-approved-sops.zip"',
    });
    return res.end(zip(files));
  }

  if (req.method === 'POST' && pathname === '/recordings') {
    let body;
    try {
      body = await readJson(req);
    } catch (err) {
      return send(res, err.statusCode || 400, { error: err.statusCode === 413 ? err.message : 'invalid request body' });
    }

    if (!Array.isArray(body.events) || body.events.length === 0) {
      return send(res, 400, { error: 'recording has no events' });
    }

    // The recorder mints an id at record-start and resends it on retry, so a
    // lost response can't create a second SOP or a second billing record.
    const id = validId(body.recordingId) ? body.recordingId : randomUUID();
    if (await alreadyProcessed(id)) {
      const meta = await loadMeta(id).catch(() => ({ steps: 0 }));
      return send(res, 200, { id, steps: meta.steps ?? 0, deduped: true, review: `/sops/${id}/review`, view: `/sops/${id}` });
    }

    let sop;
    let clarifications;
    try {
      ({ sop, clarifications } = await run(body, body.context || {}));
      await persist(id, sop, clarifications);
    } catch (err) {
      logError(`recording ${id} failed: ${err.message}`);
      return send(res, 400, { error: 'could not process the recording' });
    }

    // Metering runs after the SOP is safely persisted and never fails the
    // request: a save that succeeded must not look like a failure the recorder
    // will retry into a duplicate.
    void meter(id, sop);
    void syncSop(id, sop);
    return send(res, 201, {
      id,
      steps: sop.steps.length,
      clarifications,
      review: `/sops/${id}/review`,
      view: `/sops/${id}`,
    });
  }

  if (parts[0] === 'sops' && parts[1]) {
    const id = parts[1];
    const action = parts[2];

    // The ledger records what happened, so each edit is logged only after it
    // lands.
    if (req.method === 'POST' && action === 'answers') {
      return editSop(req, res, id, (sop, body) => {
        applyAnswers(sop, body.answers);
        void record('sop_answered', { sop: id, answers: body.answers?.length ?? 0 });
      });
    }
    if (req.method === 'POST' && action === 'corrections') {
      return editSop(req, res, id, async (sop, body) => {
        await applyCorrection(sop, body);
        void record('sop_corrected', { sop: id, scope: body.scope ?? 'this' });
      });
    }
    if (req.method === 'POST' && action === 'guidance') {
      return editSop(req, res, id, (sop, body) => {
        applyGuidance(sop, body.rulings);
        void record('sop_guidance_reviewed', { sop: id, rulings: body.rulings?.length ?? 0 });
      });
    }
    if (req.method === 'POST' && action === 'approve') {
      return editSop(req, res, id, (sop) => {
        approve(sop);
        void record('sop_approved', { sop: id });
        // Act on a finished SOP only at approval — it's settled and won't
        // change further.
        void contributeSop(id, sop);
        void emitApproved(id, sop);
      });
    }
    if (req.method === 'GET') {
      return serveFile(res, req, id, action === 'review' ? 'review.html' : action || 'index.html');
    }
  }

  send(res, 404, { error: 'not found' });
}

const server = createServer((req, res) => {
  const started = Date.now();
  res.on('finish', () => logLine(`${req.method} ${req.url} ${res.statusCode} ${Date.now() - started}ms`));
  handle(req, res).catch((err) => {
    logError(`unhandled ${req.method} ${req.url}: ${err.message}`);
    if (!res.headersSent) send(res, 500, { error: 'internal error' });
  });
});

async function alreadyProcessed(id) {
  try {
    await loadMeta(id);
    return true;
  } catch {
    return false;
  }
}

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
      const meta = await loadMeta(entry.name);
      sops.push({ id: entry.name, title: meta.title, status: meta.status, steps: meta.steps, createdAt: meta.createdAt });
    } catch (err) {
      logError(`skipping unreadable SOP ${entry.name}: ${err.message}`);
    }
  }
  return sops.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}

// Fire-and-forget, and logged rather than surfaced: a corpus that is slow or
// unreachable must never be the reason an approval fails.
async function contributeSop(id, sop) {
  if (!corpusEnabled()) return;
  try {
    const result = await contribute(sop, fingerprintsFor(sop));
    void record('sop_contributed', { sop: id, ...result });
  } catch (err) {
    void syncError(clean(err.message), { path: `contribute:${id}` });
  }
}

async function editSop(req, res, id, edit) {
  let body;
  try {
    body = await readJson(req);
  } catch (err) {
    return send(res, err.statusCode || 400, { error: err.statusCode === 413 ? err.message : 'invalid request body' });
  }

  try {
    const result = await serialize(id, async () => {
      const sop = await load(id); // throws ENOENT for an unknown id
      await edit(sop, body);
      const clarifications = review(sop);
      await persist(id, sop, clarifications);
      void syncSop(id, sop);
      return { sop, clarifications };
    });
    send(res, 200, result);
  } catch (err) {
    if (err.code === 'ENOENT') return send(res, 404, { error: 'SOP not found' });
    if (err.expose) return send(res, 400, { error: err.message });
    logError(`edit ${id} (${req.url}) failed: ${err.message}`);
    void syncError(clean(err.message), { path: `edit:${id}` });
    send(res, 400, { error: 'could not apply the edit' });
  }
}

async function serveFile(res, req, id, file) {
  if (!validId(id) || !SOP_FILES.has(file)) return send(res, 404, { error: 'not found' });

  const content = await getArtifact(id, file);
  if (content == null) return send(res, 404, { error: 'not found' });

  const headers = { 'content-type': contentType(file) };
  if (file === 'sop.md' || file === 'sop.docx') {
    if (!foreignBrowser(req)) void record('sop_exported', { sop: id, format: file.split('.').pop() });
    headers['content-disposition'] = `attachment; filename="${await downloadName(id, file)}"`;
  }
  res.writeHead(200, headers);
  res.end(content);
}

// "create-a-new-client-record.md" from the SOP's title, read from the small
// listing record rather than the full document.
async function downloadName(id, file) {
  const ext = file.split('.').pop();
  try {
    const meta = await loadMeta(id);
    return `${slug(meta.title, id)}.${ext}`;
  } catch {
    return `${id}.${ext}`;
  }
}

// The Markdown of every approved SOP, named by title, ready to bundle. Titles
// that collide get a short id suffix so nothing is silently overwritten.
async function approvedMarkdown() {
  const files = [];
  const used = new Set();
  for (const meta of await listSops()) {
    if (meta.status !== 'approved') continue;
    const data = await getArtifact(meta.id, 'sop.md');
    if (data == null) continue;
    let name = `${slug(meta.title, meta.id)}.md`;
    if (used.has(name)) name = `${slug(meta.title, meta.id)}-${meta.id.slice(0, 6)}.md`;
    used.add(name);
    files.push({ name, data: data.toString() });
  }
  return files;
}

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.md')) return 'text/markdown; charset=utf-8';
  if (file.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (file.endsWith('.json')) return 'application/json';
  return 'text/plain; charset=utf-8';
}

// Refresh the downloadable extension zip if a zip tool is available; packaged
// builds ship the file, so a failure here is fine.
function packExtension() {
  try {
    mkdirSync(join(ROOT, 'dist'), { recursive: true });
  } catch {
    return;
  }
  execFile('zip', ['-qr', EXTENSION_ZIP, 'extension'], { cwd: ROOT }, (err) => {
    if (err && !existsSync(EXTENSION_ZIP)) console.warn('no extension zip:', err.message);
  });
}

// Last-resort handlers: log and keep serving rather than exit.
process.on('unhandledRejection', (reason) => logError(`unhandledRejection: ${reason?.message ?? reason}`));
process.on('uncaughtException', (err) => logError(`uncaughtException: ${err.message}`));

let closing = false;
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(signal, () => {
    if (closing) process.exit(0);
    closing = true;
    logLine(`received ${signal} — shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}

// Long recordings upload large batches, so allow a long timeout — but finite,
// so a wedged upload can't strand a connection forever.
server.requestTimeout = 10 * 60 * 1000;

await migrateLegacyData();

server.listen(PORT, '127.0.0.1', () => {
  packExtension();
  logLine(`SOPWizard ${BUILD} running — open http://localhost:${PORT}`);
  logLine(syncEnabled() ? 'cloud sync: on' : 'cloud sync: off (set SYNC_* in server/.env to enable)');
  logLine(
    corpusEnabled()
      ? 'shared corpus: ON — approved review deltas are contributed across organizations (k-anonymity gated)'
      : 'shared corpus: off'
  );
  if (webhookEnabled()) logLine('approval webhook: on');
});
