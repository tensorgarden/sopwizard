// Exporters render one structured SOP into a delivery format. Each is
// independent, so adding a format doesn't touch capture, segmentation, or
// drafting. A renderer may be async and may return a string or a Buffer.

import { toMarkdown } from './markdown.js';
import { toHtml } from './html.js';
import { toDocx } from './docx.js';

export const exporters = {
  markdown: { ext: 'md', render: toMarkdown },
  html: { ext: 'html', render: toHtml },
  docx: { ext: 'docx', render: toDocx },
};
