// Collects events for the active recording, attaches a keyframe to each, and
// ships the batch — with any context the user added — to the pipeline when
// recording stops.
//
// Events are persisted to extension storage as they arrive, because MV3
// service workers can be shut down between events; a long pause mid-recording
// must not lose captured steps. Writes are chained so they never interleave.

const PIPELINE_BASE = 'http://localhost:8787';
const CAPTURE_INTERVAL_MS = 400;

let lastCapture = 0;
let chain = Promise.resolve();

function enqueue(work) {
  chain = chain.then(work, work);
  return chain;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function keyframe() {
  const now = Date.now();
  if (now - lastCapture < CAPTURE_INTERVAL_MS) return null;
  lastCapture = now;
  try {
    return await chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: 60 });
  } catch {
    return null;
  }
}

function recordEvent(event) {
  return enqueue(async () => {
    const shot = await keyframe();
    const { events = [] } = await chrome.storage.local.get('events');
    events.push({ ...event, keyframe: shot });
    await chrome.storage.local.set({ events });
  });
}

async function setRecording(on) {
  await chrome.storage.local.set({ recording: on });
  if (on) await chrome.storage.local.set({ events: [] });

  const tab = await activeTab();
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { kind: 'set-recording', on }).catch(() => {});
  }

  if (on) return { status: 'recording' };
  return enqueue(flush);
}

async function flush() {
  const { events = [], task, preNotes } = await chrome.storage.local.get(['events', 'task', 'preNotes']);
  if (events.length === 0) return { status: 'empty' };

  const payload = {
    capturedAt: Date.now(),
    context: { task: task || '', pre: preNotes || '' },
    events,
  };

  try {
    const res = await fetch(`${PIPELINE_BASE}/recordings`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const result = await res.json();
    await chrome.storage.local.remove(['events', 'task', 'preNotes']);
    if (result?.review) chrome.tabs.create({ url: `${PIPELINE_BASE}${result.review}` });
    return { status: 'sent', steps: events.length };
  } catch {
    // Keep the events so the recording can be sent once the server is up.
    return { status: 'offline', steps: events.length };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg.kind === 'event') {
    recordEvent(msg.event);
    return;
  }
  if (msg.kind === 'toggle') {
    setRecording(msg.on).then((outcome) => respond(outcome ?? { status: 'ok' }));
    return true;
  }
  if (msg.kind === 'retry') {
    enqueue(flush).then((outcome) => respond(outcome));
    return true;
  }
});
