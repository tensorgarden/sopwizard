// Renders a structured SOP through every exporter. Renderers may be async, so
// this is too.

import { exporters } from './export/index.js';

export async function render(sop) {
  const outputs = {};
  for (const [name, exporter] of Object.entries(exporters)) {
    outputs[name] = { ext: exporter.ext, content: await exporter.render(sop) };
  }
  return outputs;
}
