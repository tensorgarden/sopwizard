// Runs a recording through the pipeline: segment → draft → review.
// Rendering and persistence happen after, so edited SOPs re-render the same way.

import { segment } from './segment.js';
import { draft } from './draft.js';
import { review } from './review.js';

export async function run(recording, context = {}) {
  const steps = segment(recording);
  const sop = await draft(recording, steps, context);
  const clarifications = review(sop);
  return { sop, clarifications };
}
