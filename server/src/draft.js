// Builds a structured SOP from segmented steps and any user-supplied context.
// The structured SOP is the single representation every exporter renders from.
//
// Narration comes from the active provider; if a model-backed provider fails
// mid-request, the deterministic rules provider fills in, so drafting never
// blocks on a model.

import { getProvider, rules } from './providers/index.js';
import { loadLessons } from './lessons.js';

export async function draft(recording, steps, context = {}) {
  const provider = await getProvider();
  const lessons = await loadLessons();

  let narration;
  try {
    narration = await provider.narrate({ steps, context, lessons });
  } catch {
    narration = await rules.narrate({ steps, context, lessons });
  }

  const fallback = await rules.narrate({ steps, context, lessons });
  const narrated = steps.map((step, i) => ({
    ...step,
    ...(narration.steps?.[i] || fallback.steps[i]),
  }));

  return {
    title: context.task || narration.title || defaultTitle(recording),
    intro: narration.intro || context.pre || null,
    status: 'candidate',
    createdAt: recording.capturedAt ?? null,
    narrator: provider.name,
    context: { pre: context.pre || null, post: context.post || null },
    source: { url: originUrl(steps) },
    steps: narrated,
    suggestedQuestions: narration.questions || [],
  };
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
