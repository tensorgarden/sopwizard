// A minimal on-disk trail so a field problem leaves something to inspect. One
// line per request, plus errors, appended to server.log next to the data.

import { appendFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { DATA_ROOT } from './paths.js';

const FILE = join(DATA_ROOT, 'server.log');

function write(line) {
  mkdir(DATA_ROOT, { recursive: true })
    .then(() => appendFile(FILE, line + '\n'))
    .catch(() => {});
}

export function logLine(message) {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
  write(line);
}

export function logError(message) {
  const line = `${new Date().toISOString()} ERROR ${message}`;
  console.warn(line);
  write(line);
}
