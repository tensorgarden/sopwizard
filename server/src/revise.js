// Folds clarification answers and step corrections back into a SOP. Both edit
// only the parts they name, leaving the rest of the SOP untouched.

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

export function applyCorrection(sop, correction) {
  const step = sop.steps.find((s) => s.index === correction.stepIndex);
  if (!step) return sop;

  if (correction.title?.trim()) step.title = correction.title.trim();
  if (correction.detail?.trim()) step.detail = correction.detail.trim();
  step.corrected = true;

  return sop;
}
