// Home page: extension download, install steps, and the SOP library.

import { shell, masthead, brandline } from './theme.js';
import { escapeHtml as esc } from './format.js';

const css = `
  .hero { padding: 26px 0 8px; }
  .hero h1 { font: 600 42px/1.15 var(--serif); letter-spacing: -0.015em; margin: 0 0 12px; max-width: 17ch; }
  .hero p { font-size: 17.5px; color: #3b4554; max-width: 54ch; margin: 0 0 24px; }
  .hero .actions { display: flex; gap: 12px; flex-wrap: wrap; }

  .how { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin: 44px 0 8px; }
  .how .card { background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 18px; }
  .how .n { display: inline-block; width: 24px; height: 24px; border-radius: 50%; background: var(--ink); color: #fff; font: 600 12px/24px var(--sans); text-align: center; margin-bottom: 10px; }
  .how h3 { margin: 0 0 4px; font: 600 15px var(--sans); }
  .how p { margin: 0; font-size: 13.5px; color: var(--muted); }

  .install { margin-top: 36px; background: var(--card); border: 1px solid var(--line); border-radius: 14px; padding: 20px 24px; }
  .install h2 { margin: 0 0 10px; font: 600 17px var(--sans); }
  .install ol { margin: 0; padding-left: 20px; color: #3b4554; }
  .install li { margin-bottom: 6px; }
  .install code { background: #f0eee7; padding: 1px 7px; border-radius: 5px; font: 13px var(--mono); }

  .library { margin-top: 44px; }
  .library-head { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; margin: 0 0 14px; }
  .library h2 { font: 600 17px var(--sans); margin: 0; }
  .sop-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 14px 18px; margin-bottom: 10px; transition: box-shadow .12s ease; }
  .sop-row:hover { box-shadow: var(--shadow); }
  .sop-row .name { font-weight: 600; }
  .sop-row .sub { font-size: 13px; color: var(--muted); margin-top: 1px; }
  .sop-row .links { display: flex; gap: 14px; font-size: 13.5px; white-space: nowrap; }
  .empty { color: var(--muted); background: var(--card); border: 1px dashed var(--line); border-radius: 12px; padding: 22px; text-align: center; }
  .model-banner { margin: 0 0 28px; padding: 14px 18px; background: var(--amber-soft); border: 1px solid var(--amber-line); border-left: 3px solid var(--amber-line); border-radius: 3px; font-size: 13.5px; line-height: 1.55; color: #5c4a1f; }
  .model-banner code { font: 12.5px var(--mono); background: #fff; padding: 1px 5px; border-radius: 4px; }
`;

export function landingPage(sops = [], { basicMode = false } = {}) {
  const approvedCount = sops.filter((s) => s.status === 'approved').length;

  const modelBanner = basicMode
    ? `<div class="model-banner"><strong>Basic mode — no language model connected.</strong> SOPs will list the
        recorded steps without phases, prerequisites, decision tables, or guidance. To get the full procedure,
        set <code>LLM_URL</code> (and <code>LLM_MODEL</code> / <code>LLM_API_KEY</code>) in <code>server/.env</code>
        — see <code>server/.env.example</code> — then restart.</div>`
    : '';

  const rows = sops.length
    ? sops
        .map(
          (s) => `
        <div class="sop-row">
          <div>
            <div class="name">${esc(s.title)} <span class="badge ${s.status === 'approved' ? 'approved' : 'draft'}" style="margin-left:6px">${s.status === 'approved' ? 'Approved' : 'Draft'}</span></div>
            <div class="sub">${s.steps} steps</div>
          </div>
          <div class="links"><a href="/sops/${s.id}/review">Review</a><a href="/sops/${s.id}">Guide</a><a href="/sops/${s.id}/sop.md">Markdown</a><a href="/sops/${s.id}/sop.docx">Word</a></div>
        </div>`
        )
        .join('')
    : '<div class="empty">No SOPs yet. Install the extension, record a workflow, and it will appear here.</div>';

  const body = `
    ${masthead('Running locally')}
    ${modelBanner}
    <div class="hero">
      <h1>Do the work once.<br/>Get the SOP forever.</h1>
      <p>Record yourself doing any browser workflow. SOPWizard watches the steps, writes the procedure, asks about anything unclear, and gives you a polished guide your whole team can follow.</p>
      <div class="actions">
        <a class="btn" href="/extension.zip">Download the Chrome extension</a>
        <a class="btn ghost" href="/practice">Try it on the practice page</a>
        <a class="btn ghost" href="#install">How to install</a>
      </div>
    </div>

    <div class="how">
      <div class="card"><span class="n">1</span><h3>Record</h3><p>Click start, do the task the way you always do.</p></div>
      <div class="card"><span class="n">2</span><h3>Answer</h3><p>It asks about anything the recording can't explain.</p></div>
      <div class="card"><span class="n">3</span><h3>Review</h3><p>Fix any step in plain English, then approve.</p></div>
      <div class="card"><span class="n">4</span><h3>Share</h3><p>A visual guide, Word doc, and Markdown — done.</p></div>
    </div>

    <div class="install" id="install">
      <h2>Install in under a minute</h2>
      <ol>
        <li><a href="/extension.zip">Download the extension</a> and unzip it.</li>
        <li>Open <code>chrome://extensions</code>, turn on <strong>Developer mode</strong> (top right).</li>
        <li>Click <strong>Load unpacked</strong> and choose the unzipped <code>extension</code> folder.</li>
        <li>Pin SOPWizard to your toolbar, open the site you work in (refresh it once after installing), and hit <strong>Start recording</strong>.</li>
        <li>New here? Do your first run on the <a href="/practice">practice page</a> — a small sample app made for recording.</li>
      </ol>
    </div>

    <div class="library">
      <div class="library-head">
        <h2>Your SOPs</h2>
        ${approvedCount ? `<a class="btn ghost" href="/export/approved.zip">Download all approved (${approvedCount}) &middot; .zip</a>` : ''}
      </div>
      ${rows}
    </div>

    <div class="footer">${brandline()}</div>
  `;

  return shell({ title: 'SOPWizard', body, extraCss: css });
}
