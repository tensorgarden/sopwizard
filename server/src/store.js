// Writes pipeline results to disk: one folder per SOP holding the structured
// JSON, the Markdown master, and the visual guide.

import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const DATA_DIR = join(process.cwd(), 'data', 'sops');

export async function persist(id, result) {
  const dir = join(DATA_DIR, id);
  await mkdir(dir, { recursive: true });

  await writeFile(join(dir, 'sop.json'), JSON.stringify(result.sop, null, 2));
  await writeFile(join(dir, 'sop.md'), result.outputs.markdown.content);
  await writeFile(join(dir, 'index.html'), result.outputs.html.content);

  return dir;
}
