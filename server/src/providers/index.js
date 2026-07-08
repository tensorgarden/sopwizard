// Narration providers.
//
// A provider implements `narrate(step) -> { title, detail }`. The default is a
// deterministic rule set; a model-backed provider (hosted or self-managed) can
// be added under the same interface and selected with SOP_PROVIDER, without
// touching the rest of the pipeline.

import * as rules from './rules.js';

const providers = { rules };

export function getProvider(name = process.env.SOP_PROVIDER || 'rules') {
  return providers[name] || providers.rules;
}
