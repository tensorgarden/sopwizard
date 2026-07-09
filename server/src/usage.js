// Usage metering.
//
// Each successfully generated SOP appends one record here — the unit the
// product bills on. Locally this is just a ledger on disk; a hosted deployment
// forwards the same records to the billing provider. Reviews, corrections,
// and re-exports are deliberately not metered.

import { mkdir, appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const FILE = join(process.cwd(), 'data', 'usage.jsonl');

// Recordings longer than one block bill one extra credit per block started.
const BLOCK_MINUTES = 15;

export function creditsFor(sop) {
  const last = sop.steps.at(-1)?.t ?? 0;
  const minutes = last / 60000;
  return 1 + Math.max(0, Math.ceil((minutes - BLOCK_MINUTES) / BLOCK_MINUTES));
}

export async function meter(id, sop) {
  const record = {
    at: Date.now(),
    sop: id,
    steps: sop.steps.length,
    durationMs: sop.steps.at(-1)?.t ?? 0,
    narrator: sop.narrator,
    credits: creditsFor(sop),
  };
  await mkdir(join(process.cwd(), 'data'), { recursive: true });
  await appendFile(FILE, JSON.stringify(record) + '\n');
  return record;
}

export async function usageSummary() {
  try {
    const lines = (await readFile(FILE, 'utf8')).trim().split('\n');
    const records = lines.map((l) => JSON.parse(l));
    return {
      sops: records.length,
      credits: records.reduce((sum, r) => sum + (r.credits || 1), 0),
    };
  } catch {
    return { sops: 0, credits: 0 };
  }
}
