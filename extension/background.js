// Collects events for the active recording and ships them to the pipeline.

const PIPELINE_URL = 'http://localhost:8787/recordings';

let events = [];

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
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

  const payload = { capturedAt: Date.now(), events };
  events = [];

  try {
    await fetch(PIPELINE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('SOPWizard: could not reach the pipeline', err);
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, respond) => {
  if (msg.kind === 'event') {
    events.push(msg.event);
    return;
  }
  if (msg.kind === 'toggle') {
    setRecording(msg.on).then(() => respond({ ok: true }));
    return true;
  }
});
