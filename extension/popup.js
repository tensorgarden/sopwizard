const taskInput = document.getElementById('task');
const notesInput = document.getElementById('notes');
const button = document.getElementById('toggle');
const retryButton = document.getElementById('retry');
const status = document.getElementById('status');
const statusText = document.getElementById('statusText');

const MESSAGES = {
  recording: { text: 'Recording your workflow', cls: 'status live' },
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

async function render(outcome) {
  const { recording, task, preNotes, events = [] } = await chrome.storage.local.get([
    'recording',
    'task',
    'preNotes',
    'events',
  ]);

  taskInput.value = task || '';
  notesInput.value = preNotes || '';
  button.textContent = recording ? 'Stop & generate SOP' : 'Start recording';
  button.className = recording ? 'stop' : 'start';

  const pending = !recording && events.length > 0;
  retryButton.hidden = !pending;
  if (pending) retryButton.textContent = `Send last recording (${events.length} steps)`;

  const msg = outcome
    ? MESSAGES[outcome.status]
    : recording
      ? MESSAGES.recording
      : null;
  status.className = msg?.cls || 'status';
  statusText.textContent = msg?.text || 'Idle';
}

taskInput.addEventListener('input', () => chrome.storage.local.set({ task: taskInput.value }));
notesInput.addEventListener('input', () => chrome.storage.local.set({ preNotes: notesInput.value }));

button.addEventListener('click', async () => {
  const { recording } = await chrome.storage.local.get('recording');
  const outcome = await chrome.runtime.sendMessage({ kind: 'toggle', on: !recording });
  render(outcome);
});

retryButton.addEventListener('click', async () => {
  statusText.textContent = 'Sending…';
  const outcome = await chrome.runtime.sendMessage({ kind: 'retry' });
  render(outcome);
});

render();
