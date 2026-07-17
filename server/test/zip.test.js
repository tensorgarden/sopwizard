import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateRawSync } from 'node:zlib';
import { zip } from '../src/export/zip.js';

// Parse the archive back out by walking local file headers, so the test doesn't
// depend on an external unzip. Validates the format is real, not just bytes.
function unzip(buf) {
  const files = [];
  let i = 0;
  while (i + 4 <= buf.length && buf.readUInt32LE(i) === 0x04034b50) {
    const compSize = buf.readUInt32LE(i + 18);
    const nameLen = buf.readUInt16LE(i + 26);
    const extraLen = buf.readUInt16LE(i + 28);
    const name = buf.slice(i + 30, i + 30 + nameLen).toString('utf8');
    const bodyStart = i + 30 + nameLen + extraLen;
    const body = buf.slice(bodyStart, bodyStart + compSize);
    files.push({ name, data: inflateRawSync(body).toString('utf8') });
    i = bodyStart + compSize;
  }
  return files;
}

test('zip round-trips file names and content', () => {
  const input = [
    { name: 'create-a-new-client-record.md', data: '# Create a new client record\n\nHello.' },
    { name: 'run-a-quote.md', data: '# Run a quote\n\nWorld — with a pipe | and unicode ✓.' },
  ];
  const out = unzip(zip(input));
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((f) => f.name), input.map((f) => f.name));
  assert.deepEqual(out.map((f) => f.data), input.map((f) => f.data));
});

test('empty archive is well-formed (end-of-central-directory only)', () => {
  const buf = zip([]);
  assert.equal(buf.readUInt32LE(0), 0x06054b50);
});
