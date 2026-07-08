// Looks over a drafted SOP and asks targeted questions where the recording
// alone can't explain intent. Deterministic today; the same output shape can
// later come from a model that checks the draft against the source.
//
// A question with a null stepIndex applies to the SOP as a whole.

export function review(sop) {
  const questions = [];

  for (const step of sop.steps) {
    if (step.clarified) continue;
    const target = step.target;

    if (step.action === 'change' && target?.tag === 'select') {
      questions.push({
        stepIndex: step.index,
        text: `Which option did you choose for "${target.name || 'this dropdown'}", and when would you pick a different one?`,
      });
    } else if ((step.action === 'click' || step.action === 'submit') && !target?.name) {
      questions.push({
        stepIndex: step.index,
        text: `Step ${step.index}: this control has no clear label — what is it, and what does it do?`,
      });
    }
  }

  if (!sop.context.post) {
    questions.push({
      stepIndex: null,
      text: 'Are there any exceptions or judgment calls a new person should know about?',
    });
  }

  return questions;
}
