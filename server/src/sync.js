// Optional cloud sync: mirrors SOPs, usage events, and errors to the team
// workspace, signed in as a real account so row-level security governs
// writes. Config: SYNC_URL, SYNC_ANON_KEY, SYNC_EMAIL, SYNC_PASSWORD.
//
// Counters and titles only — no step text, no guidance, no keyframes.

import { actionsIn, durationOf } from './model.js';

const URL_BASE = process.env.SYNC_URL;
const ANON_KEY = process.env.SYNC_ANON_KEY;
const EMAIL = process.env.SYNC_EMAIL;
const PASSWORD = process.env.SYNC_PASSWORD;
const TIMEOUT_MS = Number(process.env.SYNC_TIMEOUT_MS || 5000);

let session = null; // { token, userId, orgId }
let loginInFlight = null;
let lastStatus = null; // { ok, at, error? }
const warned = new Set();

export function syncEnabled() {
  return Boolean(URL_BASE && ANON_KEY && EMAIL && PASSWORD);
}

// Enough for /health to show whether the workspace is actually reachable,
// instead of the failure being invisible after the first warning.
export function syncStatus() {
  if (!syncEnabled()) return 'off';
  if (!lastStatus) return 'idle';
  return lastStatus.ok ? 'ok' : `error: ${lastStatus.error}`;
}

// One warning per distinct message, not one warning ever — a recurring failure
// stays visible instead of going silent for the life of the process.
function warn(message) {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(`cloud sync issue: ${message}`);
}

async function login() {
  const res = await fetch(`${URL_BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`sign-in failed (${res.status})`);
  const body = await res.json();

  const profile = await rest('GET', `profiles?id=eq.${body.user.id}&select=org_id`, null, body.access_token);
  const orgId = profile?.[0]?.org_id;
  if (!orgId) throw new Error('account has no organization — assign one in the back office');

  session = { token: body.access_token, userId: body.user.id, orgId };
  return session;
}

// Concurrent writes share one login rather than each opening their own.
function ensureLogin(force = false) {
  if (force) {
    session = null;
    loginInFlight = null;
  }
  if (session) return Promise.resolve(session);
  if (!loginInFlight) loginInFlight = login().finally(() => (loginInFlight = null));
  return loginInFlight;
}

async function rest(method, path, payload, token, prefer) {
  const res = await fetch(`${URL_BASE}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON_KEY,
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      prefer: prefer ?? (method === 'POST' ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal'),
    },
    body: payload ? JSON.stringify(payload) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 401) throw Object.assign(new Error('unauthorized'), { expired: true });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.status === 200 ? res.json() : null;
}

// payloadFor runs after sign-in so rows carry real org/user attribution.
async function write(path, payloadFor, { prefer, throwOnError = false } = {}) {
  if (!syncEnabled()) return;
  try {
    await ensureLogin();
    try {
      await rest('POST', path, payloadFor(session), session.token, prefer);
    } catch (err) {
      if (!err.expired) throw err;
      await ensureLogin(true);
      await rest('POST', path, payloadFor(session), session.token, prefer);
    }
    lastStatus = { ok: true, at: Date.now() };
  } catch (err) {
    lastStatus = { ok: false, at: Date.now(), error: err.message };
    warn(err.message);
    if (throwOnError) throw err;
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
    actions: actionsIn(sop),
    duration_ms: durationOf(sop),
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

// Corpus contribution is opt-in via CORPUS=on, separate from sync being on. It
// moves one agency's plaintext review deltas into a store other agencies can
// read once the k-anonymity gate clears — a cross-tenant data flow that needs
// explicit consent, so it stays off by default.
export function corpusEnabled() {
  return syncEnabled() && process.env.CORPUS === 'on';
}

// Authenticated reads and writes for the corpus tables. Same session and
// timeout policy as everything else here; opts.throwOnError lets the corpus
// report a failed contribution instead of recording a phantom success.
export function post(path, payloadFor, opts) {
  return write(path, payloadFor, opts);
}

export async function get(path) {
  if (!syncEnabled()) return null;
  try {
    await ensureLogin();
    try {
      return await rest('GET', path, null, session.token);
    } catch (err) {
      if (!err.expired) throw err;
      await ensureLogin(true);
      return await rest('GET', path, null, session.token);
    }
  } catch (err) {
    lastStatus = { ok: false, at: Date.now(), error: err.message };
    warn(err.message);
    return null;
  }
}

// Call a database function. The corpus uses one so the gate is decided in the
// database over the caller's own hashes, rather than exposing the whole hash
// table for offline reversal.
export async function rpc(fn, args) {
  if (!syncEnabled()) return null;
  const call = async () => {
    const res = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        apikey: ANON_KEY,
        authorization: `Bearer ${session.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 401) throw Object.assign(new Error('unauthorized'), { expired: true });
    if (!res.ok) throw new Error(`rpc ${fn} → ${res.status}`);
    return res.json();
  };
  try {
    await ensureLogin();
    try {
      return await call();
    } catch (err) {
      if (!err.expired) throw err;
      await ensureLogin(true);
      return await call();
    }
  } catch (err) {
    lastStatus = { ok: false, at: Date.now(), error: err.message };
    warn(err.message);
    return null;
  }
}
