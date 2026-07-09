// Model-backed narration over any chat-completions-style HTTP endpoint.
//
// Designed for small, inexpensive models: the whole SOP is narrated in a
// single request with a compact prompt and strict JSON output. Works with a
// local Ollama server out of the box (`ollama pull llama3.2`), or any hosted
// endpoint via LLM_URL / LLM_MODEL / LLM_API_KEY.
//
// Only redacted text ever reaches the model — screenshots stay local.

import { redactStep, redactText } from '../redact.js';

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

// Long recordings are narrated in chunks so the request always fits a small
// model's context window.
const CHUNK_SIZE = 40;

export async function narrate({ steps, context, lessons }) {
  const chunks = [];
  for (let i = 0; i < steps.length; i += CHUNK_SIZE) {
    chunks.push(steps.slice(i, i + CHUNK_SIZE));
  }

  const merged = { title: undefined, intro: undefined, steps: [], questions: [] };
  for (const [i, chunk] of chunks.entries()) {
    const part = await narrateChunk(chunk, context, lessons, {
      part: i + 1,
      of: chunks.length,
      total: steps.length,
    });
    if (i === 0) {
      merged.title = part.title;
      merged.intro = part.intro;
    }
    merged.steps.push(...part.steps);
    merged.questions.push(...part.questions);
  }
  return merged;
}

async function narrateChunk(steps, context, lessons, { part, of, total }) {
  const input = steps.map((step) => {
    const safe = redactStep(step);
    return {
      index: step.index,
      action: safe.action,
      element: safe.target?.name || safe.target?.role || safe.target?.tag || null,
      page: safe.url || null,
    };
  });

  const guidance = (lessons || [])
    .map((l) => `- ${redactText(l.rule)}`)
    .slice(0, 12)
    .join('\n');

  const prompt = [
    'Write a standard operating procedure from this recorded browser workflow.',
    of > 1 ? `This is part ${part} of ${of} — steps ${steps[0].index}–${steps.at(-1).index} of ${total} in one continuous workflow.` : '',
    context?.task ? `Task: ${redactText(context.task)}` : '',
    context?.pre ? `Context from the person who recorded it: ${redactText(context.pre)}` : '',
    guidance ? `Apply these lessons from past reviews:\n${guidance}` : '',
    '',
    'Recorded steps (JSON):',
    JSON.stringify(input),
    '',
    'Respond with JSON only, in exactly this shape:',
    '{"title": string, "intro": string, "steps": [{"index": number, "title": string, "detail": string}], "questions": [{"stepIndex": number|null, "text": string}]}',
    '',
    'Rules: one entry per recorded step, same indexes. Titles are short imperatives.',
    'Details are one or two sentences a new employee could follow. Do not invent',
    'steps or facts that are not in the recording. If something is ambiguous, add',
    'a question instead of guessing.',
  ]
    .filter(Boolean)
    .join('\n');

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
  const text = body.choices?.[0]?.message?.content || '';
  const parsed = parseJson(text);

  return {
    title: typeof parsed.title === 'string' ? parsed.title : undefined,
    intro: typeof parsed.intro === 'string' ? parsed.intro : undefined,
    steps: steps.map((step) => {
      const match = (parsed.steps || []).find((s) => s && Number(s.index) === step.index);
      return match?.title && match?.detail
        ? { title: String(match.title), detail: String(match.detail) }
        : null;
    }),
    questions: Array.isArray(parsed.questions)
      ? parsed.questions
          .filter((q) => typeof q?.text === 'string')
          .map((q) => {
            const idx = q.stepIndex == null || q.stepIndex === '' ? null : Number(q.stepIndex);
            return { stepIndex: Number.isInteger(idx) ? idx : null, text: q.text };
          })
      : [],
  };
}

function headers() {
  return process.env.LLM_API_KEY ? { authorization: `Bearer ${process.env.LLM_API_KEY}` } : {};
}

function parseJson(text) {
  const trimmed = text.replace(/^```(?:json)?/m, '').replace(/```\s*$/m, '').trim();
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('model response was not JSON');
  return JSON.parse(trimmed.slice(start, end + 1));
}
