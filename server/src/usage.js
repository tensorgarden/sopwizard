// Usage ledger: one record per event. Only generation carries credits;
// reviews, corrections, and exports are logged but never billed.

import { mkdir, appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const FILE = join(process.cwd(), 'data', 'usage.jsonl');

// Credits scale with recording length or step count, whichever is larger.
const BLOCK_MINUTES = 15;
const BLOCK_STEPS = 40;

export function creditsFor(sop) {
  const last = sop.steps.at(-1)?.t ?? 0;
  const minutes = last / 60000;
  const timeBlocks = Math.max(0, Math.ceil((minutes - BLOCK_MINUTES) / BLOCK_MINUTES));
  const stepBlocks = Math.max(0, Math.ceil((sop.steps.length - BLOCK_STEPS) / BLOCK_STEPS));
  return 1 + Math.max(timeBlocks, stepBlocks);
}

export async function record(kind, data = {}) {
  const entry = { at: Date.now(), kind, ...data };
  await mkdir(join(process.cwd(), 'data'), { recursive: true });
  await appendFile(FILE, JSON.stringify(entry) + '\n');
  return entry;
}

export function meter(id, sop) {
  return record('sop_generated', {
    sop: id,
    steps: sop.steps.length,
    durationMs: sop.steps.at(-1)?.t ?? 0,
    narrator: sop.narrator,
    credits: creditsFor(sop),
  });
}

export async function usageSummary() {
  try {
    const lines = (await readFile(FILE, 'utf8')).trim().split('\n');
    const records = lines.map((l) => JSON.parse(l));
    const generated = records.filter((r) => r.kind === 'sop_generated');
    return {
      sops: generated.length,
      credits: generated.reduce((sum, r) => sum + (r.credits || 1), 0),
    };
  } catch {
    return { sops: 0, credits: 0 };
  }
}
