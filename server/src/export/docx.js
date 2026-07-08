// Renders a SOP to a Word document — the same structured content as the
// Markdown master, in the format teams (and downstream tools) most often want.

import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';

export async function toDocx(sop) {
  const children = [new Paragraph({ text: sop.title, heading: HeadingLevel.HEADING_1 })];

  if (sop.source.url) {
    children.push(new Paragraph({ children: [new TextRun({ text: `Recorded in ${sop.source.url}`, italics: true })] }));
  }
  if (sop.context.pre) {
    children.push(new Paragraph({ text: sop.context.pre }));
  }

  children.push(new Paragraph({ text: 'Steps', heading: HeadingLevel.HEADING_2 }));
  for (const step of sop.steps) {
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({ text: `${step.index}. ${step.title}`, bold: true }),
          new TextRun({ text: ` — ${step.detail}` }),
        ],
      })
    );
  }

  if (sop.context.post) {
    children.push(new Paragraph({ text: 'Notes', heading: HeadingLevel.HEADING_2 }));
    children.push(new Paragraph({ text: sop.context.post }));
  }

  const doc = new Document({ sections: [{ children }] });
  return Packer.toBuffer(doc);
}
