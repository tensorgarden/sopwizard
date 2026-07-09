// Groups a raw event stream into ordered SOP steps.
//
// Steps break on natural boundaries: a navigation is inserted whenever the URL
// changes, and every recorded interaction becomes its own step. Events are
// ordered by their sequence number, so out-of-order delivery is fine. Each
// step keeps its offset from the start of the recording so the SOP can cite
// its evidence.

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
