// Builds a structured SOP from segmented steps and any user-supplied context.
// The structured SOP is the single representation every exporter renders from.

import { getProvider } from './providers/index.js';

export function draft(recording, steps, context = {}) {
  const provider = getProvider();
  const narrated = steps.map((step) => ({ ...step, ...provider.narrate(step) }));

  return {
    title: context.task || defaultTitle(recording),
    createdAt: recording.capturedAt ?? null,
    context: { pre: context.pre || null, post: context.post || null },
    source: { url: originUrl(steps) },
    steps: narrated,
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
