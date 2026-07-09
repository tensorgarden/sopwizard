// Narration providers.
//
// A provider implements `narrate({ steps, context, lessons })` and returns
// `{ title?, intro?, steps: [{title, detail} | null], questions? }`. The
// model-backed provider is used when its endpoint is reachable (or when
// SOP_PROVIDER forces a choice); otherwise the deterministic rules provider
// keeps the pipeline working with no configuration at all.

import * as rules from './rules.js';
import * as llm from './llm.js';

export async function getProvider() {
  const forced = process.env.SOP_PROVIDER;
  if (forced === 'rules') return rules;
  if (forced === 'llm') return llm;

  return (await llm.available()) ? llm : rules;
}

export { rules, llm };
