// Deterministic narration.
//
// Turns a step into a short title and a one-line detail using only the captured
// event and element descriptor — no model, no network. It's the default
// provider so the pipeline runs anywhere, and the baseline a model is measured
// against.

export function narrate(step) {
  const target = label(step.target);

  switch (step.action) {
    case 'navigate':
      return { title: `Open ${pageName(step.url)}`, detail: `Go to ${step.url}.` };
    case 'click':
      return { title: `Click ${target}`, detail: `Click ${target}.` };
    case 'change':
      return { title: `Fill in ${target}`, detail: `Enter the required value in ${target}.` };
    case 'submit':
      return { title: `Submit ${target}`, detail: `Submit ${target} to save the changes.` };
    default:
      return { title: 'Step', detail: `Perform the ${step.action} action.` };
  }
}

function label(target) {
  if (!target) return 'the element';
  if (target.name) return `"${target.name}"`;
  if (target.role) return `the ${target.role}`;
  return `the ${target.tag || 'element'}`;
}

function pageName(url) {
  try {
    const { hostname, pathname } = new URL(url);
    return pathname === '/' ? hostname : hostname + pathname;
  } catch {
    return url;
  }
}
