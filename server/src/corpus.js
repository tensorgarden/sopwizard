// The shared corpus: what one agency's review teaches every later agency's
// first draft.
//
// The shared asset is the review delta — what the narrator drafted and what a
// person changed it to — plus every guidance ruling. It compounds through the
// workflow fingerprint: an agency recording a carrier's quote flow inherits the
// prior reviews of those exact screens.
//
// What crosses the wire:
//
//   fingerprints          hashes, not text
//   label hashes          gated by k-anonymity before any plaintext follows
//   narrator draft text   what the model wrote about a control
//   corrected text        what the human changed it to
//   guidance rulings      the claim, and whether a person kept it
//
// What never does: keyframes, field values (never captured at all), the SOP
// document, the agency's notes.
//
// The gate is k-anonymity: a label's plaintext only travels once K distinct
// organisations have independently produced the same label. "Save client"
// clears at many agencies; "Delete policy for John Smith" appears at exactly
// one and never clears.

import { labelHash, labelKey } from './fingerprint.js';
import { looksIdentifying } from './redact.js';
import { post, get, rpc, corpusEnabled } from './sync.js';

export { corpusEnabled };

// How many distinct organisations must independently produce a label before its
// plaintext is allowed to travel. Pinned to the value the database enforces in
// its row-level policies; a client-side number that drifts from the schema
// would let plaintext rest below the gate. A CORPUS_K override is honoured only
// when it matches, and a mismatch is surfaced rather than applied.
const K = 5;
if (process.env.CORPUS_K && Number(process.env.CORPUS_K) !== K) {
  console.warn(`CORPUS_K=${process.env.CORPUS_K} ignored — the k-anonymity gate is fixed at ${K} to match the database`);
}

// Offers the labels this SOP touched to the corpus as hashes, and returns the
// set of hashes the server says have cleared the gate. Nothing here sends
// plaintext; this call is what earns the right to.
async function clearedLabels(sop) {
  const offered = new Map();

  for (const step of sop.steps || []) {
    for (const action of step.evidence || []) {
      const name = action.target?.name;
      if (!name || looksIdentifying(name)) continue;
      const h = labelHash(name);
      if (h) offered.set(h, labelKey(name));
    }
  }

  if (!offered.size) return new Map();

  // The server counts distinct orgs per hash. It never learns the plaintext
  // from this call. Ignore-duplicates so a re-sighting from the same org is a
  // no-op insert (ON CONFLICT DO NOTHING) rather than an update — a sighting
  // ledger is append-only, and DO UPDATE would need a policy it shouldn't have.
  await post(
    'corpus_label_sightings?on_conflict=label_hash,org_id',
    (s) => [...offered.keys()].map((label_hash) => ({ label_hash, org_id: s.orgId })),
    { prefer: 'resolution=ignore-duplicates,return=minimal' }
  );

  // The database decides which of our hashes have cleared K distinct orgs and
  // returns only those. It never hands back the rest of the hash universe, so a
  // tenant can't dump it and brute-force low-entropy labels offline.
  const clearedHashes = await rpc('cleared_labels', { hashes: [...offered.keys()] });
  if (!Array.isArray(clearedHashes)) return new Map();

  const cleared = new Map();
  for (const h of clearedHashes) {
    if (offered.has(h)) cleared.set(h, offered.get(h));
  }
  return cleared;
}

// Contribute what a review taught. Called on approval, when the document has
// been settled by a person and every claim in it has an owner.
export async function contribute(sop, fingerprints) {
  if (!corpusEnabled() || sop.status !== 'approved') return { sent: 0, withheld: 0 };

  const cleared = await clearedLabels(sop);
  let withheld = 0;

  const rows = [];
  for (const step of sop.steps || []) {
    const names = (step.evidence || []).map((a) => a.target?.name).filter(Boolean);
    const hashes = names.map(labelHash).filter(Boolean);

    // A step's plaintext only rides along if every label in it has cleared. One
    // un-cleared control is enough to make the whole step a private one.
    const allCleared = hashes.length > 0 && hashes.every((h) => cleared.has(h));
    if (!allCleared) withheld += 1;

    rows.push({
      workflow_fingerprint: fingerprints.workflow,
      step_fingerprint: fingerprints.steps[step.index],
      label_hashes: hashes,
      // The labels in plaintext, only where the gate cleared them.
      labels: allCleared ? hashes.map((h) => cleared.get(h)) : null,
      // The delta — narrator draft vs. the human's correction.
      drafted_title: allCleared ? step.draftedTitle ?? null : null,
      drafted_detail: allCleared ? step.draftedDetail ?? null : null,
      final_title: allCleared ? step.title : null,
      final_detail: allCleared ? step.detail : null,
      was_corrected: step.corrected === true,
      was_clarified: step.clarified === true,
      // A kept claim is one a person vouched for; a removed one is a claim the
      // narrator should stop making.
      guidance: allCleared && step.guidance ? step.guidance : null,
      guidance_kept: step.guidance ? true : step.guidanceRemoved === true ? false : null,
      narrator: sop.narrator ?? null,
    });
  }

  // Two same-role clicks on one templated page share a step fingerprint, and a
  // multi-row upsert with duplicate conflict keys fails as a whole. Collapse to
  // one row per fingerprint, keeping the most informative.
  const byFingerprint = new Map();
  for (const row of rows) {
    const prev = byFingerprint.get(row.step_fingerprint);
    if (!prev || informativeness(row) > informativeness(prev)) byFingerprint.set(row.step_fingerprint, row);
  }
  const deduped = [...byFingerprint.values()];

  // throwOnError so a rejected write surfaces as a failed contribution rather
  // than a ledger entry claiming success for data that never landed.
  await post(
    'corpus_steps?on_conflict=step_fingerprint,org_id',
    (s) => deduped.map((row) => ({ ...row, org_id: s.orgId })),
    { throwOnError: true }
  );

  const sent = deduped.filter((r) => r.labels).length;
  return { sent, withheld: deduped.length - sent };
}

function informativeness(row) {
  return (row.labels ? 2 : 0) + (row.final_detail ? 1 : 0) + (row.was_corrected ? 1 : 0);
}

// What the corpus already knows about this workflow. Merged into the drafting
// prompt so the next agency's first draft starts where the last one's review
// ended.
export async function lessonsFor(fingerprints) {
  if (!corpusEnabled() || !fingerprints.workflow) return [];

  const rows = await get(
    `corpus_steps?select=labels,final_title,final_detail,guidance,was_corrected` +
      `&workflow_fingerprint=eq.${fingerprints.workflow}` +
      `&was_corrected=is.true&final_detail=not.is.null&limit=24`
  );
  if (!rows?.length) return [];

  // Shaped like a local lesson so the providers don't need to know where a
  // lesson came from.
  return rows.map((row) => ({
    rule: `For the step on ${(row.labels || []).join(', ') || 'this screen'}, other agencies settled on: "${row.final_title} — ${row.final_detail}"`,
    from: { corpus: true },
  }));
}
