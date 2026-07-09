// Renders a SOP to a Word document — the same structured content as the
// Markdown master, in the format teams (and downstream tools) most often want.

import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import { mmss } from './format.js';

export async function toDocx(sop) {
  const children = [new Paragraph({ text: sop.title, heading: HeadingLevel.HEADING_1 })];

  const meta = [];
  if (sop.status === 'approved') meta.push('Status: Approved');
  if (sop.source.url) meta.push(`Recorded in ${sop.source.url}`);
  if (meta.length) {
    children.push(new Paragraph({ children: [new TextRun({ text: meta.join(' · '), italics: true })] }));
  }

  if (sop.intro) {
    children.push(new Paragraph({ text: sop.intro }));
  }

  children.push(new Paragraph({ text: 'Steps', heading: HeadingLevel.HEADING_2 }));
  for (const step of sop.steps) {
    const t = mmss(step.t);
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({ text: `${step.index}. ${step.title}`, bold: true }),
          new TextRun({ text: ` — ${step.detail}` }),
          ...(t ? [new TextRun({ text: `  (at ${t})`, italics: true, color: '888888' })] : []),
        ],
      })
    );
  }

  if (sop.context.post) {
    children.push(new Paragraph({ text: 'Notes and exceptions', heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ text: sop.context.post }));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
