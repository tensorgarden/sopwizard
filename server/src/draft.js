// Builds the structured SOP every exporter renders from.
//
// Two passes over the recording. The narration pass groups events into steps
// and describes them. The sections pass reads those steps back and writes the
// reference material around them: what to gather first, what to decide, what
// goes wrong. A provider that offers neither still yields a document, thinner.

import { getProvider, rules } from './providers/index.js';
import { consolidate, representative } from './consolidate.js';
import { emptySop, normalize } from './model.js';
import { workflowFingerprint } from './fingerprint.js';
import { lessonsFor } from './corpus.js';
import { loadLessons } from './lessons.js';
import { redactStep, redactText } from './redact.js';
import { logError } from './logger.js';

export async function draft(recording, steps, context = {}) {
  // Redact here so providers, exports, and sop.json all inherit it.
  steps = steps.map(redactStep);
  context = {
    ...context,
    task: redactText(context.task),
    pre: redactText(context.pre),
    post: redactText(context.post),
  };

  const groups = consolidate(steps);
  const provider = await getProvider();

  // Computed once, from the raw segmented steps, and carried on the document.
  // Contribution reads it back rather than recomputing from the narrated steps,
  // whose page URLs the merges collapse — otherwise the draft-time and
  // contribution-time keys disagree and the corpus never matches itself.
  const workflowFp = workflowFingerprint(steps);

  // This machine's lessons plus what other agencies settled on these same
  // screens. Consulted before drafting, not after: the aim is a better first
  // draft.
  const lessons = [...(await loadLessons()), ...(await lessonsFor({ workflow: workflowFp }))];

  // Track which provider actually produced the steps: a model failure falls back
  // to rules, and the document must not claim a model narrated a click log.
  let narratorUsed;
  let narration;
  try {
    narration = await provider.narrate({ groups, context, lessons });
    // The model can come back empty (every chunk failed and was skipped); if it
    // produced nothing, the steps are rules narration, so attribute them there.
    narratorUsed = narration.steps?.length ? provider.name : rules.name;
  } catch (err) {
    logError(`narration failed, using deterministic fallback: ${err.message}`);
    narration = await rules.narrate({ groups, context, lessons });
    narratorUsed = rules.name;
  }

  const fallback = await rules.narrate({ groups, context, lessons });
  const { steps: assembled, ownerOf } = assemble(groups, narration, fallback);

  const sop = {
    ...emptySop(),
    title: context.task || narration.title || defaultTitle(recording),
    intro: narration.intro || context.pre || null,
    createdAt: recording.capturedAt ?? null,
    narrator: narratorUsed,
    context: { pre: context.pre || null, post: context.post || null },
    source: { url: originUrl(steps), workflowFingerprint: workflowFp },
    phases: usedPhases(narration.phases, assembled),
    steps: assembled,
    suggestedQuestions: questions(narration.questions, ownerOf),
  };

  sop.meta.system = hostOf(sop.source.url);
  sop.meta.workflow = sop.title;

  await addSections(sop, provider, context);

  return normalize(sop);
}

// The reference sections are the second pass, and the part a provider is most
// likely to get wrong or skip. A failure here leaves the steps intact rather
// than sinking the whole draft.
async function addSections(sop, provider, context) {
  if (typeof provider.sections !== 'function') return;

  try {
    const written = await provider.sections({ sop, context });
    sop.meta = {
      ...sop.meta,
      ...Object.fromEntries(Object.entries(written.meta || {}).filter(([, v]) => v)),
    };
    sop.prerequisites = written.prerequisites || [];
    sop.decisions = written.decisions || [];
    sop.troubleshooting = written.troubleshooting || [];
    sop.checklist = written.checklist || [];
  } catch {
    // Steps without reference sections is a thinner SOP, not a failed one.
  }
}

// Turns the narrator's claims over group keys into ordered steps. Anything the
// narrator didn't claim falls back to rules narration, so no recorded action
// can drop out of the document even if the model ignores half the input.
function assemble(groups, narration, fallback) {
  const byKey = new Map(groups.map((g) => [g.key, g]));
  const claimed = new Set();
  const items = [];

  for (const step of narration.steps || []) {
    const keys = (step.keys || []).filter((k) => byKey.has(k) && !claimed.has(k));
    if (!keys.length || !step.title || !step.detail) continue;
    for (const k of keys) claimed.add(k);
    items.push({
      keys,
      title: step.title,
      detail: step.detail,
      phaseId: step.phaseId ?? null,
      guidance: step.guidance ?? null,
    });
  }

  for (const group of groups) {
    if (claimed.has(group.key)) continue;
    const spare = fallback.steps.find((s) => s.keys[0] === group.key);
    items.push({ keys: [group.key], title: spare.title, detail: spare.detail, phaseId: null, guidance: null });
  }

  items.sort((a, b) => byKey.get(a.keys[0]).index - byKey.get(b.keys[0]).index);
  const steps = items.map((item, i) => finish(item, i + 1, byKey));

  // Which step swallowed which group — the narrator's questions arrive keyed to
  // groups, and this is the only place that mapping exists.
  const ownerOf = new Map();
  items.forEach((item, i) => {
    for (const key of item.keys) ownerOf.set(key, steps[i].index);
  });

  return { steps, ownerOf };
}

function finish(item, index, byKey) {
  const actions = item.keys
    .flatMap((k) => byKey.get(k).actions)
    .sort((a, b) => a.index - b.index);

  // One frame per step rather than one per click: the step's own screenshot.
  const shown = representative({ actions });

  return {
    index,
    phaseId: item.phaseId,
    title: item.title,
    detail: item.detail,
    // What the narrator wrote, kept even after a person rewrites the step. The
    // gap between this and the final text is the training signal for the next
    // draft.
    draftedTitle: item.title,
    draftedDetail: item.detail,
    guidance: item.guidance,
    action: shown.action,
    target: shown.target ?? null,
    url: shown.url ?? null,
    viewport: shown.viewport ?? null,
    keyframe: shown.keyframe ?? null,
    t: actions[0].t ?? null,
    evidence: actions.map((a) => ({
      index: a.index,
      action: a.action,
      target: a.target ?? null,
      t: a.t ?? null,
    })),
  };
}

// Drop phases nothing points at, and order them by where their steps land.
function usedPhases(phases, steps) {
  const order = new Map();
  for (const step of steps) {
    if (step.phaseId && !order.has(step.phaseId)) order.set(step.phaseId, step.index);
  }
  return (phases || [])
    .filter((p) => order.has(p.id))
    .sort((a, b) => order.get(a.id) - order.get(b.id));
}

// Questions arrive keyed to a group; resolve each to the step that covered it.
// A question about a group nobody claimed becomes a question about the SOP.
function questions(raw, ownerOf) {
  return (raw || []).map((q) => ({
    stepIndex: (q.stepKey && ownerOf.get(q.stepKey)) ?? null,
    text: q.text,
  }));
}

function defaultTitle(recording) {
  const first = (recording.events || []).find((e) => e.url);
  return first ? `${hostOf(first.url)} workflow` : 'Recorded workflow';
}

function originUrl(steps) {
  const nav = steps.find((s) => s.action === 'navigate');
  return nav ? nav.url : steps[0]?.url ?? null;
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
