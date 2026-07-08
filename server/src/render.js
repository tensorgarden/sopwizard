// Renders a structured SOP through every exporter.

import { exporters } from './export/index.js';

export function render(sop) {
  const outputs = {};
  for (const [name, exporter] of Object.entries(exporters)) {
    outputs[name] = { ext: exporter.ext, content: exporter.render(sop) };
  }
  return outputs;
}
