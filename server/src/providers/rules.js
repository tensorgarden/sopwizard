// Deterministic narration from the captured events alone — no model, no
// network. The fallback provider.
//
// This tier describes what happened and nothing more. It groups a run of form
// fields into one step because the event stream says they were one run, but
// can't say what the form was for, why a field matters, or what goes wrong —
// that needs domain knowledge the model tier supplies. A SOP from this provider
// alone is accurate but thin.

export const name = 'rules';

export async function narrate({ groups }) {
  return {
    steps: groups.map((group) => ({ keys: [group.key], ...one(group) })),
  };
}

function one(group) {
  const { actions } = group;

  if (actions.length > 1) {
    const fields = actions.map((a) => label(a.target));
    return {
      title: `Fill in ${list(fields)}`,
      detail: `Enter the required values in ${list(fields)}.`,
    };
  }

  const step = actions[0];
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

function list(items) {
  if (items.length <= 2) return items.join(' and ');
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

function pageName(url) {
  try {
    const { hostname, pathname } = new URL(url);
    return pathname === '/' ? hostname : hostname + pathname;
  } catch {
    return url;
  }
}
