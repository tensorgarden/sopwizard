# Architecture

SOPWizard turns a recorded browser session into a reviewed, exportable SOP. It is split so the capture surface, the model that interprets a recording, and the export formats can each change without touching the others.

## Pipeline

```
capture  →  segment  →  consolidate  →  draft  →  review  →  export
```

1. **Capture** (`extension/`) — a Chrome MV3 extension records the workflow: pointer and keyboard interactions, form-field changes, navigation, and a keyframe at each meaningful step. Each event carries a description of the target element (role, accessible name, and a stable selector), so later stages don't have to guess from pixels alone.

2. **Segment** (`server/src/segment.js`) — the raw event stream is ordered into discrete actions on natural boundaries: navigations, submits, and interactions. Element descriptors give each action a deterministic label.

3. **Consolidate** (`server/src/consolidate.js`) — actions are grouped into business-intent steps. Every raw action survives underneath its step as evidence, so the keyframes, timings, and click-by-click trail are never lost. The grouping is structural; a model regroups on top of it.

4. **Draft** (`server/src/draft.js`) — two passes. The first turns groups into phases and narrated steps. The second reads those steps back and writes the reference material around them (prerequisites, decisions, troubleshooting) — whole-document questions no single chunk of events can answer. Open questions are surfaced to the user rather than guessed.

5. **Review** — the user settles the guidance (below), answers open questions, and corrects any step in plain language. Corrections apply to the affected section only, and are kept so future drafts of similar workflows improve.

6. **Export** — a visual guide (annotated keyframes + steps), a Markdown master, and a Word document, all rendered from one structured SOP.

## Two tiers of content

What a recording can't show — where a value comes from, why it matters, how to choose — is what separates a click log from a procedure. The document model (`server/src/model.js`) keeps the two tiers apart rather than blending them into prose.

- **Observed** — the recording shows it. Safe to state.
- **Guidance** — domain knowledge no capture contains. It carries a `verified` flag, lives in its own field, and a person keeps or removes each claim before the SOP can be approved.

Guidance is quarantined in its own field rather than mixed into the step text so that dropping every `guidance` key leaves a document containing only what was actually recorded. The narrator is asked to omit it where it doesn't know rather than pad, and to ask a question instead of guessing.

A provider that offers no guidance and no reference sections still yields a valid SOP — a thinner one. That is what a run with no model reachable produces.

## Seams

Three boundaries are deliberately pluggable:

- **Model provider** — the interpretation/narration step talks to a provider through a narrow interface, so the underlying model (hosted or self-managed) is a configuration choice, not a rewrite.
- **Exporters** — output formats are independent renderers over one structured SOP representation. Adding or changing a format doesn't touch capture or drafting.
- **Capture target** — the recorder works against any web application, so supporting additional surfaces is additive.

## The shared corpus

A recording is private and doesn't generalise. What generalises is the **review delta** — what the narrator wrote, and what a person changed it to — plus every guidance ruling, which is a human judgment on whether a specific claim about a specific system was true.

That data compounds through the **workflow fingerprint** (`fingerprint.js`): the host, the shape of each path with record ids templated out, and the ordered sequence of screens. Two agencies quoting on the same carrier site produce the same fingerprint, so the second one's first draft inherits what the first one's review established. Fingerprints are computed before drafting, so the gain is a better first draft rather than a better correction.

What crosses the wire (`corpus.js`): fingerprints, label hashes, the drafted text, the corrected text, and guidance rulings. What never does: keyframes, field values — which are never captured at all — the SOP document, and the agency's notes.

### The k-anonymity gate

A label's plaintext only travels once **K distinct organisations** have independently produced the same label. `Save client` clears at hundreds of agencies; `Delete policy for John Smith` occurs at exactly one and never clears. A string seen at a single agency is not a learnable pattern, so the gate costs the corpus nothing.

The gate is enforced in the database, not the client: `org_count` is maintained by a trigger from distinct sightings, and row-level security only exposes another org's row once every label in it has cleared. A client cannot assert that a label is safe.

Limit: label hashes are unsalted, because a per-org salt would prevent the cross-agency matching the corpus exists for. Labels are short and low-entropy, so a hash keeps a label out of the corpus and downstream but does not hide it from whoever runs the server.

## Sensitive data

Recordings can contain personal and account information. Redaction runs before anything leaves the local pipeline, and a human review step gates every SOP before it is saved or shared. Screenshots never leave the machine.

The guidance gate is part of this: an approved SOP is one where a person has kept or removed every claim the recording couldn't vouch for. In a regulated workflow a confident, wrong "why it matters" is costly, so approval blocks rather than warns.
