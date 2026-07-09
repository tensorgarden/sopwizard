// Folds clarification answers and step corrections back into a SOP. Both edit
// only the parts they name, leaving the rest of the SOP untouched.
//
// A correction marked as applying to future workflows also becomes a durable
// lesson, loaded into context the next time a similar SOP is drafted.

import { addLesson } from './lessons.js';

export function applyAnswers(sop, answers = []) {
  for (const answer of answers) {
    const text = (answer.text || '').trim();
    if (!text) continue;

    if (answer.stepIndex == null) {
      sop.context.post = sop.context.post ? `${sop.context.post}\n\n${text}` : text;
      continue;
    }

    const step = sop.steps.find((s) => s.index === answer.stepIndex);
    if (step) {
      step.detail = `${step.detail} ${text}`;
      step.clarified = true;
    }
  }
  return sop;
}

export async function applyCorrection(sop, correction) {
  const step = sop.steps.find((s) => s.index === correction.stepIndex);
  if (!step) return sop;

  const before = { title: step.title, detail: step.detail };

  if (correction.title?.trim()) step.title = correction.title.trim();
  if (correction.detail?.trim()) step.detail = correction.detail.trim();
  step.corrected = true;

  if (correction.scope === 'future') {
    await addLesson({
      rule: `For steps like "${before.title}" (${step.action}${step.target?.name ? ` on "${step.target.name}"` : ''}), describe them as: "${step.title} — ${step.detail}"`,
      from: { was: before, now: { title: step.title, detail: step.detail } },
    });
  }

  return sop;
}

export function approve(sop) {
  sop.status = 'approved';
  sop.approvedAt = Date.now();
  return sop;
}
