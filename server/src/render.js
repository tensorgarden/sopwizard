// Renders a structured SOP through the exporters. Renderers may be async, so
// these are too.

import { exporters } from './export/index.js';

export async function render(sop) {
  const outputs = {};
  for (const [name, exporter] of Object.entries(exporters)) {
    outputs[name] = { ext: exporter.ext, content: await exporter.render(sop) };
  }
  return outputs;
}

export async function renderOne(sop, name) {
  const exporter = exporters[name];
  if (!exporter) throw new Error(`unknown exporter: ${name}`);
  return exporter.render(sop);
}
