// Open questions for a drafted SOP: whatever the narrator flagged, plus
// deterministic checks. A null stepIndex means the SOP as a whole.
//
// These cover what the recording couldn't capture. Guidance the narrator wrote
// is a separate gate (see unverifiedGuidance() in model.js): a question needs
// an answer, guidance needs a person to keep or remove existing text.

export function review(sop) {
  const questions = [];
  const seen = new Set();
  const add = (stepIndex, text) => {
    const key = `${stepIndex}:${text}`;
    if (!seen.has(key)) {
      seen.add(key);
      questions.push({ stepIndex, text });
    }
  };

  for (const q of sop.suggestedQuestions || []) {
    if (q.answered) continue;
    const step = q.stepIndex != null ? sop.steps.find((s) => s.index === q.stepIndex) : null;
    if (q.stepIndex != null && !step) continue;
    if (step?.clarified || step?.corrected) continue;
    add(q.stepIndex ?? null, q.text);
  }

  for (const step of sop.steps) {
    if (step.clarified || step.corrected) continue;

    // A step can cover several recorded actions now, so the checks run over the
    // evidence rather than the step's representative action.
    for (const action of step.evidence || []) {
      const target = action.target;

      if (action.action === 'change' && target?.tag === 'select') {
        add(step.index, `Which option did you choose for "${target.name || 'this dropdown'}", and when would you pick a different one?`);
      } else if ((action.action === 'click' || action.action === 'submit') && !target?.name) {
        add(step.index, `Step ${step.index}: one of the controls here has no clear label — what is it, and what does it do?`);
      }
    }
  }

  if (!sop.context.post) {
    add(null, 'Are there any exceptions or judgment calls a new person should know about?');
  }

  return questions;
}
