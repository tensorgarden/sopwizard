// Shared look for every HTML surface: guide, review, landing.

export const theme = `
  :root {
    --paper: #ffffff;
    --card: #ffffff;
    --panel: #f8f6f2;
    --ink: #2d2d2d;
    --muted: #5a5a5a;
    --faint: #8a857c;
    --line: #d9d5ce;
    --line-soft: #e8e4dc;
    --accent: #2d5a3d;
    --accent-deep: #1a3d28;
    --accent-soft: #e8f0e9;
    --accent-muted: #c4d6c7;
    --approve: #3b7850;
    --approve-soft: #e8f0e9;
    --amber: #7a6930;
    --amber-soft: #fef9f0;
    --amber-line: #c9a84c;
    --shadow: 0 1px 2px rgba(45, 45, 45, 0.04), 0 10px 28px rgba(45, 45, 45, 0.06);
    --serif: "Book Antiqua", "Palatino Linotype", Palatino, "Iowan Old Style", Georgia, "Times New Roman", serif;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --mono: ui-monospace, "SF Mono", SFMono-Regular, Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--paper);
    color: var(--ink);
    font: 15.5px/1.7 var(--serif);
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

  .doc-title { font: 700 28px/1.25 var(--serif); color: var(--accent); letter-spacing: -0.3px; margin: 0 0 8px; }
  .doc-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; color: var(--muted); font-size: 13.5px; margin-bottom: 8px; }
  .doc-meta span { min-width: 0; overflow-wrap: anywhere; }
  .doc-meta .sep { color: var(--line); }
  .intro { font: 400 16.5px/1.7 var(--serif); color: var(--ink); max-width: 64ch; margin: 16px 0 0; }

  .badge { display: inline-flex; align-items: center; gap: 6px; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; letter-spacing: .02em; }
  .badge.draft { background: var(--amber-soft); color: var(--amber); }
  .badge.approved { background: var(--approve-soft); color: var(--approve); }
  .badge::before { content: ''; width: 6px; height: 6px; border-radius: 50%; background: currentColor; }

  .steps { list-style: none; margin: 44px 0 0; padding: 0; }
  .step {
    position: relative; padding: 0 0 40px 56px;
  }
  /* The number is the step's own index, not a CSS counter — steps are split
     across one list per phase, and a counter would restart at each one. */
  .step::before {
    content: attr(data-n);
    position: absolute; left: 0; top: 1px;
    width: 30px; height: 30px; border-radius: 50%;
    border: 2px solid var(--accent); background: #fff; color: var(--accent);
    font: 700 13.5px/26px var(--serif); text-align: center;
  }
  .step::after {
    content: ''; position: absolute; left: 15px; top: 38px; bottom: 8px;
    width: 1px; background: var(--line);
  }
  .step:last-child::after { display: none; }
  .step h3 { margin: 2px 0 6px; font: 700 17px/1.35 var(--serif); color: var(--ink); letter-spacing: 0; }
  .step .detail { margin: 0 0 14px; color: var(--ink); max-width: 62ch; overflow-wrap: anywhere; }
  .step .evidence { display: inline-flex; align-items: center; gap: 6px; margin-left: 10px; font: 500 11.5px var(--mono); color: var(--muted); background: var(--panel); padding: 2px 8px; border-radius: 5px; vertical-align: 2px; }
  .step .edited-flag { margin-left: 8px; font-size: 12px; color: var(--approve); font-weight: 600; }

  /* Screenshots support the prose rather than dominate it — the reference is
     text-first, so keyframes are kept modest and secondary. */
  .shot { position: relative; display: block; max-width: 440px; border-radius: 6px; overflow: hidden; box-shadow: var(--shadow); border: 1px solid var(--line); margin-top: 4px; }
  .shot img { display: block; width: 100%; }
  .hl { position: absolute; border: 2.5px solid var(--accent); border-radius: 5px; box-shadow: 0 0 0 4px rgba(45, 90, 61, 0.20), 0 0 0 2000px rgba(45, 45, 45, 0.05); pointer-events: none; }

  .notes { margin-top: 32px; padding: 18px 22px; background: var(--panel); border: 1px solid var(--line); border-radius: 3px; }
  .notes h2 { margin: 0 0 8px; font: 700 15px var(--sans); text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
  .notes p { margin: 0; color: var(--ink); white-space: pre-line; }

  /* Shown only when a SOP was narrated without a model — a plain click log. */
  .basic-note { margin: 22px 0 0; padding: 12px 16px; background: var(--amber-soft); border: 1px solid var(--amber-line); border-left: 3px solid var(--amber-line); border-radius: 3px; font-size: 13.5px; color: #5c4a1f; }
  .basic-note code { font: 12.5px var(--mono); background: #fff; padding: 1px 5px; border-radius: 4px; }

  /* ---- document facts: system, workflow, audience, sensitivity — a metadata
     panel that opens the document, like the reference SOP's header ---- */
  .facts { display: grid; grid-template-columns: 150px 1fr; gap: 5px 18px; margin: 22px 0 0; padding: 20px 24px; background: var(--panel); border: 1px solid var(--line); border-radius: 3px; font-size: 14px; }
  .facts dt { color: var(--muted); font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; padding-top: 1px; }
  .facts dd { margin: 0; color: var(--ink); overflow-wrap: anywhere; }

  /* ---- phases: the stages a reader navigates by ---- */
  .phase { margin: 46px 0 6px; padding-top: 18px; border-top: 1px solid var(--line); }
  .phase:first-of-type { border-top: 0; padding-top: 0; }
  .phase .tag { display: inline-block; font: 700 11px var(--sans); text-transform: uppercase; letter-spacing: .1em; color: var(--accent); }
  .phase h2 { margin: 5px 0 4px; font: 700 21px/1.25 var(--serif); color: var(--accent); letter-spacing: -0.3px; }
  .phase .summary { margin: 0; color: var(--muted); max-width: 62ch; }

  /* ---- guidance: everything the recording can't show ---- */
  .guidance { margin: 12px 0 14px; padding: 14px 18px; background: var(--card); border: 1px solid var(--line); border-left: 3px solid var(--accent); border-radius: 0 10px 10px 0; display: grid; gap: 9px; max-width: 62ch; }
  .guidance .row { display: grid; gap: 2px; }
  .guidance .k { font: 600 11.5px var(--sans); text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
  .guidance .v { color: #3b4554; }
  .guidance.unverified { border-left-color: var(--amber); background: var(--amber-soft); }
  .unverified-note { display: inline-flex; align-items: center; gap: 6px; font: 600 11.5px var(--sans); color: var(--amber); text-transform: uppercase; letter-spacing: .05em; }
  .flag { display: inline-block; margin-right: 6px; color: var(--amber); font-weight: 700; }

  /* ---- reference tables ---- */
  .ref { margin: 12px 0 0; width: 100%; border-collapse: collapse; font-size: 14px; }
  .ref caption { text-align: left; color: var(--muted); font-size: 13px; margin-bottom: 10px; }
  .ref th { text-align: left; font: 700 11px var(--sans); text-transform: uppercase; letter-spacing: .05em; color: var(--muted); padding: 8px 14px; background: var(--panel); border-bottom: 1px solid var(--line); white-space: nowrap; }
  .ref td { padding: 10px 14px; border-bottom: 1px solid var(--line-soft); color: var(--ink); vertical-align: top; overflow-wrap: anywhere; }
  .ref tbody tr:nth-child(even) { background: #faf8f5; }
  .ref td:first-child { font-weight: 700; }

  /* ---- checklist and open questions ---- */
  .checklist { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 10px; }
  .checklist li { display: grid; grid-template-columns: auto 1fr; gap: 11px; align-items: start; color: #3b4554; }
  .checklist .box { width: 15px; height: 15px; margin-top: 4px; border: 1.5px solid var(--faint); border-radius: 4px; }
  .questions { list-style: none; margin: 12px 0 0; padding: 0; display: grid; gap: 10px; }
  .questions li { padding-left: 16px; border-left: 2px solid var(--amber); color: #3b4554; }
  .questions .where { color: var(--muted); font-size: 13px; }

  .section { margin-top: 40px; }
  .section > h2 { margin: 0 0 6px; font: 700 20px var(--serif); color: var(--accent); padding-top: 16px; border-top: 1.5px solid var(--accent-muted); letter-spacing: -0.2px; }
  .section > .lead { margin: 0 0 4px; color: var(--muted); font-size: 14px; }

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

  /* Printing produces the circulated PDF, so these print rules are part of the output. */
  @media print {
    @page { margin: 18mm 16mm; }
    body { background: #fff; font-size: 11pt; }
    .page { padding: 0; max-width: none; }
    .masthead, .footer .actions, button, .clarify, .approve-bar, details.correct { display: none !important; }
    .shot { box-shadow: none; }

    /* Keep each self-contained block from breaking across a page. */
    .step, .guidance, .facts, .checklist li, .questions li, .ref tr { break-inside: avoid; }
    .phase, .section { break-inside: auto; }
    .phase h2, .section > h2 { break-after: avoid; }
    .step h3 { break-after: avoid; }
    .phase { break-before: page; }
    .phase:first-of-type { break-before: auto; }

    .step::before, .badge, .phase .tag, .guidance, .unverified-note, .flag {
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    a { color: inherit; text-decoration: none; }
  }
`;

export function shell({ title, body, extraCss = '', script = '' }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'self'" />
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

export function brandline() {
  return `<span>SOPWizard is an <a href="https://uncoveredapp.com">Uncovered</a> product.</span>`;
}
