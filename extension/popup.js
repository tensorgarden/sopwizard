const taskInput = document.getElementById('task');
const notesInput = document.getElementById('notes');
const button = document.getElementById('toggle');
const retryButton = document.getElementById('retry');
const status = document.getElementById('status');
const statusText = document.getElementById('statusText');

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
    text: 'Recording saved, but the SOPWizard server is not reachable at localhost:8787. Start it, then send again.',
    cls: 'status warn',
  },
};

async function state() {
  const all = await chrome.storage.local.get(null);
  const pending = Object.keys(all).filter((k) => k.startsWith('evt_')).length;
  return { recording: Boolean(all.recording), task: all.task, preNotes: all.preNotes, pending };
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

  const msg = outcome ? MESSAGES[outcome.status] : recording ? MESSAGES.recording : null;
  status.className = msg?.cls || 'status';
  statusText.textContent =
    msg?.text || (unsent ? 'A recording is waiting to be sent. Starting a new one discards it.' : 'Idle');
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
    render(outcome);
  } finally {
    retryButton.disabled = false;
  }
});

render();
