import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { run } from './pipeline.js';
import { review } from './review.js';
import { applyAnswers, applyCorrection } from './revise.js';
import { persist, load, DATA_DIR } from './store.js';

const PORT = process.env.PORT || 8787;
const EXTENSION_ZIP = fileURLToPath(new URL('../../dist/sopwizard-extension.zip', import.meta.url));

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function serveIndex(res) {
  let ids = [];
  try {
    const entries = await readdir(DATA_DIR, { withFileTypes: true });
    ids = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    // no SOPs generated yet
  }

  const list = ids.length
    ? ids.map((id) => `<li><a href="/sops/${id}/review">${id}</a> &middot; <a href="/sops/${id}">guide</a></li>`).join('')
    : '<li>No SOPs yet — record one with the extension, or run <code>npm run demo</code>.</li>';

  const html = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>SOPWizard</title>
    <style>body{font:15px/1.5 system-ui,sans-serif;max-width:640px;margin:48px auto;padding:0 20px;color:#1f2328}a{color:#1f6feb}code{background:#f6f8fa;padding:1px 5px;border-radius:4px}</style>
  </head>
  <body>
    <h1>SOPWizard</h1>
    <p>Pipeline running on :8787.</p>
    <p><a href="/extension.zip">Download the Chrome extension (.zip)</a> — unzip, then load it unpacked at <code>chrome://extensions</code>.</p>
    <h2>SOPs</h2>
    <ul>${list}</ul>
  </body>
</html>
`;
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  res.end(html);
}

async function serveFile(res, id, file) {
  try {
    const content = await readFile(join(DATA_DIR, id, file));
    res.writeHead(200, { 'content-type': contentType(file) });
    res.end(content);
  } catch {
    send(res, 404, { error: 'not found' });
  }
}

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  const parts = pathname.split('/').filter(Boolean);

  if (req.method === 'GET' && pathname === '/') {
    return serveIndex(res);
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
      const { sop, clarifications } = run(body, body.context || {});
      const id = randomUUID();
      await persist(id, sop, clarifications);
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
    if (req.method === 'GET') {
      return serveFile(res, id, action === 'review' ? 'review.html' : action || 'index.html');
    }
  }

  send(res, 404, { error: 'not found' });
});

async function editSop(req, res, id, edit) {
  try {
    const body = await readJson(req);
    const sop = await load(id);
    edit(sop, body);
    const clarifications = review(sop);
    await persist(id, sop, clarifications);
    send(res, 200, { sop, clarifications });
  } catch (err) {
    send(res, 400, { error: err.message });
  }
}

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.md')) return 'text/markdown; charset=utf-8';
  if (file.endsWith('.docx')) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (file.endsWith('.json')) return 'application/json';
  return 'text/plain; charset=utf-8';
}

server.listen(PORT, () => {
  console.log(`pipeline listening on :${PORT}`);
});
