// Groups the raw event stream into ordered steps: a navigation step whenever
// the URL changes, one step per interaction. Each step keeps its offset from
// the start of the recording.

export function segment(recording) {
  const events = [...(recording.events || [])].sort((a, b) => a.seq - b.seq);
  const t0 = events.find((e) => e.at)?.at ?? null;
  const offset = (at) => (t0 != null && at != null ? Math.max(0, at - t0) : null);

  const steps = [];
  let lastUrl = null;

  for (const event of events) {
    if (event.url && event.url !== lastUrl) {
      steps.push({ action: 'navigate', url: event.url, at: event.at, t: offset(event.at) });
      lastUrl = event.url;
    }

    steps.push({
      action: event.type,
      target: event.target || null,
      url: event.url,
      at: event.at,
      t: offset(event.at),
      viewport: event.viewport || null,
      keyframe: event.keyframe || null,
    });
  }

  return steps.map((step, i) => ({ index: i + 1, ...step }));
}
