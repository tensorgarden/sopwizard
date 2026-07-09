// The review surface: answer open questions, correct any step in plain
// language, and approve the SOP when it's right. Corrections only touch the
// step they name; a correction can also be marked as applying to future
// workflows, which turns it into a durable lesson. Once approved, the page
// goes read-only — editing again reopens the draft.

import { shell, masthead } from './theme.js';
import { escapeHtml as esc, mmss, hostOf } from './format.js';

const css = `
  .clarify { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 22px 24px; margin: 28px 0 6px; box-shadow: var(--shadow); }
  .clarify h2 { margin: 0 0 4px; font: 600 17px var(--sans); }
  .clarify .hint { margin: 0 0 16px; color: var(--muted); font-size: 13.5px; }
  .q { margin-bottom: 14px; }
  .q label { display: block; margin-bottom: 6px; font-weight: 500; }
  .review-step h3 { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px; }
  details.correct { margin-top: 10px; }
  details.correct summary { cursor: pointer; color: var(--muted); font-size: 13px; font-weight: 500; }
  details.correct summary:hover { color: var(--accent); }
  .correct-body { margin-top: 10px; padding: 16px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; display: grid; gap: 10px; }
  .correct-body .label { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; margin-bottom: -4px; }
  .scope { display: flex; gap: 18px; font-size: 13.5px; color: #3b4554; }
  .scope label { display: inline-flex; gap: 6px; align-items: center; cursor: pointer; font-weight: 400; }
  .approve-bar { position: sticky; bottom: 0; margin-top: 40px; padding: 14px 18px; background: rgba(255,255,255,.92); backdrop-filter: blur(8px); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow); display: flex; align-items: center; justify-content: space-between; gap: 14px; }
  .approve-bar .status-note { font-size: 13.5px; color: var(--muted); }
  .thumb { max-width: 420px; }
  .feedback { font-size: 13px; font-weight: 600; margin-top: 6px; }
  .feedback.ok { color: var(--approve); }
  .feedback.err { color: #b3362f; }
  button:disabled { opacity: .55; cursor: default; }
`;

export function reviewPage(id, sop, clarifications = []) {
  const approved = sop.status === 'approved';

  const questions = clarifications
    .map(
      (c, i) => `
        <div class="q">
          <label for="answer-${i}">${esc(c.text)}</label>
          <input id="answer-${i}" class="answer" data-step="${c.stepIndex == null ? '' : c.stepIndex}" data-q="${esc(c.text)}" placeholder="Type your answer…" />
        </div>`
    )
    .join('');

  const steps = sop.steps
    .map(
      (step) => `
      <li class="step review-step">
        <h3>${esc(step.title)}${mmss(step.t) ? `<span class="evidence">▸ ${mmss(step.t)}</span>` : ''}${step.corrected ? '<span class="edited-flag">edited</span>' : ''}</h3>
        <p class="detail">${esc(step.detail)}</p>
        ${step.keyframe ? `<figure class="shot thumb" style="margin:0">${highlight(step)}<img src="${esc(step.keyframe)}" alt="Step ${step.index}" loading="lazy" /></figure>` : ''}
        ${approved ? '' : correctionPanel(step)}
      </li>`
    )
    .join('');

  const body = `
    ${masthead(sop.source.url ? `Recorded in ${esc(hostOf(sop.source.url))}` : '')}
    <span class="badge ${approved ? 'approved' : 'draft'}">${approved ? 'Approved' : 'Draft — in review'}</span>
    <h1 class="doc-title">${esc(sop.title)}</h1>
    <div class="doc-meta"><span>${sop.steps.length} steps</span><span class="sep">·</span><a href="/sops/${id}">Visual guide</a><span class="sep">·</span><a href="/sops/${id}/sop.md">Markdown</a><span class="sep">·</span><a href="/sops/${id}/sop.docx">Word</a></div>
    ${sop.intro ? `<p class="intro">${esc(sop.intro)}</p>` : ''}
    ${!approved && clarifications.length ? `<section class="clarify"><h2>A few questions before this is finished</h2><p class="hint">Answers are folded into the exact step they belong to — nothing else is touched.</p>${questions}<button type="button" onclick="submitAnswers(this)">Save answers</button><div class="feedback" id="answers-feedback"></div></section>` : ''}
    <ol class="steps">${steps}
    </ol>
    ${sop.context.post ? `<div class="notes"><h2>Notes &amp; exceptions</h2><p>${esc(sop.context.post)}</p></div>` : ''}
    <div class="approve-bar">
      <span class="status-note">${approved ? 'This SOP is approved and ready to share.' : 'Review the steps, then approve to finalize.'}</span>
      ${approved ? `<a class="btn ghost" href="/sops/${id}">Open visual guide</a>` : `<button type="button" class="approve" onclick="approveSop(this)">Approve this SOP</button>`}
    </div>
  `;

  const script = `
    async function post(url, body, btn) {
      btn.disabled = true;
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'the server returned ' + res.status);
        }
        return true;
      } catch (err) {
        alert('Saving failed (' + err.message + '). Your text is still here — try again.');
        return false;
      } finally {
        btn.disabled = false;
      }
    }
    async function submitAnswers(btn) {
      const filled = [...document.querySelectorAll('.answer')].filter((el) => el.value.trim());
      if (!filled.length) return;
      const answers = filled.map((el) => ({
        stepIndex: el.dataset.step ? Number(el.dataset.step) : null,
        question: el.dataset.q,
        text: el.value,
      }));
      if (await post('/sops/${id}/answers', { answers }, btn)) {
        for (const el of filled) el.disabled = true;
        const note = document.getElementById('answers-feedback');
        note.className = 'feedback ok';
        note.textContent = 'Saved — your answers are folded into the SOP.';
      }
    }
    async function correct(stepIndex, btn) {
      const box = btn.closest('.correct-body');
      const title = box.querySelector('.c-title').value;
      const detail = box.querySelector('.c-detail').value;
      const scope = box.querySelector('input[name="scope-' + stepIndex + '"]:checked').value;
      if (await post('/sops/${id}/corrections', { stepIndex, title, detail, scope }, btn)) {
        const li = box.closest('li');
        li.querySelector('h3').childNodes[0].textContent = title;
        li.querySelector('.detail').textContent = detail;
        const note = box.querySelector('.feedback');
        note.className = 'feedback ok';
        note.textContent = scope === 'future' ? 'Saved — and remembered for future workflows.' : 'Saved.';
      }
    }
    async function approveSop(btn) {
      if (await post('/sops/${id}/approve', {}, btn)) location.reload();
    }
  `;

  return shell({ title: `Review — ${esc(sop.title)}`, body, extraCss: css, script });
}

function correctionPanel(step) {
  return `
        <details class="correct">
          <summary>Not quite right? Correct this step</summary>
          <div class="correct-body">
            <label class="label" for="c-title-${step.index}">Step title</label>
            <input id="c-title-${step.index}" class="c-title" value="${esc(step.title)}" />
            <label class="label" for="c-detail-${step.index}">What should it say?</label>
            <textarea id="c-detail-${step.index}" class="c-detail">${esc(step.detail)}</textarea>
            <div class="scope">
              <label><input type="radio" name="scope-${step.index}" value="this" checked /> Just this SOP</label>
              <label><input type="radio" name="scope-${step.index}" value="future" /> All future workflows like this</label>
            </div>
            <div><button type="button" onclick="correct(${step.index}, this)">Save correction</button><div class="feedback"></div></div>
          </div>
        </details>`;
}

function highlight(step) {
  const rect = step.target?.rect;
  const view = step.viewport;
  if (!rect || !view?.w || !view?.h) return '';
  const pct = (value, total) => Math.max(0, Math.min(100, (value / total) * 100)).toFixed(2);
  return `<span class="hl" style="left:${pct(rect.x, view.w)}%;top:${pct(rect.y, view.h)}%;width:${pct(rect.w, view.w)}%;height:${pct(rect.h, view.h)}%"></span>`;
}
