// Markdown master: one SOP per file, heading hierarchy, no meaning carried by
// tables or images. Built to be machine-read: a retrieval index can't see the
// keyframes the visual guide leans on, so anything they carry must be in the
// prose here.

import { mmss } from './format.js';

export function toMarkdown(sop) {
  const out = new Lines();

  out.push(`# ${sop.title}`, '');

  const status = [];
  if (sop.status === 'approved') status.push('Status: Approved');
  else status.push('Status: Draft — not yet reviewed');
  if (sop.source.url) status.push(`Recorded in ${sop.source.url}`);
  out.push(status.join(' · '), '');

  metaBlock(out, sop);
  if (sop.intro) out.push(sop.intro.trim(), '');

  prerequisites(out, sop);
  steps(out, sop);

  if (sop.context.post) {
    out.section('Notes and exceptions', () => out.push(sop.context.post.trim()));
  }

  decisions(out, sop);
  troubleshooting(out, sop);
  checklist(out, sop);
  openQuestions(out, sop);

  return out.toString();
}

function metaBlock(out, sop) {
  const rows = [
    ['System', sop.meta.system],
    ['Workflow', sop.meta.workflow],
    ['Audience', sop.meta.audience],
    ['Sensitivity', sop.meta.sensitivity],
    ['Version', sop.meta.version],
  ].filter(([, v]) => v);

  if (!rows.length) return;
  for (const [k, v] of rows) out.push(`**${k}:** ${v}`);
  out.push('');
}

function prerequisites(out, sop) {
  if (!sop.prerequisites.length) return;
  out.section('Before you begin', () => {
    out.push('Gather these before you start:', '');
    out.table(
      ['Information', 'Where to find it', 'Why it matters'],
      sop.prerequisites.map((r) => [flag(r) + (r.item ?? ''), r.source ?? '', r.impact ?? ''])
    );
  });
}

function steps(out, sop) {
  if (!sop.phases.length) {
    out.section('Steps', () => {
      for (const step of sop.steps) stepBody(out, step);
    });
    return;
  }

  for (const [i, phase] of sop.phases.entries()) {
    const list = sop.steps.filter((s) => s.phaseId === phase.id);
    if (!list.length) continue;
    out.section(`Phase ${i + 1}: ${phase.title}`, () => {
      if (phase.summary) out.push(phase.summary.trim(), '');
      for (const step of list) stepBody(out, step);
    });
  }

  // A step the narrator never assigned gets its own heading rather than being
  // filed under whichever phase happened to be last.
  const unphased = sop.steps.filter((s) => !s.phaseId);
  if (unphased.length) {
    out.section('Additional steps', () => {
      for (const step of unphased) stepBody(out, step);
    });
  }
}

function stepBody(out, step) {
  const t = mmss(step.t);
  out.push(`### Step ${step.index} — ${step.title}`, '');
  out.push(`${step.detail}${t ? ` _(at ${t} in the recording)_` : ''}`, '');

  const g = step.guidance;
  if (!g) return;

  if (!g.verified) out.push('> Unverified guidance — a reviewer has not confirmed the notes below.', '');
  if (g.whatToEnter) out.push(`**What to enter:** ${g.whatToEnter}`, '');
  if (g.whyItMatters) out.push(`**Why it matters:** ${g.whyItMatters}`, '');
  if (g.howToDecide) out.push(`**How to decide:** ${g.howToDecide}`, '');
  if (g.exceptions) out.push(`**Exceptions:** ${g.exceptions}`, '');
}

function decisions(out, sop) {
  if (!sop.decisions.length) return;
  out.section('Decision table', () =>
    out.table(
      ['Decision point', 'Options', 'How to decide', 'Usual answer'],
      sop.decisions.map((r) => [flag(r) + (r.point ?? ''), r.options ?? '', r.howToDecide ?? '', r.fallback ?? ''])
    )
  );
}

function troubleshooting(out, sop) {
  if (!sop.troubleshooting.length) return;
  out.section('Common problems', () =>
    out.table(
      ['Problem', 'Likely cause', 'What to do'],
      sop.troubleshooting.map((r) => [flag(r) + (r.problem ?? ''), r.cause ?? '', r.resolution ?? ''])
    )
  );
}

function checklist(out, sop) {
  if (!sop.checklist.length) return;
  out.section('Completion checklist', () => {
    for (const row of sop.checklist) out.push(`- [ ] ${flag(row)}${row.text}`);
  });
}

function openQuestions(out, sop) {
  const open = (sop.suggestedQuestions || []).filter((q) => !q.answered);
  if (!open.length) return;
  out.section('Open questions', () => {
    out.push('These have not been answered yet and the SOP is incomplete without them:', '');
    for (const q of open) {
      out.push(`- ${q.stepIndex != null ? `Step ${q.stepIndex}: ` : ''}${q.text}`);
    }
  });
}

// Unverified rows still appear in drafts (they're what the reviewer signs off
// on) but carry the flag so they never read as settled.
function flag(row) {
  return row.verified ? '' : '⚠ ';
}

class Lines {
  constructor() {
    this.lines = [];
  }

  push(...lines) {
    this.lines.push(...lines);
    return this;
  }

  section(title, body) {
    this.push(`## ${title}`, '');
    body();
    this.push('');
    return this;
  }

  table(headers, rows) {
    this.push(`| ${headers.join(' | ')} |`);
    this.push(`|${headers.map(() => '---').join('|')}|`);
    for (const row of rows) this.push(`| ${row.map(cell).join(' | ')} |`);
    return this;
  }

  toString() {
    // Collapse the blank lines the section helpers leave behind.
    const text = this.lines.join('\n').replace(/\n{3,}/g, '\n\n');
    return text.trimEnd() + '\n';
  }
}

// A newline or a pipe inside a cell would silently break the table.
function cell(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\s*\n\s*/g, ' ')
    .trim();
}
