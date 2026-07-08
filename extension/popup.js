const button = document.getElementById('toggle');
const status = document.getElementById('status');

async function render() {
  const { recording } = await chrome.storage.local.get('recording');
  button.textContent = recording ? 'Stop recording' : 'Start recording';
  button.className = recording ? 'stop' : 'start';
  status.textContent = recording ? 'Recording…' : 'Idle';
}

button.addEventListener('click', async () => {
  const { recording } = await chrome.storage.local.get('recording');
  await chrome.runtime.sendMessage({ kind: 'toggle', on: !recording });
  render();
});

render();
