import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { run } from './pipeline.js';
import { persist, DATA_DIR } from './store.js';

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

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && pathname === '/health') {
    return send(res, 200, { ok: true });
  }

  if (req.method === 'POST' && pathname === '/recordings') {
    try {
      const body = await readJson(req);
      const result = run(body, body.context || {});
      const id = randomUUID();
      await persist(id, result);
      return send(res, 201, { id, steps: result.sop.steps.length, view: `/sops/${id}` });
    } catch (err) {
      return send(res, 400, { error: err.message });
    }
  }

  const match = pathname.match(/^\/sops\/([\w-]+)(?:\/([\w.]+))?$/);
  if (req.method === 'GET' && match) {
    const [, id, file = 'index.html'] = match;
    try {
      const content = await readFile(join(DATA_DIR, id, file));
      res.writeHead(200, { 'content-type': contentType(file) });
      return res.end(content);
    } catch {
      return send(res, 404, { error: 'not found' });
    }
  }

  send(res, 404, { error: 'not found' });
});

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.md')) return 'text/markdown; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json';
  return 'text/plain; charset=utf-8';
}

server.listen(PORT, () => {
  console.log(`pipeline listening on :${PORT}`);
});
