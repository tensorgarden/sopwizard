// The shared look for every HTML surface: the visual guide, the review page,
// and the landing page. One design language so the whole product feels like a
// single crafted document rather than a set of tools.

export const theme = `
  :root {
    --paper: #f6f5f0;
    --card: #ffffff;
    --ink: #17202e;
    --muted: #626c7a;
    --faint: #9aa2ae;
    --line: #e5e2d9;
    --accent: #2b59c3;
    --accent-soft: #eaf0fc;
    --approve: #11734f;
    --approve-soft: #e7f4ee;
    --amber: #8a5f1b;
    --amber-soft: #fdf3e0;
    --shadow: 0 1px 2px rgba(23, 32, 46, 0.05), 0 12px 32px rgba(23, 32, 46, 0.07);
    --serif: Charter, Georgia, Cambria, "Times New Roman", serif;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font: 16px/1.6 var(--sans);
    -webkit-font-smoothing: antialiased;
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }

  .page { max-width: 820px; margin: 0 auto; padding: 48px 24px 96px; }

  .masthead {
    display: flex; align-items: center; justify-content: space-between;
    padding-bottom: 20px; margin-bottom: 36px;
    border-bottom: 1px solid var(--line);
    font-size: 13px; color: var(--muted);
  }
  .wordmark { display: flex; align-items: center; gap: 9px; font-weight: 650; font-size: 14px; color: var(--ink); letter-spacing: .01em; }
  .wordmark .dot { width: 22px; height: 22px; border-radius: 7px; background: var(--accent); position: relative; }
  .wordmark .dot::after { content: ''; position: absolute; inset: 6px 6px 9px 6px; border-radius: 2px; border: 2px solid #fff; border-bottom: 0; }

  .doc-title { font: 600 34px/1.2 var(--serif); letter-spacing: -0.01em; margin: 0 0 10px; }
  .doc-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; color: var(--muted); font-size: 13.5px; margin-bottom: 8px; }
  .doc-meta span { min-width: 0; overflow-wrap: anywhere; }
  .doc-meta .sep { color: var(--line); }
  .intro { font: 400 17px/1.65 var(--serif); color: #333e4e; max-width: 62ch; margin: 18px 0 0; }

  .badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; letter-spacing: .02em; }
  .badge.draft { background: var(--amber-soft); color: var(--amber); }
  .badge.approved { background: var(--approve-soft); color: var(--approve); }
  .badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

  .steps { list-style: none; margin: 44px 0 0; padding: 0; counter-reset: step; }
  .step {
    position: relative; padding: 0 0 40px 56px;
  }
  .step::before {
    counter-increment: step; content: counter(step);
    position: absolute; left: 0; top: 0;
    width: 34px; height: 34px; border-radius: 50%;
    background: var(--ink); color: #fff;
    font: 600 14px/34px var(--sans); text-align: center;
  }
  .step::after {
    content: ''; position: absolute; left: 16.5px; top: 42px; bottom: 8px;
    width: 1px; background: var(--line);
  }
  .step:last-child::after { display: none; }
  .step h3 { margin: 4px 0 6px; font: 600 19px/1.35 var(--sans); letter-spacing: -0.005em; }
  .step .detail { margin: 0 0 14px; color: #3b4554; max-width: 60ch; overflow-wrap: anywhere; }
  .step .evidence { display: inline-flex; align-items: center; gap: 6px; margin-left: 10px; font: 500 11.5px var(--mono); color: var(--muted); background: #f0eee7; padding: 2px 8px; border-radius: 5px; vertical-align: 2px; }
  .step .edited-flag { margin-left: 8px; font-size: 12px; color: var(--approve); font-weight: 600; }

  .shot { position: relative; display: block; max-width: 100%; border-radius: 10px; overflow: hidden; box-shadow: var(--shadow); border: 1px solid var(--line); }
  .shot img { display: block; width: 100%; }
  .hl { position: absolute; border: 2.5px solid var(--accent); border-radius: 6px; box-shadow: 0 0 0 4px rgba(43, 89, 195, 0.22), 0 0 0 2000px rgba(23, 32, 46, 0.06); pointer-events: none; }

  .notes { margin-top: 12px; padding: 20px 24px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; }
  .notes h2 { margin: 0 0 8px; font: 600 15px var(--sans); text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
  .notes p { margin: 0; color: #3b4554; white-space: pre-line; }

  .footer { margin-top: 56px; padding-top: 18px; border-top: 1px solid var(--line); display: flex; gap: 16px; align-items: center; font-size: 13px; color: var(--muted); }

  button, .btn {
    appearance: none; border: 0; cursor: pointer; border-radius: 9px;
    padding: 10px 18px; font: 600 14px var(--sans); letter-spacing: .01em;
    background: var(--accent); color: #fff; transition: filter .12s ease;
    display: inline-flex; align-items: center; gap: 8px; text-decoration: none;
  }
  button:hover, .btn:hover { filter: brightness(1.08); text-decoration: none; }
  .btn.ghost { background: transparent; color: var(--ink); border: 1px solid var(--line); }
  .btn.approve { background: var(--approve); }

  input[type="text"], input:not([type]), textarea {
    width: 100%; padding: 9px 12px; border: 1px solid var(--line); border-radius: 9px;
    font: 14.5px/1.5 var(--sans); color: var(--ink); background: #fff;
  }
  input:focus, textarea:focus { outline: 2px solid var(--accent); outline-offset: 1px; border-color: var(--accent); }

  @media print {
    body { background: #fff; }
    .page { padding: 0; max-width: none; }
    .masthead, .footer .actions, button { display: none !important; }
    .shot { box-shadow: none; }
    .step { break-inside: avoid; }
    .step::before, .badge, .how .n { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
`;

export function shell({ title, body, extraCss = '', script = '' }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <style>${theme}${extraCss}</style>
  </head>
  <body>
    <div class="page">${body}</div>
    ${script ? `<script>${script}</script>` : ''}
  </body>
</html>
`;
}

export function masthead(right = '') {
  return `<div class="masthead">
    <span class="wordmark"><span class="dot"></span>SOPWizard</span>
    <span>${right}</span>
  </div>`;
}
