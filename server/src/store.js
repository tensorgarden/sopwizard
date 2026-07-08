// Writes pipeline results to disk: one folder per SOP holding the structured
// JSON, the Markdown master, the visual guide, and the review page.

import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { render } from './render.js';
import { reviewPage } from './export/review.js';

export const DATA_DIR = join(process.cwd(), 'data', 'sops');

export async function persist(id, sop, clarifications = []) {
  const dir = join(DATA_DIR, id);
  await mkdir(dir, { recursive: true });

  const outputs = render(sop);
  await writeFile(join(dir, 'sop.json'), JSON.stringify(sop, null, 2));
  await writeFile(join(dir, 'sop.md'), outputs.markdown.content);
  await writeFile(join(dir, 'index.html'), outputs.html.content);
  await writeFile(join(dir, 'review.html'), reviewPage(id, sop, clarifications));

  return dir;
}

export async function load(id) {
  const raw = await readFile(join(DATA_DIR, id, 'sop.json'), 'utf8');
  return JSON.parse(raw);
}
