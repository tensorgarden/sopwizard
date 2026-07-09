// Optional cloud sync: mirrors SOP metadata, usage events, and errors to the
// team workspace. Signs in as a real account, so row-level security decides
// what this instance may write. Disabled unless configured; local operation
// never depends on it.
//
// Config: SYNC_URL, SYNC_ANON_KEY, SYNC_EMAIL, SYNC_PASSWORD.

const URL_BASE = process.env.SYNC_URL;
const ANON_KEY = process.env.SYNC_ANON_KEY;
const EMAIL = process.env.SYNC_EMAIL;
const PASSWORD = process.env.SYNC_PASSWORD;

let session = null; // { token, userId, orgId }
let warned = false;

export function syncEnabled() {
  return Boolean(URL_BASE && ANON_KEY && EMAIL && PASSWORD);
}

function warnOnce(message) {
  if (!warned) {
    warned = true;
    console.warn(`cloud sync disabled: ${message}`);
  }
}

async function login() {
  const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  if (!res.ok) throw new Error(`sign-in failed (${res.status})`);
  const body = await res.json();

  const profile = await rest('GET', `profiles?id=eq.${body.user.id}&select=org_id`, null, body.access_token);
  const orgId = profile?.[0]?.org_id;
  if (!orgId) throw new Error('account has no organization — assign one in the back office');

  session = { token: body.access_token, userId: body.user.id, orgId };
  return session;
}

async function rest(method, path, payload, token) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON_KEY,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      prefer: method === 'POST' ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal',
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (res.status === 401) throw Object.assign(new Error('unauthorized'), { expired: true });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.status === 200 ? res.json() : null;
}

// payloadFor runs after sign-in so rows carry real org/user attribution.
async function write(path, payloadFor) {
  if (!syncEnabled()) return;
  try {
    if (!session) await login();
    try {
      await rest('POST', path, payloadFor(session), session.token);
    } catch (err) {
      if (!err.expired) throw err;
      await login();
      await rest('POST', path, payloadFor(session), session.token);
    }
  } catch (err) {
    warnOnce(err.message);
  }
}

export function syncSop(id, sop) {
  return write('sops?on_conflict=id', (s) => ({
    id,
    org_id: s.orgId,
    created_by: s.userId,
    title: sop.title,
    status: sop.status,
    steps: sop.steps.length,
    duration_ms: sop.steps.at(-1)?.t ?? 0,
    narrator: sop.narrator ?? null,
    approved_at: sop.approvedAt ? new Date(sop.approvedAt).toISOString() : null,
  }));
}

export function syncEvent(kind, entry) {
  return write('usage_events', (s) => ({
    org_id: s.orgId,
    user_id: s.userId,
    sop_id: entry.sop ?? null,
    kind,
    steps: entry.steps ?? 0,
    duration_ms: entry.durationMs ?? 0,
    credits: entry.credits ?? 0,
    narrator: entry.narrator ?? null,
    meta: entry.format ? { format: entry.format } : {},
  }));
}

export function syncError(message, extra = {}) {
  return write('client_errors', (s) => ({
    user_id: s.userId,
    org_id: s.orgId,
    source: 'pipeline',
    message: String(message).slice(0, 2000),
    ...extra,
  }));
}
