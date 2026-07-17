// One folder per SOP: the structured source of truth, a small listing record,
// and the rendered artifacts.
//
// Data lives outside the application folder by default, so replacing the app
// with a new build never destroys a customer's SOPs. Override with
// SOPWIZARD_DATA_DIR; a first run migrates a legacy ./data folder if it finds one.
//
// Writes are atomic (temp file + rename) so a crash or a full disk can never
// leave a half-written sop.json — the only authoritative copy of a document.
// sop.json is written last, after its artifacts, so a failure part-way through
// can't leave the source of truth pointing at renders that don't exist.

import { mkdir, writeFile, readFile, rename, rm, cp, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { renderOne } from './render.js';
import { normalize } from './model.js';
import { reviewPage } from './export/review.js';
import { DATA_ROOT, DATA_DIR } from './paths.js';

export { DATA_DIR };

// Artifacts that are cheap enough to regenerate on demand, so an edit doesn't
// rewrite megabytes of Word and HTML the reviewer may never open. review.html
// is not here — it's needed the instant an edit lands, so it's written eagerly.
const ON_DEMAND = new Set(['index.html', 'sop.md', 'sop.docx']);
const EXPORTER_FOR = { 'index.html': 'html', 'sop.md': 'markdown', 'sop.docx': 'docx' };

let tmpCounter = 0;

async function atomicWrite(file, data) {
  const tmp = `${file}.tmp-${process.pid}-${tmpCounter++}`;
  await writeFile(tmp, data);
  await rename(tmp, file);
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// Move a legacy ./data folder into the user-data location once. Best-effort: if
// it can't be moved, the app starts clean and the old data stays put on disk
// rather than being destroyed.
export async function migrateLegacyData() {
  const legacy = join(process.cwd(), 'data');
  if (legacy === DATA_ROOT) return;
  if (!(await exists(legacy)) || (await exists(DATA_ROOT))) return;

  try {
    await mkdir(dirname(DATA_ROOT), { recursive: true });
    try {
      await rename(legacy, DATA_ROOT);
    } catch {
      // Different filesystem — copy then remove.
      await cp(legacy, DATA_ROOT, { recursive: true });
      await rm(legacy, { recursive: true, force: true });
    }
    console.log(`migrated existing SOPs from ${legacy} to ${DATA_ROOT}`);
  } catch (err) {
    console.warn(`could not migrate legacy data (${err.message}); starting with an empty library`);
  }
}

export async function persist(id, sop, clarifications = []) {
  const dir = join(DATA_DIR, id);
  await mkdir(dir, { recursive: true });

  // review.html and the listing record are written eagerly; the heavy exports
  // are cleared so the next request regenerates them from the new source.
  await atomicWrite(join(dir, 'review.html'), reviewPage(id, sop, clarifications));
  await atomicWrite(join(dir, 'meta.json'), JSON.stringify(metaOf(sop), null, 2));
  await Promise.all(
    [...ON_DEMAND].map((f) => rm(join(dir, f), { force: true }))
  );

  // Source of truth last: nothing above depends on it, and writing it last means
  // a crash mid-persist never leaves it inconsistent with what it describes.
  await atomicWrite(join(dir, 'sop.json'), JSON.stringify(sop, null, 2));

  return dir;
}

function metaOf(sop) {
  return {
    title: sop.title,
    status: sop.status,
    steps: sop.steps.length,
    createdAt: sop.createdAt ?? null,
    approvedAt: sop.approvedAt ?? null,
  };
}

// Normalizing on the way in means a sop.json written before the model grew
// phases and reference sections still loads, renders, and can be edited.
export async function load(id) {
  const raw = await readFile(join(DATA_DIR, id, 'sop.json'), 'utf8');
  return normalize(JSON.parse(raw));
}

// The listing record — title/status/counts only, no keyframes — so the library
// page and the bulk export don't parse every full document to show a list.
export async function loadMeta(id) {
  try {
    return JSON.parse(await readFile(join(DATA_DIR, id, 'meta.json'), 'utf8'));
  } catch {
    // Older SOPs predate meta.json; fall back to the full document once.
    return metaOf(await load(id));
  }
}

// Content of a rendered artifact, generating and caching the heavy ones the
// first time they're asked for. Returns null if the SOP doesn't exist.
export async function getArtifact(id, file) {
  const path = join(DATA_DIR, id, file);
  try {
    return await readFile(path);
  } catch {
    // Not cached (or never rendered). Regenerate the on-demand exports.
  }
  if (!ON_DEMAND.has(file)) return null;

  let sop;
  try {
    sop = await load(id);
  } catch {
    return null;
  }
  const content = await renderOne(sop, EXPORTER_FOR[file]);
  try {
    await atomicWrite(path, content);
  } catch {
    // A read-only or full disk shouldn't stop us from serving the bytes.
  }
  return content;
}
