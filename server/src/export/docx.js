// Word export — same content as the Markdown master, for agencies that keep
// their procedures in a document library rather than a repository.

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  WidthType,
} from 'docx';
import { mmss } from './format.js';

export async function toDocx(sop) {
  const children = [new Paragraph({ text: sop.title, heading: HeadingLevel.HEADING_1 })];

  const status = sop.status === 'approved' ? 'Status: Approved' : 'Status: Draft — not yet reviewed';
  const head = [status, sop.source.url ? `Recorded in ${sop.source.url}` : null].filter(Boolean);
  children.push(new Paragraph({ children: [new TextRun({ text: head.join(' · '), italics: true })] }));

  facts(children, sop);
  if (sop.intro) children.push(new Paragraph({ text: sop.intro, spacing: { before: 160 } }));

  prerequisites(children, sop);
  steps(children, sop);

  if (sop.context.post) {
    heading(children, 'Notes and exceptions');
    children.push(new Paragraph({ text: sop.context.post }));
  }

  reference(children, sop);

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}

function facts(children, sop) {
  const rows = [
    ['System', sop.meta.system],
    ['Workflow', sop.meta.workflow],
    ['Audience', sop.meta.audience],
    ['Sensitivity', sop.meta.sensitivity],
    ['Version', sop.meta.version],
  ].filter(([, v]) => v);

  for (const [k, v] of rows) {
    children.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: `${k}: `, bold: true }), new TextRun({ text: String(v) })],
      })
    );
  }
}

function prerequisites(children, sop) {
  if (!sop.prerequisites.length) return;
  heading(children, 'Before you begin');
  children.push(new Paragraph({ text: 'Gather these before you start:' }));
  children.push(
    table(
      ['Information', 'Where to find it', 'Why it matters'],
      sop.prerequisites.map((r) => [flag(r) + (r.item ?? ''), r.source ?? '', r.impact ?? ''])
    )
  );
}

function steps(children, sop) {
  if (!sop.phases.length) {
    heading(children, 'Steps');
    for (const step of sop.steps) stepBody(children, step);
    return;
  }

  for (const [i, phase] of sop.phases.entries()) {
    const list = sop.steps.filter((s) => s.phaseId === phase.id);
    if (!list.length) continue;
    heading(children, `Phase ${i + 1}: ${phase.title}`);
    if (phase.summary) children.push(new Paragraph({ text: phase.summary }));
    for (const step of list) stepBody(children, step);
  }

  const unphased = sop.steps.filter((s) => !s.phaseId);
  if (unphased.length) {
    heading(children, 'Additional steps');
    for (const step of unphased) stepBody(children, step);
  }
}

function stepBody(children, step) {
  const t = mmss(step.t);
  children.push(
    new Paragraph({
      spacing: { before: 200, after: 60 },
      heading: HeadingLevel.HEADING_3,
      text: `Step ${step.index} — ${step.title}`,
    })
  );
  children.push(
    new Paragraph({
      spacing: { after: 80 },
      children: [
        new TextRun({ text: step.detail }),
        ...(t ? [new TextRun({ text: `  (at ${t} in the recording)`, italics: true, color: '888888' })] : []),
      ],
    })
  );

  const g = step.guidance;
  if (!g) return;

  if (!g.verified) {
    children.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({
            text: 'Unverified guidance — a reviewer has not confirmed the notes below.',
            italics: true,
            color: '8A5F1B',
          }),
        ],
      })
    );
  }

  for (const [k, v] of [
    ['What to enter', g.whatToEnter],
    ['Why it matters', g.whyItMatters],
    ['How to decide', g.howToDecide],
    ['Exceptions', g.exceptions],
  ]) {
    if (!v) continue;
    children.push(
      new Paragraph({
        spacing: { after: 40 },
        indent: { left: 280 },
        children: [new TextRun({ text: `${k}: `, bold: true }), new TextRun({ text: v })],
      })
    );
  }
}

function reference(children, sop) {
  if (sop.decisions.length) {
    heading(children, 'Decision table');
    children.push(
      table(
        ['Decision point', 'Options', 'How to decide', 'Usual answer'],
        sop.decisions.map((r) => [flag(r) + (r.point ?? ''), r.options ?? '', r.howToDecide ?? '', r.fallback ?? ''])
      )
    );
  }

  if (sop.troubleshooting.length) {
    heading(children, 'Common problems');
    children.push(
      table(
        ['Problem', 'Likely cause', 'What to do'],
        sop.troubleshooting.map((r) => [flag(r) + (r.problem ?? ''), r.cause ?? '', r.resolution ?? ''])
      )
    );
  }

  if (sop.checklist.length) {
    heading(children, 'Completion checklist');
    for (const row of sop.checklist) {
      children.push(new Paragraph({ text: `${flag(row)}${row.text}`, bullet: { level: 0 } }));
    }
  }

  const open = (sop.suggestedQuestions || []).filter((q) => !q.answered);
  if (open.length) {
    heading(children, 'Open questions');
    children.push(
      new Paragraph({ text: 'These have not been answered yet and the SOP is incomplete without them:' })
    );
    for (const q of open) {
      children.push(
        new Paragraph({
          text: `${q.stepIndex != null ? `Step ${q.stepIndex}: ` : ''}${q.text}`,
          bullet: { level: 0 },
        })
      );
    }
  }
}

function heading(children, text) {
  children.push(new Paragraph({ text, heading: HeadingLevel.HEADING_2, spacing: { before: 320, after: 120 } }));
}

function table(headers, rows) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        tableHeader: true,
        children: headers.map(
          (h) =>
            new TableCell({
              children: [new Paragraph({ children: [new TextRun({ text: h, bold: true })] })],
            })
        ),
      }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: row.map((c) => new TableCell({ children: [new Paragraph({ text: String(c ?? '') })] })),
          })
      ),
    ],
  });
}

function flag(row) {
  return row.verified ? '' : '⚠ ';
}
