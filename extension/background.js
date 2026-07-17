// Collects events for the active recording and ships the batch to the pipeline
// on stop. Events persist to storage one key per event (service workers get
// killed), get a global sequence on arrival (per-frame counters reset), and are
// kept until the server accepts them.
//
// Capture is scoped to the tab the recording started in, so a click or
// screenshot from another tab never lands in the SOP.

const PIPELINE_BASE = 'http://localhost:8787';
const CAPTURE_INTERVAL_MS = 550; // stay under Chrome's ~2 captures/second quota
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

// One frame at a time and throttled — captureVisibleTab grabs the window's
// active tab, which is the recorded tab at the moment its own event fires.
function keyframe(windowId) {
  const now = Date.now();
  if (now - lastCapture < CAPTURE_INTERVAL_MS) return Promise.resolve(null);
  lastCapture = now;
  const shot =
    windowId != null
      ? chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 60 })
      : chrome.tabs.captureVisibleTab({ format: 'jpeg', quality: 60 });
  return shot.catch(() => null);
}

function eventKey(n) {
  return `evt_${String(n).padStart(8, '0')}`;
}

function recordEvent(event, tab) {
  return enqueue(async () => {
    const { recording, recordTabId, eventCount = 0 } = await chrome.storage.local.get([
      'recording',
      'recordTabId',
      'eventCount',
    ]);
    if (!recording) return;

    // Only the tab being recorded. Storage.onChanged arms every tab, so without
    // this a click in any other tab would be captured and sent to the model.
    if (recordTabId != null && tab?.id !== recordTabId) return;

    const shot = await keyframe(tab?.windowId);
    const entry = { ...event, seq: eventCount, keyframe: shot };
    try {
      await chrome.storage.local.set({ [eventKey(eventCount)]: entry, eventCount: eventCount + 1, lastEventAt: Date.now() });
      setBadge('rec');
    } catch {
      // Usually storage quota from an oversized keyframe — keep the step, drop
      // the screenshot, and flag it rather than silently losing the event.
      setBadge('error');
      try {
        await chrome.storage.local.set({
          [eventKey(eventCount)]: { ...entry, keyframe: null },
          eventCount: eventCount + 1,
          lastEventAt: Date.now(),
        });
        setBadge('rec');
      } catch {
        // Nothing more we can safely do; the error badge stays up.
      }
    }
  });
}

async function pendingEvents() {
  const all = await chrome.storage.local.get(null);
  return Object.keys(all)
    .filter((k) => k.startsWith('evt_'))
    .sort()
    .map((k) => all[k]);
}

async function pendingCount() {
  const { eventCount = 0 } = await chrome.storage.local.get('eventCount');
  return eventCount;
}

async function clearRecordingData() {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith('evt_'));
  await chrome.storage.local.remove([...keys, 'eventCount', 'lastEventAt', 'lastRemindAt', 'recordTabId', 'recordingId']);
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
  if (on) {
    // Starting a new recording clears storage, so preserve a previous unsent
    // recording first. If it can't be sent, keep it and tell the popup rather
    // than starting over.
    if ((await pendingCount()) > 0) {
      const prev = await enqueue(flush);
      if (prev.status !== 'sent' && prev.status !== 'empty') {
        return { status: 'prev-unsent', steps: prev.steps ?? 0 };
      }
    }

    await chrome.storage.local.set({ recording: true });
    await clearRecordingData();

    const tab = await activeTab();
    await chrome.storage.local.set({
      recordTabId: tab?.id ?? null,
      recordingId: crypto.randomUUID(),
      lastEventAt: Date.now(),
    });
    chrome.alarms.create('idle-check', { periodInMinutes: 1 });
    setBadge('rec');

    // Storage changes arm every tab; the message tells us whether the recorder
    // is attached to this one.
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

  await chrome.storage.local.set({ recording: false });
  chrome.alarms.clear('idle-check');
  setBadge('off');
  return enqueue(flush);
}

async function flush() {
  const events = await pendingEvents();
  if (events.length === 0) return { status: 'empty' };

  const { task, preNotes, recordingId } = await chrome.storage.local.get(['task', 'preNotes', 'recordingId']);
  const payload = {
    recordingId, // resent on retry so a lost response can't duplicate the SOP
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

    if (!res.ok) {
      // The server is up but rejected the recording — surface its reason instead
      // of the misleading "not reachable". Keep the events for a retry.
      let message = `the server returned ${res.status}`;
      try {
        const data = await res.json();
        if (data?.error) message = data.error;
      } catch {
        // no JSON body
      }
      setBadge('error');
      return { status: 'server-error', message, steps: events.length };
    }

    const result = await res.json().catch(() => ({}));
    await clearRecordingData();
    await chrome.storage.local.remove(['task', 'preNotes']);
    setBadge('off');
    if (result?.review) chrome.tabs.create({ url: `${PIPELINE_BASE}${result.review}` });
    return { status: 'sent', steps: events.length };
  } catch {
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
    recordEvent(msg.event, sender.tab);
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
