// Records user interactions on the page and forwards them to the recorder.

let recording = false;
let sequence = 0;

function describeTarget(el) {
  if (!(el instanceof Element)) return null;
  const rect = el.getBoundingClientRect();
  return {
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute('role'),
    name: accessibleName(el),
    selector: cssPath(el),
    rect: {
      x: Math.round(rect.x),
      y: Math.round(rect.y),
      w: Math.round(rect.width),
      h: Math.round(rect.height),
    },
  };
}

function accessibleName(el) {
  const aria = el.getAttribute('aria-label');
  if (aria) return aria.trim();

  const labelledby = el.getAttribute('aria-labelledby');
  if (labelledby) {
    const ref = document.getElementById(labelledby);
    if (ref) return ref.textContent.trim();
  }

  if (el.id) {
    const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (label) return label.textContent.trim();
  }

  const text = (el.getAttribute('placeholder') || el.textContent || '').trim();
  return text.slice(0, 120);
}

function cssPath(el) {
  const parts = [];
  let node = el;

  while (node && node.nodeType === 1 && parts.length < 6) {
    if (node.id) {
      parts.unshift(`${node.tagName.toLowerCase()}#${CSS.escape(node.id)}`);
      break;
    }

    let part = node.tagName.toLowerCase();
    const parent = node.parentElement;
    if (parent) {
      const twins = [...parent.children].filter((c) => c.tagName === node.tagName);
      if (twins.length > 1) part += `:nth-of-type(${twins.indexOf(node) + 1})`;
    }

    parts.unshift(part);
    node = node.parentElement;
  }

  return parts.join(' > ');
}

function capture(type, event) {
  if (!recording) return;
  chrome.runtime.sendMessage({
    kind: 'event',
    event: {
      seq: sequence++,
      type,
      url: location.href,
      at: Date.now(),
      viewport: { w: window.innerWidth, h: window.innerHeight },
      target: describeTarget(event.target),
    },
  });
}

const handlers = {
  click: (e) => capture('click', e),
  change: (e) => capture('change', e),
  submit: (e) => capture('submit', e),
};

function setRecording(on) {
  if (on === recording) return;
  recording = on;
  for (const [type, handler] of Object.entries(handlers)) {
    if (on) document.addEventListener(type, handler, true);
    else document.removeEventListener(type, handler, true);
  }
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.kind === 'set-recording') setRecording(msg.on);
});

chrome.storage.local.get('recording').then(({ recording: on }) => setRecording(Boolean(on)));
