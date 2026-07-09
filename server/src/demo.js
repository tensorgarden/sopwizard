// Runs the bundled sample recording through the pipeline and prints the SOP.
// Useful for working on segmentation/drafting without the extension.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from './pipeline.js';
import { render } from './render.js';
import { persist } from './store.js';

const recording = JSON.parse(await readFile(join(process.cwd(), 'samples', 'recording.json'), 'utf8'));
const { sop, clarifications } = await run(recording, recording.context || {});
const dir = await persist('sample', sop, clarifications);

const outputs = await render(sop);
console.log(outputs.markdown.content);
console.log(`Narrated by the ${sop.narrator} provider. Wrote ${sop.steps.length} steps (md, docx, html) to ${dir}`);
if (clarifications.length) {
  console.log(`\n${clarifications.length} question(s) for review:`);
  for (const c of clarifications) console.log(`  - ${c.text}`);
}
