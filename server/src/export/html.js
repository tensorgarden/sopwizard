// Renders a SOP to a self-contained visual guide: numbered steps with their
// keyframes inlined, the acted-on element highlighted, and each step citing
// its place in the recording. A single .html file, shareable and printable.

import { shell, masthead } from './theme.js';
import { escapeHtml as esc, mmss, hostOf } from './format.js';

export function toHtml(sop) {
  const steps = sop.steps
    .map(
      (step) => `
      <li class="step">
        <h3>${esc(step.title)}${evidence(step)}${step.corrected ? '<span class="edited-flag">reviewed</span>' : ''}</h3>
        <p class="detail">${esc(step.detail)}</p>
        ${shot(step)}
      </li>`
    )
    .join('');

  const body = `
    ${masthead(sop.source.url ? `Recorded in ${esc(hostOf(sop.source.url))}` : '')}
    <span class="badge ${sop.status === 'approved' ? 'approved' : 'draft'}">${sop.status === 'approved' ? 'Approved' : 'Draft'}</span>
    <h1 class="doc-title">${esc(sop.title)}</h1>
    <div class="doc-meta">
      <span>${sop.steps.length} steps</span>
      ${sop.source.url ? `<span class="sep">·</span><span>${esc(sop.source.url)}</span>` : ''}
    </div>
    ${sop.intro ? `<p class="intro">${esc(sop.intro)}</p>` : ''}
    <ol class="steps">${steps}
    </ol>
    ${sop.context.post ? `<div class="notes"><h2>Notes &amp; exceptions</h2><p>${esc(sop.context.post)}</p></div>` : ''}
    <div class="footer"><span>Generated from a recorded workflow${sop.approvedAt ? ` · approved ${new Date(sop.approvedAt).toLocaleDateString()}` : ''}</span></div>
  `;

  return shell({ title: esc(sop.title), body });
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
