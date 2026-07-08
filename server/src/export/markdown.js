// Renders a SOP to a clean Markdown document — the master format other outputs
// derive from. One SOP per file, heading hierarchy, no meaning carried by
// tables or images, so it stays readable and easy to ingest downstream.

export function toMarkdown(sop) {
  const lines = [`# ${sop.title}`, ''];

  if (sop.source.url) lines.push(`Recorded in ${sop.source.url}`, '');
  if (sop.context.pre) lines.push(sop.context.pre.trim(), '');

  lines.push('## Steps', '');
  for (const step of sop.steps) {
    lines.push(`${step.index}. **${step.title}** — ${step.detail}`);
  }

  if (sop.context.post) lines.push('', '## Notes', '', sop.context.post.trim());

  return lines.join('\n') + '\n';
}
