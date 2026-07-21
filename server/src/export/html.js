// Self-contained visual guide: phases, numbered steps, keyframes with the
// acted-on element highlighted, and the reference material around them.
// Printable — this is the file that becomes the circulated PDF.

import { shell, brandline } from './theme.js';
import { escapeHtml as esc, mmss } from './format.js';

export function toHtml(sop) {
  // The generated SOP is the agency's own document, so it leads with the
  // procedure — a title, a metadata header, and the steps — not a vendor
  // masthead. The reference material follows.
  const body = `
    <span class="badge ${sop.status === 'approved' ? 'approved' : 'draft'}">${sop.status === 'approved' ? 'Approved' : 'Draft'}</span>
    <h1 class="doc-title">${esc(sop.title)}</h1>
    <div class="doc-meta">
      <span>${sop.steps.length} ${sop.steps.length === 1 ? 'step' : 'steps'}</span>
      ${sop.source.url ? `<span class="sep">·</span><span>${esc(sop.source.url)}</span>` : ''}
    </div>
    ${sop.intro ? `<p class="intro">${esc(sop.intro)}</p>` : ''}
    ${facts(sop)}
    ${basicNote(sop)}
    ${prerequisites(sop)}
    ${phases(sop)}
    ${sop.context.post ? `<div class="notes"><h2>Notes &amp; exceptions</h2><p>${esc(sop.context.post)}</p></div>` : ''}
    ${decisions(sop)}
    ${troubleshooting(sop)}
    ${checklist(sop)}
    ${openQuestions(sop)}
    <div class="footer"><span>Generated from a recorded workflow${sop.approvedAt ? ` · approved ${new Date(sop.approvedAt).toLocaleDateString()}` : ''}</span>${brandline()}</div>
  `;

  return shell({ title: esc(sop.title), body });
}

// A recording narrated without a model is a plain click log — no phases, no
// prerequisites, no decision table. Say so on the document rather than let it be
// mistaken for the full output.
function basicNote(sop) {
  if (sop.narrator !== 'rules') return '';
  return `<div class="basic-note">This SOP was generated without a language model, so it lists the recorded
    steps without phases, prerequisites, decision tables, or guidance. Connect a model (see the server's
    <code>.env.example</code>) to produce the full procedure.</div>`;
}

function facts(sop) {
  const rows = [
    ['System', sop.meta.system],
    ['Workflow', sop.meta.workflow],
    ['Audience', sop.meta.audience],
    ['Sensitivity', sop.meta.sensitivity],
    ['Version', sop.meta.version],
  ].filter(([, v]) => v);

  if (!rows.length) return '';
  return `<dl class="facts">${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
}

function phases(sop) {
  if (!sop.phases.length) {
    return `<ol class="steps">${sop.steps.map(step).join('')}</ol>`;
  }

  const blocks = sop.phases
    .map((phase, i) => {
      const list = sop.steps.filter((s) => s.phaseId === phase.id);
      if (!list.length) return '';
      return `
        <div class="phase">
          <span class="tag">Phase ${i + 1}</span>
          <h2>${esc(phase.title)}</h2>
          ${phase.summary ? `<p class="summary">${esc(phase.summary)}</p>` : ''}
        </div>
        <ol class="steps" start="${list[0].index}">${list.map(step).join('')}</ol>`;
    })
    .join('');

  // A step the narrator never assigned still has to be shown, under its own
  // heading rather than absorbed into whichever phase came last.
  const unphased = sop.steps.filter((s) => !s.phaseId);
  const rest = unphased.length
    ? `<div class="phase"><span class="tag">Also</span><h2>Additional steps</h2></div>
       <ol class="steps" start="${unphased[0].index}">${unphased.map(step).join('')}</ol>`
    : '';

  return blocks + rest;
}

function step(s) {
  return `
      <li class="step" data-n="${s.index}">
        <h3>${esc(s.title)}${evidence(s)}${s.corrected ? '<span class="edited-flag">reviewed</span>' : ''}</h3>
        <p class="detail">${esc(s.detail)}</p>
        ${guidance(s.guidance)}
        ${shot(s)}
      </li>`;
}

function guidance(g) {
  if (!g) return '';
  const rows = [
    ['What to enter', g.whatToEnter],
    ['Why it matters', g.whyItMatters],
    ['How to decide', g.howToDecide],
    ['Exceptions', g.exceptions],
  ].filter(([, v]) => v);
  if (!rows.length) return '';

  const note = g.verified ? '' : '<div class="unverified-note">Unverified — not yet confirmed by a reviewer</div>';
  return `<div class="guidance${g.verified ? '' : ' unverified'}">
    ${note}
    ${rows.map(([k, v]) => `<div class="row"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join('')}
  </div>`;
}

function prerequisites(sop) {
  if (!sop.prerequisites.length) return '';
  return section(
    'Before you begin',
    'Gather these before you start.',
    table(
      ['Information', 'Where to find it', 'Why it matters'],
      sop.prerequisites.map((r) => ({ cells: [r.item, r.source, r.impact], flagged: !r.verified }))
    )
  );
}

function decisions(sop) {
  if (!sop.decisions.length) return '';
  return section(
    'Decision table',
    'The points where the screen does not tell you the answer.',
    table(
      ['Decision point', 'Options', 'How to decide', 'Usual answer'],
      sop.decisions.map((r) => ({ cells: [r.point, r.options, r.howToDecide, r.fallback], flagged: !r.verified }))
    )
  );
}

function troubleshooting(sop) {
  if (!sop.troubleshooting.length) return '';
  return section(
    'Common problems',
    '',
    table(
      ['Problem', 'Likely cause', 'What to do'],
      sop.troubleshooting.map((r) => ({ cells: [r.problem, r.cause, r.resolution], flagged: !r.verified }))
    )
  );
}

function checklist(sop) {
  if (!sop.checklist.length) return '';
  return section(
    'Completion checklist',
    '',
    `<ul class="checklist">${sop.checklist
      .map((r) => `<li><span class="box"></span><span>${flag(!r.verified)}${esc(r.text)}</span></li>`)
      .join('')}</ul>`
  );
}

function openQuestions(sop) {
  const open = (sop.suggestedQuestions || []).filter((q) => !q.answered);
  if (!open.length) return '';
  return section(
    'Open questions',
    'Unanswered — the SOP is incomplete until these are resolved.',
    `<ul class="questions">${open
      .map(
        (q) =>
          `<li>${q.stepIndex != null ? `<span class="where">Step ${q.stepIndex} · </span>` : ''}${esc(q.text)}</li>`
      )
      .join('')}</ul>`
  );
}

function section(title, lead, inner) {
  return `<div class="section">
    <h2>${esc(title)}</h2>
    ${lead ? `<p class="lead">${esc(lead)}</p>` : ''}
    ${inner}
  </div>`;
}

// Every cell is escaped — the values are model output over page-scraped text,
// which is untrusted at this sink. The unverified flag on the first cell is the
// only markup, added here rather than baked into the (escaped) value.
function table(headers, rows) {
  return `<table class="ref">
    <thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${rows
      .map(
        (row) =>
          `<tr>${row.cells
            .map((c, i) => `<td>${i === 0 ? flag(row.flagged) : ''}${esc(c ?? '')}</td>`)
            .join('')}</tr>`
      )
      .join('')}</tbody>
  </table>`;
}

function flag(flagged) {
  return flagged ? '<span class="flag" title="Not yet confirmed by a reviewer">⚠</span>' : '';
}

function evidence(step) {
  const t = mmss(step.t);
  return t ? `<span class="evidence" title="Time in the recording">▸ ${t}</span>` : '';
}

function shot(step) {
  if (!step.keyframe) return '';
  return `<figure class="shot" style="margin:0">${highlight(step)}<img src="${esc(step.keyframe)}" alt="Step ${step.index}" loading="lazy" /></figure>`;
}

function highlight(step) {
  const rect = step.target?.rect;
  const view = step.viewport;
  if (!rect || !view?.w || !view?.h) return '';

  const pct = (value, total) => Math.max(0, Math.min(100, (value / total) * 100)).toFixed(2);
  return `<span class="hl" style="left:${pct(rect.x, view.w)}%;top:${pct(rect.y, view.h)}%;width:${pct(rect.w, view.w)}%;height:${pct(rect.h, view.h)}%"></span>`;
}
