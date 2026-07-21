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

  // The narrator's own questions are targeted and few.
  for (const q of sop.suggestedQuestions || []) {
    if (q.answered) continue;
    const step = q.stepIndex != null ? sop.steps.find((s) => s.index === q.stepIndex) : null;
    if (q.stepIndex != null && !step) continue;
    if (step?.clarified || step?.corrected) continue;
    add(q.stepIndex ?? null, q.text);
  }

  // Deterministic checks, kept few on purpose: a long recording has many
  // dropdowns and unlabeled controls, and one question apiece would bury the
  // reviewer. Dropdowns are capped; unlabeled controls collapse into one.
  const DROPDOWN_LIMIT = 4;
  const unlabeled = [];
  let dropdowns = 0;

  for (const step of sop.steps) {
    if (step.clarified || step.corrected) continue;
    for (const action of step.evidence || []) {
      const target = action.target;
      if (action.action === 'change' && target?.tag === 'select') {
        if (dropdowns < DROPDOWN_LIMIT) {
          add(step.index, `Which option did you choose for "${target.name || 'this dropdown'}", and when would you pick a different one?`);
          dropdowns += 1;
        }
      } else if ((action.action === 'click' || action.action === 'submit') && !target?.name) {
        unlabeled.push(step.index);
      }
    }
  }

  if (unlabeled.length) {
    const shown = unlabeled.slice(0, 8).join(', ');
    add(
      null,
      `A few steps (${shown}${unlabeled.length > 8 ? ', and more' : ''}) act on controls with no clear label — can you say what they do?`
    );
  }

  if (!sop.context.post) {
    add(null, 'Are there any exceptions or judgment calls a new person should know about?');
  }

  return questions;
}
