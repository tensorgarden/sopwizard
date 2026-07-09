// Loads server/.env into process.env if present. Existing values win.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

try {
  const raw = readFileSync(join(process.cwd(), '.env'), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch {
  // no .env file — fine
}
