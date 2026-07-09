// Collects events for the active recording, attaches a keyframe to each, and
// ships the batch — with any context the user added — to the pipeline when
// recording stops.
//
// Durability rules, in order of importance:
// - Events are written to extension storage one key per event, so recordings
//   survive service-worker shutdowns and never rewrite the whole batch.
// - Every event gets a recording-global sequence on arrival; per-page counters
//   reset on navigation and can't be trusted for ordering.
// - A failed upload keeps the recording; nothing is deleted until the server
//   has accepted it.
// - Screenshots are only taken on the site where the recording started, so a
//   mid-task detour to another tab is never captured.

const PIPELINE_BASE = 'http://localhost:8787';
const CAPTURE_INTERVAL_MS = 400;
const IDLE_REMIND_MINUTES = 5;

let lastCapture = 0;
let chain = Promise.resolve();

function enqueue(work) {
  const next = chain.then(work, work);
  chain = next.catch(() => {});
  return next;
}

async function activeTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

function keyframe(windowId, eventUrl, recordOrigin) {
  try {
    if (recordOrigin && new URL(eventUrl).origin !== recordOrigin) return Promise.resolve(null);
  } catch {
    return Promise.resolve(null);
  }
  const now = Date.now();
  if (now - lastCapture < CAPTURE_INTERVAL_MS) return Promise.resolve(null);
  lastCapture = now;
  return chrome.tabs
    .captureVisibleTab(windowId, { format: 'jpeg', quality: 60 })
    .catch(() => null);
}

function eventKey(n) {
  return `evt_${String(n).padStart(8, '0')}`;
}

function recordEvent(event, windowId) {
  return enqueue(async () => {
    const { recording, recordOrigin, eventCount = 0 } = await chrome.storage.local.get([
      'recording',
      'recordOrigin',
      'eventCount',
    ]);
    if (!recording) return; // a stale tab can't write phantom events

    // Capture as close to the action as possible, pinned to the tab's window.
    const shot = await keyframe(windowId, event.url, recordOrigin);

    await chrome.storage.local.set({
      [eventKey(eventCount)]: { ...event, seq: eventCount, keyframe: shot },
      eventCount: eventCount + 1,
      lastEventAt: Date.now(),
    });
    setBadge('rec');
  });
}

async function pendingEvents() {
  const all = await chrome.storage.local.get(null);
  return Object.keys(all)
    .filter((k) => k.startsWith('evt_'))
    .sort()
    .map((k) => all[k]);
}

async function clearRecordingData() {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith('evt_'));
  await chrome.storage.local.remove([...keys, 'eventCount', 'lastEventAt', 'lastRemindAt', 'recordOrigin']);
}

function setBadge(state) {
  if (state === 'rec') {
    chrome.action.setBadgeBackgroundColor({ color: '#b3362f' });
    chrome.action.setBadgeText({ text: 'REC' });
  } else if (state === 'error') {
    chrome.action.setBadgeBackgroundColor({ color: '#9a6b1f' });
    chrome.action.setBadgeText({ text: '!' });
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

async function setRecording(on) {
  await chrome.storage.local.set({ recording: on });

  if (on) {
    await clearRecordingData();
    const tab = await activeTab();
    let origin = null;
    try {
      origin = new URL(tab?.url).origin;
    } catch {
      // leave unset; screenshots will be skipped
    }
    await chrome.storage.local.set({ recordOrigin: origin, lastEventAt: Date.now() });
    chrome.alarms.create('idle-check', { periodInMinutes: 1 });
    setBadge('rec');

    // Storage-change listeners arm every open tab; this message just reaches
    // the active one faster, and tells us whether the recorder is attached.
    let attached = true;
    if (tab) {
      try {
        await chrome.tabs.sendMessage(tab.id, { kind: 'set-recording', on: true });
      } catch {
        attached = false;
      }
    }
    return { status: attached ? 'recording' : 'unreachable' };
  }

  chrome.alarms.clear('idle-check');
  setBadge('off');
  return enqueue(flush);
}

async function flush() {
  const events = await pendingEvents();
  if (events.length === 0) return { status: 'empty' };

  const { task, preNotes } = await chrome.storage.local.get(['task', 'preNotes']);
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
    if (!res.ok) throw new Error(`pipeline returned ${res.status}`);
    const result = await res.json();

    await clearRecordingData();
    await chrome.storage.local.remove(['task', 'preNotes']);
    setBadge('off');
    if (result?.review) chrome.tabs.create({ url: `${PIPELINE_BASE}${result.review}` });
    return { status: 'sent', steps: events.length };
  } catch {
    // Keep the events so the recording can be sent once the server is up.
    setBadge('error');
    return { status: 'offline', steps: events.length };
  }
}

async function remindIfIdle() {
  const { recording, lastEventAt, lastRemindAt } = await chrome.storage.local.get([
    'recording',
    'lastEventAt',
    'lastRemindAt',
  ]);
  if (!recording) {
    chrome.alarms.clear('idle-check');
    return;
  }

  setBadge('rec'); // re-assert after any worker restart

  const now = Date.now();
  const idleMinutes = Math.floor((now - (lastEventAt || now)) / 60000);
  const sinceRemind = now - (lastRemindAt || 0);
  if (idleMinutes >= IDLE_REMIND_MINUTES && sinceRemind >= IDLE_REMIND_MINUTES * 60000) {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title: 'SOPWizard is still recording',
      message: `No activity for ${idleMinutes} minutes. If the task is done, click the SOPWizard icon and choose "Stop & generate SOP".`,
    });
    await chrome.storage.local.set({ lastRemindAt: now });
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'idle-check') remindIfIdle();
});

chrome.runtime.onMessage.addListener((msg, sender, respond) => {
  if (msg.kind === 'event') {
    recordEvent(msg.event, sender.tab?.windowId);
    return;
  }
  if (msg.kind === 'toggle') {
    setRecording(msg.on).then((outcome) => respond(outcome));
    return true;
  }
  if (msg.kind === 'retry') {
    enqueue(flush).then((outcome) => respond(outcome));
    return true;
  }
});
