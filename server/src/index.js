import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { run } from './pipeline.js';
import { review } from './review.js';
import { applyAnswers, applyCorrection } from './revise.js';
import { persist, load, DATA_DIR } from './store.js';

const PORT = process.env.PORT || 8787;

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
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

  if (req.method === 'GET' && pathname === '/health') {
    return send(res, 200, { ok: true });
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
