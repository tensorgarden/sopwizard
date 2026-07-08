const taskInput = document.getElementById('task');
const notesInput = document.getElementById('notes');
const button = document.getElementById('toggle');
const status = document.getElementById('status');

async function render() {
  const { recording, task, preNotes } = await chrome.storage.local.get(['recording', 'task', 'preNotes']);
  taskInput.value = task || '';
  notesInput.value = preNotes || '';
  button.textContent = recording ? 'Stop recording' : 'Start recording';
  button.className = recording ? 'stop' : 'start';
  status.textContent = recording ? 'Recording…' : 'Idle';
}

taskInput.addEventListener('input', () => chrome.storage.local.set({ task: taskInput.value }));
notesInput.addEventListener('input', () => chrome.storage.local.set({ preNotes: notesInput.value }));

button.addEventListener('click', async () => {
  const { recording } = await chrome.storage.local.get('recording');
  await chrome.runtime.sendMessage({ kind: 'toggle', on: !recording });
  render();
});

render();
