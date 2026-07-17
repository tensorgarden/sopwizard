// Groups the segmented event stream into candidate steps, keeping every raw
// action underneath as evidence so keyframes, timestamps, and the click trail
// survive.
//
// The grouping is structural: it merges a run of fields on one page but can't
// tell that they add up to one task. A model provider regroups on top of this;
// the boundaries below are the fallback when no model runs.

export function consolidate(steps) {
  const groups = [];

  for (const step of steps) {
    const previous = groups.at(-1);

    if (canExtend(previous, step)) {
      previous.actions.push(step);
      continue;
    }

    groups.push({
      key: `g${groups.length + 1}`,
      url: step.url ?? null,
      actions: [step],
    });
  }

  return groups.map((group, i) => ({ ...group, index: i + 1 }));
}

// Only consecutive data entry on one page merges. A navigation or click is a
// boundary and starts a new group.
function canExtend(group, step) {
  if (!group || step.action !== 'change') return false;
  if (group.url !== step.url) return false;
  return group.actions.every((a) => a.action === 'change');
}

// The action whose screenshot best represents the group. The last field of a
// fill run shows the form populated; anything else is shown by its own frame.
export function representative(group) {
  const withFrame = group.actions.filter((a) => a.keyframe);
  const pool = withFrame.length ? withFrame : group.actions;
  return pool.at(-1) ?? group.actions[0];
}

// What the model gets to look at: one line per group, with the actions inside
// it named. Redaction has already run over these upstream.
export function describe(group) {
  return {
    key: group.key,
    page: group.url ?? null,
    actions: group.actions.map((a) => ({
      index: a.index,
      action: a.action,
      element: a.target?.name || a.target?.role || a.target?.tag || null,
    })),
  };
}
