const taskInput = document.getElementById('task');
const notesInput = document.getElementById('notes');
const button = document.getElementById('toggle');
const retryButton = document.getElementById('retry');
const status = document.getElementById('status');
const statusText = document.getElementById('statusText');
const serverBanner = document.getElementById('server');

const HEALTH_URL = 'http://localhost:8787/health';

const MESSAGES = {
  recording: { text: 'Recording your workflow', cls: 'status live' },
  unreachable: {
    text: 'Recording — but this page needs a refresh before it can be captured. Reload it, then start working.',
    cls: 'status warn',
  },
  sent: { text: 'SOP generated — opening the review page', cls: 'status ok' },
  empty: {
    text: 'Nothing was captured. Refresh the page you want to record, then start again.',
    cls: 'status warn',
  },
  offline: {
    text: 'Recording saved. Start the SOPWizard app, then click Send last recording — nothing is lost.',
    cls: 'status warn',
  },
  'prev-unsent': {
    text: 'Your previous recording was kept. Start the SOPWizard app and use Send last recording before starting a new one.',
    cls: 'status warn',
  },
};

let serverUp = null; // null = not yet checked

async function checkServer() {
  try {
    const res = await fetch(HEALTH_URL, { signal: AbortSignal.timeout(1500), cache: 'no-store' });
    serverUp = res.ok;
  } catch {
    serverUp = false;
  }
  return serverUp;
}

async function state() {
  // Read the counter, not the whole recording — deserializing every base64
  // keyframe just to count events stalls the popup on a long recording.
  const { recording, task, preNotes, eventCount = 0 } = await chrome.storage.local.get([
    'recording',
    'task',
    'preNotes',
    'eventCount',
  ]);
  return { recording: Boolean(recording), task, preNotes, pending: eventCount };
}

// The banner that tells you whether the app the recorder sends to is running,
// before you record rather than after.
async function renderServer() {
  const { recording, pending } = await state();

  if (serverUp === null) {
    serverBanner.hidden = true;
    return;
  }

  if (!serverUp) {
    serverBanner.hidden = false;
    serverBanner.className = 'server down';
    serverBanner.textContent = pending
      ? 'The SOPWizard app isn’t running. Open it (keep its window open), then click Send last recording — your recording is saved.'
      : 'The SOPWizard app isn’t running. Open it and keep its window open before you record. Anything you record is saved and can be sent once it’s running.';
    return;
  }

  // Reachable. Point at the saved recording if there is one; otherwise stay out
  // of the way.
  if (pending && !recording) {
    serverBanner.hidden = false;
    serverBanner.className = 'server up';
    serverBanner.textContent = 'The SOPWizard app is running. Click Send last recording to finish your saved SOP.';
  } else {
    serverBanner.hidden = true;
  }
}

async function render(outcome) {
  const { recording, task, preNotes, pending } = await state();

  taskInput.value = task || '';
  notesInput.value = preNotes || '';
  button.textContent = recording ? 'Stop & generate SOP' : 'Start recording';
  button.className = recording ? 'stop' : 'start';
  button.disabled = false;

  const unsent = !recording && pending > 0;
  retryButton.hidden = !unsent;
  if (unsent) retryButton.textContent = `Send last recording (${pending} steps)`;

  await renderServer();

  // A server-side rejection carries its own reason from the pipeline.
  if (outcome?.status === 'server-error') {
    status.className = 'status warn';
    statusText.textContent = `Couldn't generate the SOP: ${outcome.message || 'the server rejected the recording'}`;
    return;
  }

  const msg = outcome ? MESSAGES[outcome.status] : recording ? MESSAGES.recording : null;
  status.className = msg?.cls || 'status';
  statusText.textContent =
    msg?.text || (unsent ? 'A recording is waiting to be sent. It will be sent before a new one starts.' : 'Idle');
}

taskInput.addEventListener('input', () => chrome.storage.local.set({ task: taskInput.value }));
notesInput.addEventListener('input', () => chrome.storage.local.set({ preNotes: notesInput.value }));

button.addEventListener('click', async () => {
  const { recording } = await chrome.storage.local.get('recording');
  button.disabled = true;
  if (recording) {
    button.textContent = 'Generating SOP…';
    status.className = 'status live';
    statusText.textContent = 'Uploading the recording and drafting your SOP…';
  }
  try {
    const outcome = await chrome.runtime.sendMessage({ kind: 'toggle', on: !recording });
    render(outcome);
  } catch {
    render();
  }
});

retryButton.addEventListener('click', async () => {
  retryButton.disabled = true;
  statusText.textContent = 'Sending…';
  try {
    const outcome = await chrome.runtime.sendMessage({ kind: 'retry' });
    await checkServer();
    render(outcome);
  } finally {
    retryButton.disabled = false;
  }
});

// Check on open, then keep watching while the popup is open, so starting the app
// updates the banner without reopening the popup.
render();
checkServer().then(() => renderServer());
setInterval(() => checkServer().then(() => renderServer()), 2500);
