// Folds clarification answers and step corrections back into a SOP. Both edit
// only the parts they name, leaving the rest of the SOP untouched.
//
// A correction marked as applying to future workflows also becomes a durable
// lesson, loaded into context the next time a similar SOP is drafted. Editing
// an approved SOP demotes it to a draft — approval means "reviewed as-is".

import { addLesson } from './lessons.js';
import { redactText } from './redact.js';

function demoteIfApproved(sop) {
  if (sop.status === 'approved') {
    sop.status = 'candidate';
    delete sop.approvedAt;
  }
}

export function applyAnswers(sop, answers = []) {
  for (const answer of answers) {
    const text = redactText((answer.text || '').trim());
    if (!text) continue;
    demoteIfApproved(sop);

    if (answer.stepIndex == null) {
      const q = (sop.suggestedQuestions || []).find(
        (s) => s.stepIndex == null && s.text === answer.question && !s.answered
      );
      if (q) q.answered = true;
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
  demoteIfApproved(sop);

  const before = { title: step.title, detail: step.detail };
  const title = redactText(correction.title?.trim());
  const detail = redactText(correction.detail?.trim());

  if (title) step.title = title;
  if (detail) step.detail = detail;
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
