// Renders a SOP to a clean Markdown document — the master format other outputs
// derive from. One SOP per file, heading hierarchy, no meaning carried by
// tables or images, so it stays readable and easy to ingest downstream.

import { mmss } from './format.js';

export function toMarkdown(sop) {
  const lines = [`# ${sop.title}`, ''];

  const meta = [];
  if (sop.status === 'approved') meta.push('Status: Approved');
  if (sop.source.url) meta.push(`Recorded in ${sop.source.url}`);
  if (meta.length) lines.push(meta.join(' · '), '');

  if (sop.intro) lines.push(sop.intro.trim(), '');

  lines.push('## Steps', '');
  for (const step of sop.steps) {
    const t = mmss(step.t);
    lines.push(`${step.index}. **${step.title}** — ${step.detail}${t ? ` _(at ${t})_` : ''}`);
  }

  if (sop.context.post) lines.push('', '## Notes and exceptions', '', sop.context.post.trim());

  return lines.join('\n') + '\n';
}
