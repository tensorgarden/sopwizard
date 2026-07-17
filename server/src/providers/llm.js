// Model-backed narration over any chat-completions endpoint. Works with a
// local Ollama out of the box, or set LLM_URL / LLM_MODEL / LLM_API_KEY.
// Only redacted text reaches the model; screenshots stay local.
//
// Two passes. The first turns grouped events into phases and steps. The second
// reads the finished steps back and writes the reference sections (what to
// gather first, what to decide, what goes wrong), which are whole-document
// questions no single chunk of events can answer.
//
// Both passes may emit `guidance`: domain knowledge no recording contains. It
// is kept in its own field, and a person clears it before the SOP can be
// approved. See model.js.

import { describe } from '../consolidate.js';
import { redactText } from '../redact.js';

export const name = 'llm';

const URL_BASE = process.env.LLM_URL || 'http://localhost:11434/v1';
const MODEL = process.env.LLM_MODEL || 'llama3.2';
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 20000);

export async function available() {
  try {
    const res = await fetch(`${URL_BASE}/models`, {
      headers: headers(),
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Groups are already an order of magnitude fewer than raw events, but a long
// recording still needs to fit a small model's context.
const CHUNK_SIZE = 25;

export async function narrate({ groups, context, lessons }) {
  const chunks = [];
  for (let i = 0; i < groups.length; i += CHUNK_SIZE) {
    chunks.push(groups.slice(i, i + CHUNK_SIZE));
  }

  const merged = { title: undefined, intro: undefined, phases: [], steps: [], questions: [] };
  const seenPhase = new Set();

  for (const [i, chunk] of chunks.entries()) {
    const meta = { part: i + 1, of: chunks.length, total: groups.length };

    // A single failed chunk shouldn't discard the chunks that succeeded. Retry
    // it once; if it still fails, skip it — its groups stay unclaimed and pick up
    // deterministic narration downstream, so the SOP is complete either way.
    let part;
    try {
      part = await narrateChunk(chunk, context, lessons, meta);
    } catch {
      try {
        part = await narrateChunk(chunk, context, lessons, meta);
      } catch (err) {
        console.warn(`narration chunk ${i + 1}/${chunks.length} failed after retry: ${err.message}`);
        continue;
      }
    }

    if (merged.title === undefined && part.title) merged.title = part.title;
    if (merged.intro === undefined && part.intro) merged.intro = part.intro;
    for (const phase of part.phases) {
      if (seenPhase.has(phase.id)) continue;
      seenPhase.add(phase.id);
      merged.phases.push(phase);
    }
    merged.steps.push(...part.steps);
    merged.questions.push(...part.questions);
  }

  return merged;
}

async function narrateChunk(groups, context, lessons, { part, of, total }) {
  const guidance = (lessons || [])
    .map((l) => `- ${redactText(l.rule)}`)
    .slice(0, 12)
    .join('\n');

  const prompt = [
    'Write the steps of a standard operating procedure from this recorded browser workflow.',
    of > 1 ? `This is part ${part} of ${of} — groups ${groups[0].key}–${groups.at(-1).key} of ${total} in one continuous workflow.` : '',
    context?.task ? `Task: ${redactText(context.task)}` : '',
    context?.pre ? `Context from the person who recorded it: ${redactText(context.pre)}` : '',
    guidance ? `Apply these lessons from past reviews:\n${guidance}` : '',
    '',
    'The recording is grouped into candidate actions. Combine adjacent groups into a',
    'single step whenever they add up to one thing the person was accomplishing. A',
    'reader wants the dozen things that happened, not every click.',
    '',
    'Recorded groups (JSON):',
    JSON.stringify(groups.map(describe)),
    '',
    'Respond with JSON only, in exactly this shape:',
    '{"title": string, "intro": string, "phases": [{"id": string, "title": string, "summary": string}], "steps": [{"keys": [string], "phaseId": string, "title": string, "detail": string, "guidance": {"whatToEnter": string, "whyItMatters": string, "howToDecide": string, "exceptions": string}}], "questions": [{"stepKey": string|null, "text": string}]}',
    '',
    'Rules:',
    '- Every group key appears in exactly one step, in the order recorded.',
    '- Titles are short imperatives. Phases are the 3–7 stages of the workflow.',
    '- "detail" describes only what the recording shows. Nothing goes in "detail"',
    '  that the recording does not show.',
    '- "guidance" is for what a new employee needs and the screen cannot show:',
    '  where a value comes from, why it matters, how to choose between options,',
    '  what the exceptions are. A person reviews every line of it before the SOP',
    '  is published, so include it where you have real knowledge of this system or',
    '  industry, and omit the whole field where you do not. Never pad it.',
    '- If something is genuinely ambiguous, ask a question instead of writing',
    '  guidance about it.',
  ]
    .filter(Boolean)
    .join('\n');

  const parsed = await complete(prompt);
  const valid = new Set(groups.map((g) => g.key));

  return {
    title: str(parsed.title),
    intro: str(parsed.intro),
    phases: array(parsed.phases)
      .filter((p) => str(p?.id) && str(p?.title))
      .map((p) => ({ id: String(p.id), title: String(p.title), summary: str(p.summary) ?? null })),
    steps: claimKeys(array(parsed.steps), valid),
    questions: array(parsed.questions)
      .filter((q) => str(q?.text))
      .map((q) => ({ stepKey: str(q.stepKey) ?? null, text: String(q.text) })),
  };
}

// A step owns the groups it names. Keys the model invented, or claimed twice,
// are dropped — draft.js covers whatever is left over so no recorded action can
// fall out of the document.
function claimKeys(steps, valid) {
  const claimed = new Set();
  const out = [];

  for (const step of steps) {
    if (!str(step?.title) || !str(step?.detail)) continue;
    const keys = array(step.keys).filter((k) => valid.has(k) && !claimed.has(k));
    if (!keys.length) continue;
    for (const k of keys) claimed.add(k);

    out.push({
      keys,
      phaseId: str(step.phaseId) ?? null,
      title: String(step.title),
      detail: String(step.detail),
      guidance: guidanceOf(step.guidance),
    });
  }

  return out;
}

function guidanceOf(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const block = {
    whatToEnter: str(raw.whatToEnter) ?? null,
    whyItMatters: str(raw.whyItMatters) ?? null,
    howToDecide: str(raw.howToDecide) ?? null,
    exceptions: str(raw.exceptions) ?? null,
  };
  const empty = Object.values(block).every((v) => v == null);
  return empty ? null : { ...block, verified: false };
}

// Second pass: the reference sections. These are questions about the workflow
// as a whole, so they run once over the finished steps rather than per chunk.
export async function sections({ sop, context }) {
  const steps = sop.steps.map((s) => ({
    index: s.index,
    title: s.title,
    detail: s.detail,
    fields: s.evidence.map((e) => e.target?.name).filter(Boolean),
  }));

  const prompt = [
    `Here are the finished steps of a standard operating procedure titled "${redactText(sop.title)}".`,
    sop.source.url ? `It was recorded in ${redactText(sop.source.url)}.` : '',
    context?.task ? `Task: ${redactText(context.task)}` : '',
    context?.pre ? `Context from the person who recorded it: ${redactText(context.pre)}` : '',
    '',
    'Steps (JSON):',
    JSON.stringify(steps),
    '',
    'Write the reference sections that turn this from a click log into a training',
    'document a new employee could work from.',
    '',
    'Respond with JSON only, in exactly this shape:',
    '{"meta": {"system": string, "workflow": string, "audience": string, "sensitivity": string}, "prerequisites": [{"item": string, "source": string, "impact": string}], "decisions": [{"point": string, "options": string, "howToDecide": string, "fallback": string}], "troubleshooting": [{"problem": string, "cause": string, "resolution": string}], "checklist": [string]}',
    '',
    'Rules:',
    '- "prerequisites" are what to gather before starting, and where each comes from.',
    '- "decisions" are the points where the answer is not obvious from the screen.',
    '- "troubleshooting" is what actually goes wrong and what to do about it.',
    '- "checklist" is how a person knows they finished correctly.',
    '- "sensitivity" names the sensitive data this workflow touches, or is null.',
    '- Every row here is domain knowledge that a person reviews before the SOP is',
    '  published. Write only what you actually know about this system or industry.',
    '  Empty arrays are correct when you do not know. Do not pad, and do not',
    '  restate the steps.',
  ]
    .filter(Boolean)
    .join('\n');

  const parsed = await complete(prompt);

  return {
    meta: {
      system: str(parsed.meta?.system) ?? null,
      workflow: str(parsed.meta?.workflow) ?? null,
      audience: str(parsed.meta?.audience) ?? null,
      sensitivity: str(parsed.meta?.sensitivity) ?? null,
    },
    prerequisites: rows(parsed.prerequisites, ['item', 'source', 'impact']),
    decisions: rows(parsed.decisions, ['point', 'options', 'howToDecide', 'fallback']),
    troubleshooting: rows(parsed.troubleshooting, ['problem', 'cause', 'resolution']),
    checklist: array(parsed.checklist)
      .filter((t) => str(t))
      .map((text) => ({ text: String(text), verified: false })),
  };
}

// Every reference row is unverified guidance the moment it is written.
function rows(raw, fields) {
  return array(raw)
    .filter((row) => row && fields.some((f) => str(row[f])))
    .map((row) => {
      const out = { verified: false };
      for (const f of fields) out[f] = str(row[f]) ?? null;
      return out;
    });
}

async function complete(prompt) {
  const res = await fetch(`${URL_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers() },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      messages: [
        { role: 'system', content: 'You write clear, accurate standard operating procedures. You respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) throw new Error(`model endpoint returned ${res.status}`);

  const body = await res.json();
  return parseJson(body.choices?.[0]?.message?.content || '');
}

function headers() {
  return process.env.LLM_API_KEY ? { authorization: `Bearer ${process.env.LLM_API_KEY}` } : {};
}

function str(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function parseJson(text) {
  const trimmed = text.replace(/^```(?:json)?/m, '').replace(/```\s*$/m, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('model response was not JSON');
  return JSON.parse(trimmed.slice(start, end + 1));
}
