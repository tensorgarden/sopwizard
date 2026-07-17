// Small shared helpers for the HTML surfaces.

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function mmss(t) {
  if (t == null) return null;
  const total = Math.round(t / 1000);
  const m = Math.floor(total / 60);
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// Filename-safe slug from an SOP title, so a download is
// "create-a-new-client-record.md" instead of an opaque "sop.md".
export function slug(text, fallback = 'sop') {
  const out = String(text || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60)
    .replace(/-$/, '');
  return out || fallback;
}
