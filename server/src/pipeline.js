// Runs a recording through the pipeline: segment → draft → export.

import { segment } from './segment.js';
import { draft } from './draft.js';
import { exporters } from './export/index.js';

export function run(recording, context = {}) {
  const steps = segment(recording);
  const sop = draft(recording, steps, context);

  const outputs = {};
  for (const [name, exporter] of Object.entries(exporters)) {
    outputs[name] = { ext: exporter.ext, content: exporter.render(sop) };
  }

  return { sop, outputs };
}
