// Renders a SOP to a self-contained visual guide: numbered steps with their
// keyframes inlined and the acted-on element highlighted, so a single .html
// file is shareable and printable to PDF.

export function toHtml(sop) {
  const steps = sop.steps
    .map(
      (step) => `
    <li>
      <h3>${escape(step.title)}</h3>
      <p>${escape(step.detail)}</p>
      ${shot(step)}
    </li>`
    )
    .join('');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escape(sop.title)}</title>
    <style>
      body { font: 15px/1.5 system-ui, sans-serif; color: #1f2328; max-width: 760px; margin: 40px auto; padding: 0 20px; }
      h1 { font-size: 24px; }
      .meta { color: #57606a; margin-bottom: 24px; }
      ol { list-style: none; padding: 0; counter-reset: step; }
      li { border-left: 2px solid #d0d7de; padding: 0 0 24px 20px; position: relative; }
      li::before { counter-increment: step; content: counter(step); position: absolute; left: -15px; top: 0; width: 26px; height: 26px; border-radius: 50%; background: #1f6feb; color: #fff; font-size: 13px; font-weight: 600; display: grid; place-items: center; }
      h3 { margin: 0 0 4px; font-size: 16px; }
      p { margin: 0 0 10px; }
      .shot { position: relative; display: inline-block; max-width: 100%; }
      .shot img { display: block; max-width: 100%; border: 1px solid #d0d7de; border-radius: 6px; }
      .hl { position: absolute; border: 2px solid #1f6feb; border-radius: 3px; box-shadow: 0 0 0 3px rgba(31, 111, 235, 0.25); pointer-events: none; }
    </style>
  </head>
  <body>
    <h1>${escape(sop.title)}</h1>
    <div class="meta">${sop.source.url ? `Recorded in ${escape(sop.source.url)}` : ''}</div>
    <ol>${steps}
    </ol>
  </body>
</html>
`;
}

function shot(step) {
  if (!step.keyframe) return '';
  return `<div class="shot">${highlight(step)}<img src="${escape(step.keyframe)}" alt="Step ${step.index}" /></div>`;
}

function highlight(step) {
  const rect = step.target?.rect;
  const view = step.viewport;
  if (!rect || !view?.w || !view?.h) return '';

  const pct = (value, total) => Math.max(0, Math.min(100, (value / total) * 100)).toFixed(2);
  return `<span class="hl" style="left:${pct(rect.x, view.w)}%;top:${pct(rect.y, view.h)}%;width:${pct(rect.w, view.w)}%;height:${pct(rect.h, view.h)}%"></span>`;
}

function escape(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
