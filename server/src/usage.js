// Usage ledger: one record per event. Only generation carries credits;
// reviews, corrections, and exports are logged but never billed.

import { mkdir, appendFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { actionsIn, durationOf } from './model.js';
import { syncEvent } from './sync.js';
import { DATA_ROOT } from './paths.js';

const FILE = join(DATA_ROOT, 'usage.jsonl');

// Credits scale with recording length or recorded actions, whichever is larger.
// Metered on actions, not steps: step count depends on how aggressively the
// narrator consolidates, so billing on steps would shrink as consolidation
// improved and would differ by provider tier for the same work.
const BLOCK_MINUTES = 15;
const BLOCK_ACTIONS = 40;

export function creditsFor(sop) {
  const minutes = durationOf(sop) / 60000;
  const timeBlocks = Math.max(0, Math.ceil((minutes - BLOCK_MINUTES) / BLOCK_MINUTES));
  const actionBlocks = Math.max(0, Math.ceil((actionsIn(sop) - BLOCK_ACTIONS) / BLOCK_ACTIONS));
  return 1 + Math.max(timeBlocks, actionBlocks);
}

export async function record(kind, data = {}) {
  const entry = { at: Date.now(), kind, ...data };
  try {
    await mkdir(DATA_ROOT, { recursive: true });
    await appendFile(FILE, JSON.stringify(entry) + '\n');
  } catch (err) {
    // The ledger is best-effort accounting, never a reason to fail the request
    // that produced the event — a full or read-only disk must not take the
    // server down with it.
    console.warn(`usage ledger write failed (${kind}): ${err.message}`);
  }
  void syncEvent(kind, entry);
  return entry;
}

export function meter(id, sop) {
  return record('sop_generated', {
    sop: id,
    steps: sop.steps.length,
    actions: actionsIn(sop),
    durationMs: durationOf(sop),
    narrator: sop.narrator,
    credits: creditsFor(sop),
  });
}

export async function usageSummary() {
  let text;
  try {
    text = await readFile(FILE, 'utf8');
  } catch {
    return { sops: 0, credits: 0 };
  }

  let sops = 0;
  let credits = 0;
  // Parse per line so one torn write (a crash mid-append) can't zero the whole
  // summary — the rest of the ledger still counts.
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.kind === 'sop_generated') {
      sops += 1;
      credits += entry.credits || 1;
    }
  }
  return { sops, credits };
}
