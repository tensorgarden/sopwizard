// Folds answers, corrections, and guidance rulings back into a SOP, touching
// only the parts they name. Editing an approved SOP demotes it to a draft.

import { addLesson } from './lessons.js';
import { redactText } from './redact.js';
import { resolveGuidance, unverifiedGuidance } from './model.js';

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
      // Mark the matching open question answered, so an approved export doesn't
      // keep listing it under "Open questions" forever.
      const q = (sop.suggestedQuestions || []).find(
        (s) => s.stepIndex === answer.stepIndex && !s.answered && (s.text === answer.question || answer.question == null)
      );
      if (q) q.answered = true;
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

// Keep or drop guidance the narrator wrote. Each is addressed by a stable id,
// so a batch of rulings can't shift each other's targets as rows are removed.
export function applyGuidance(sop, rulings = []) {
  let changed = false;
  for (const ruling of rulings) {
    if (resolveGuidance(sop, { gid: ruling.gid, keep: ruling.keep === true })) changed = true;
  }
  if (changed) demoteIfApproved(sop);
  return sop;
}

// Approval gate: refuses while any guidance claim is still unreviewed, since
// the recording can't vouch for guidance and a person must. The error is marked
// to surface to the reviewer.
export function approve(sop) {
  const pending = unverifiedGuidance(sop);
  if (pending.length) {
    throw Object.assign(
      new Error(
        `${pending.length} guidance ${pending.length === 1 ? 'claim' : 'claims'} still need review — keep or remove each one before approving`
      ),
      { expose: true }
    );
  }
  sop.status = 'approved';
  sop.approvedAt = Date.now();
  return sop;
}
