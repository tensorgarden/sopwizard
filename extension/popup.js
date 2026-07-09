const taskInput = document.getElementById('task');
const notesInput = document.getElementById('notes');
const button = document.getElementById('toggle');
const status = document.getElementById('status');
const statusText = document.getElementById('statusText');

async function render() {
  const { recording, task, preNotes } = await chrome.storage.local.get(['recording', 'task', 'preNotes']);
  taskInput.value = task || '';
  notesInput.value = preNotes || '';
  button.textContent = recording ? 'Stop & generate SOP' : 'Start recording';
  button.className = recording ? 'stop' : 'start';
  status.className = recording ? 'status live' : 'status';
  statusText.textContent = recording ? 'Recording your workflow' : 'Idle';
}

taskInput.addEventListener('input', () => chrome.storage.local.set({ task: taskInput.value }));
notesInput.addEventListener('input', () => chrome.storage.local.set({ preNotes: notesInput.value }));

button.addEventListener('click', async () => {
  const { recording } = await chrome.storage.local.get('recording');
  await chrome.runtime.sendMessage({ kind: 'toggle', on: !recording });
  render();
});

render();
