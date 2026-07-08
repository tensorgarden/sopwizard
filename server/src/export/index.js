// Exporters render one structured SOP into a delivery format. Each is
// independent, so adding a format (PDF, DOCX, …) doesn't touch capture,
// segmentation, or drafting.

import { toMarkdown } from './markdown.js';
import { toHtml } from './html.js';

export const exporters = {
  markdown: { ext: 'md', render: toMarkdown },
  html: { ext: 'html', render: toHtml },
};
