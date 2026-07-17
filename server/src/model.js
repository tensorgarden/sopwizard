// The shape of a finished SOP. Every exporter, the review page, and sop.json
// read from here.
//
// Two content tiers: observed content the recording shows, and guidance —
// domain knowledge the recording cannot prove. Guidance carries `verified`; a
// person clears it before the SOP can be approved. It lives in its own field so
// that dropping every `guidance` key leaves a document containing only what was
// actually recorded.

export const OBSERVED = 'observed';
export const GUIDANCE = 'guidance';

// Sections that are guidance by nature — a recording can't show what to gather
// beforehand or what usually goes wrong.
const GUIDANCE_SECTIONS = ['prerequisites', 'decisions', 'troubleshooting', 'checklist'];

export function emptySop() {
  return {
    title: null,
    intro: null,
    status: 'candidate',
    createdAt: null,
    narrator: null,
    meta: emptyMeta(),
    context: { pre: null, post: null },
    source: { url: null },
    phases: [],
    steps: [],
    prerequisites: [],
    decisions: [],
    troubleshooting: [],
    checklist: [],
    suggestedQuestions: [],
  };
}

function emptyMeta() {
  return {
    system: null,
    workflow: null,
    audience: null,
    sensitivity: null,
    version: '1.0.0',
  };
}

// Fills in anything a SOP is missing. Documents written before the model grew
// phases and reference sections load through here without a migration.
export function normalize(sop) {
  const base = emptySop();
  const out = {
    ...base,
    ...sop,
    meta: { ...base.meta, ...(sop.meta || {}) },
    context: { ...base.context, ...(sop.context || {}) },
    source: { ...base.source, ...(sop.source || {}) },
    phases: Array.isArray(sop.phases) ? sop.phases : [],
    steps: (sop.steps || []).map(normalizeStep),
    suggestedQuestions: sop.suggestedQuestions || [],
  };

  // Each reference row carries a stable id, assigned once. Rulings address rows
  // by that id, so removing one can never shift the reference of another —
  // positional refs were how a reviewer's sign-off could land on the wrong claim.
  for (const section of GUIDANCE_SECTIONS) {
    out[section] = (Array.isArray(sop[section]) ? sop[section] : []).map((row, i) => ({
      ...row,
      verified: row.verified === true,
      gid: typeof row.gid === 'string' ? row.gid : `${section}-${i}`,
    }));
  }

  // Drop phase references that no phase answers to, so a renderer grouping by
  // phase can't silently lose a step.
  const known = new Set(out.phases.map((p) => p.id));
  for (const step of out.steps) {
    if (step.phaseId && !known.has(step.phaseId)) step.phaseId = null;
  }

  return out;
}

const KEYFRAME_RE = /^data:image\/(png|jpe?g|webp);base64,/;

function normalizeStep(step) {
  const out = {
    evidence: [],
    phaseId: null,
    ...step,
    guidance: step.guidance ? { ...step.guidance, verified: step.guidance.verified === true } : null,
  };

  // A keyframe is rendered into an <img src>. Accept only an inline image, so a
  // crafted recording can't plant an external URL that beacons when the guide is
  // opened or printed. Anything else becomes no image rather than a live fetch.
  if (out.keyframe != null && !(typeof out.keyframe === 'string' && KEYFRAME_RE.test(out.keyframe))) {
    out.keyframe = null;
  }

  // A step written before consolidation existed covers exactly one action — its
  // own. Backfilling it keeps the checks that read evidence working on old
  // documents instead of quietly finding nothing.
  if (!out.evidence.length && out.action) {
    out.evidence = [{ index: out.index, action: out.action, target: out.target ?? null, t: out.t ?? null }];
  }

  return out;
}

// Every guidance claim in the document that a person hasn't cleared yet, flat
// and addressable. The review page renders this; approval blocks on it.
export function unverifiedGuidance(sop) {
  const out = [];

  for (const step of sop.steps || []) {
    if (step.guidance && !step.guidance.verified) {
      out.push({
        gid: `step-${step.index}`,
        label: `Step ${step.index} — ${step.title}`,
        text: guidanceProse(step.guidance),
      });
    }
  }

  for (const section of GUIDANCE_SECTIONS) {
    for (const row of sop[section] || []) {
      if (row.verified) continue;
      out.push({
        gid: row.gid,
        label: SECTION_LABELS[section],
        text: rowProse(section, row),
      });
    }
  }

  return out;
}

const SECTION_LABELS = {
  prerequisites: 'Before you begin',
  decisions: 'Decision table',
  troubleshooting: 'Common problems',
  checklist: 'Completion checklist',
};

function guidanceProse(guidance) {
  return [guidance.whatToEnter, guidance.whyItMatters, guidance.howToDecide, guidance.exceptions]
    .filter(Boolean)
    .join(' ');
}

function rowProse(section, row) {
  switch (section) {
    case 'prerequisites':
      return [row.item, row.source, row.impact].filter(Boolean).join(' · ');
    case 'decisions':
      return [row.point, row.options, row.howToDecide, row.fallback].filter(Boolean).join(' · ');
    case 'troubleshooting':
      return [row.problem, row.cause, row.resolution].filter(Boolean).join(' · ');
    case 'checklist':
      return row.text || '';
    default:
      return '';
  }
}

// Keep or drop one guidance claim, addressed by its stable id. Dropping removes
// the claim entirely rather than leaving an unverified remnant in the document.
export function resolveGuidance(sop, { gid, keep }) {
  if (typeof gid !== 'string') return false;

  if (gid.startsWith('step-')) {
    const index = Number(gid.slice(5));
    const step = (sop.steps || []).find((s) => s.index === index);
    if (!step || !step.guidance) return false;
    if (keep) {
      step.guidance.verified = true;
    } else {
      // Record that a person rejected the claim rather than deleting it
      // silently — a rejection feeds the next draft as much as an approval.
      step.guidanceRemoved = true;
      step.guidance = null;
    }
    return true;
  }

  for (const section of GUIDANCE_SECTIONS) {
    const rows = sop[section] || [];
    const idx = rows.findIndex((r) => r.gid === gid);
    if (idx === -1) continue;
    if (keep) rows[idx].verified = true;
    else rows.splice(idx, 1);
    return true;
  }
  return false;
}

// True when the document carries anything beyond the recording. Drives whether
// the reference sections render at all.
export function hasGuidance(sop) {
  if ((sop.steps || []).some((s) => s.guidance)) return true;
  return GUIDANCE_SECTIONS.some((section) => (sop[section] || []).length > 0);
}

// How much recording a document represents. Steps are a judgment call the
// narrator makes; actions are what actually happened, so anything measuring the
// size of the work — billing, reporting — counts these instead.
export function actionsIn(sop) {
  return (sop.steps || []).reduce((n, step) => n + (step.evidence?.length || 1), 0);
}

export function durationOf(sop) {
  let last = 0;
  for (const step of sop.steps || []) {
    for (const action of step.evidence || []) last = Math.max(last, action.t ?? 0);
    last = Math.max(last, step.t ?? 0);
  }
  return last;
}
