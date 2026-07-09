// A provider implements narrate({ steps, context, lessons }) -> { title?,
// intro?, steps, questions? }. The model provider is used when reachable
// (or when SOP_PROVIDER forces one); rules otherwise.

import * as rules from './rules.js';
import * as llm from './llm.js';

export async function getProvider() {
  const forced = process.env.SOP_PROVIDER;
  if (forced === 'rules') return rules;
  if (forced === 'llm') return llm;

  return (await llm.available()) ? llm : rules;
}

export { rules, llm };
