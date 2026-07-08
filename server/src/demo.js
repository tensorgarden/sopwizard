// Runs the bundled sample recording through the pipeline and prints the SOP.
// Useful for working on segmentation/drafting without the extension.

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { run } from './pipeline.js';
import { persist } from './store.js';

const recording = JSON.parse(await readFile(join(process.cwd(), 'samples', 'recording.json'), 'utf8'));
const result = run(recording, recording.context || {});
const dir = await persist('sample', result);

console.log(result.outputs.markdown.content);
console.log(`Wrote ${result.sop.steps.length} steps to ${dir}`);
