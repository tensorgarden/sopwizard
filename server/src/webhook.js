// Outbound signal: a human-approved SOP is ready to ingest. POSTs to a
// configurable endpoint so a host system learns a document is ready without
// polling.
//
// Metadata only, never the SOP body — fetching is a separate, authenticated
// step. Never blocks or fails an approval. HMAC signing is deferred until the
// host's verification scheme is known.

const ENDPOINT = process.env.WEBHOOK_URL;
const TIMEOUT_MS = Number(process.env.WEBHOOK_TIMEOUT_MS || 5000);
// Server is bound to localhost, so links only resolve on this machine. Send
// absolute URLs — a remote receiver can't resolve relative paths.
const BASE = process.env.WEBHOOK_BASE_URL || `http://localhost:${process.env.PORT || 8787}`;

export function webhookEnabled() {
  return Boolean(ENDPOINT);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function emitApproved(id, sop) {
  if (!ENDPOINT) return;

  const payload = {
    event: 'sop.approved',
    id,
    title: sop.title,
    steps: sop.steps.length,
    approvedAt: sop.approvedAt ? new Date(sop.approvedAt).toISOString() : null,
    base: BASE,
    // Absolute, same-machine URLs — fetching is a separate, authenticated step.
    links: {
      markdown: `${BASE}/sops/${id}/sop.md`,
      word: `${BASE}/sops/${id}/sop.docx`,
      guide: `${BASE}/sops/${id}`,
    },
  };

  await deliver(payload, 1);
}

async function deliver(payload, retries) {
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`receiver returned ${res.status}`);
  } catch (err) {
    if (retries > 0) {
      await sleep(2000);
      return deliver(payload, retries - 1);
    }
    console.warn(`approval webhook failed: ${err.message}`);
  }
}
