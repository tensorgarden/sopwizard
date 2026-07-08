import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const PORT = process.env.PORT || 8787;
const DATA_DIR = join(process.cwd(), 'data', 'recordings');

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
  if (req.method === 'GET' && req.url === '/health') {
    return send(res, 200, { ok: true });
  }

  if (req.method === 'POST' && req.url === '/recordings') {
    try {
      const body = await readJson(req);
      const id = randomUUID();
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(join(DATA_DIR, `${id}.json`), JSON.stringify(body, null, 2));
      return send(res, 201, { id, events: body.events?.length ?? 0 });
    } catch (err) {
      return send(res, 400, { error: err.message });
    }
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`pipeline listening on :${PORT}`);
});
