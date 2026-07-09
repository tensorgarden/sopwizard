// Collects the open questions for a drafted SOP: anything the narrator flagged
// as ambiguous, plus deterministic checks the recording alone can't answer.
//
// A question with a null stepIndex applies to the SOP as a whole.

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
    const step = q.stepIndex != null ? sop.steps.find((s) => s.index === q.stepIndex) : null;
    if (q.stepIndex != null && !step) continue;
    if (step?.clarified) continue;
    add(q.stepIndex ?? null, q.text);
  }

  for (const step of sop.steps) {
    if (step.clarified) continue;
    const target = step.target;

    if (step.action === 'change' && target?.tag === 'select') {
      add(step.index, `Which option did you choose for "${target.name || 'this dropdown'}", and when would you pick a different one?`);
    } else if ((step.action === 'click' || step.action === 'submit') && !target?.name) {
      add(step.index, `Step ${step.index}: this control has no clear label — what is it, and what does it do?`);
    }
  }

  if (!sop.context.post) {
    add(null, 'Are there any exceptions or judgment calls a new person should know about?');
  }

  return questions;
}
