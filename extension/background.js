// Collects events for the active recording, attaches a keyframe to each, and
// ships the batch — with any context the user added — to the pipeline when
// recording stops.

const PIPELINE_URL = 'http://localhost:8787/recordings';
const CAPTURE_INTERVAL_MS = 400;

let events = [];
let lastCapture = 0;

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

async function context() {
  const { task, preNotes } = await chrome.storage.local.get(['task', 'preNotes']);
  return { task: task || '', pre: preNotes || '' };
}

async function setRecording(on) {
  await chrome.storage.local.set({ recording: on });
  if (on) events = [];

  const tab = await activeTab();
  if (tab) {
    chrome.tabs.sendMessage(tab.id, { kind: 'set-recording', on }).catch(() => {});
  }

  if (!on) await flush();
}

async function flush() {
  if (events.length === 0) return;

  const payload = { capturedAt: Date.now(), context: await context(), events };
  events = [];

  try {
    await fetch(PIPELINE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await chrome.storage.local.remove(['task', 'preNotes']);
  } catch (err) {
    console.warn('SOPWizard: could not reach the pipeline', err);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg.kind === 'event') {
    keyframe().then((shot) => events.push({ ...msg.event, keyframe: shot }));
    return;
  }
  if (msg.kind === 'toggle') {
    setRecording(msg.on).then(() => respond({ ok: true }));
    return true;
  }
});
