# SOPWizard — Technical Overview

This document is the technical reference for SOPWizard: what it is, how it runs,
what it touches, what leaves the machine, and where it is designed to integrate
with a host system. It is written for an engineer evaluating the product or
folding it into a larger platform. For the conceptual design of the pipeline and
the shared corpus, see [architecture.md](./architecture.md).

## What it is

SOPWizard turns a recorded browser session into a reviewed, exportable standard
operating procedure. A person records themselves doing a task in any web
application; SOPWizard groups the raw interactions into the handful of steps the
work actually consisted of, drafts a procedure, asks about anything the recording
can't explain, and — after a human reviews it — produces three artifacts from one
structured source:

- a **visual guide** (HTML, printable) with the acted-on element highlighted in
  each screenshot,
- a **Markdown master** built to be read by software as well as people, and
- a **Word document** with the same content.

It is two components: a Chrome extension that records, and a local Node server
that interprets and renders.

## Running it

Requirements: Node 20 or later. No database and no build step — the server
writes to the local filesystem.

```
npm install
npm start --workspace @sopwizard/server     # http://localhost:8787
```

To exercise the pipeline without the extension, run the bundled sample:

```
npm run demo --workspace @sopwizard/server
```

The extension is loaded unpacked from `extension/` (Chrome → Extensions →
Developer mode → Load unpacked), or downloaded as a zip from the running
server at `/extension.zip`.

### Components

| Component | Runtime | Responsibility |
|---|---|---|
| `extension/` | Chrome MV3 | Captures interactions, navigation, and a keyframe per meaningful step; batches them to the server on stop. |
| `server/` | Node HTTP | Segments, consolidates, drafts, renders, persists, and serves the SOP. |

The server binds to `127.0.0.1` only and rejects cross-origin writes and foreign
`Host` headers. It is a single-user local tool as shipped; see
[Integration surfaces](#integration-surfaces) for what a hosted deployment would
add.

## The pipeline

```
capture → segment → consolidate → draft → review → export → (contribute)
```

1. **Capture** — the extension records element descriptors (role, accessible
   name, stable selector), not pixels, so later stages don't guess from images.
2. **Segment** (`segment.js`) — the event stream is ordered into discrete
   actions on natural boundaries.
3. **Consolidate** (`consolidate.js`) — actions are grouped into business-intent
   steps. Every raw action is preserved beneath its step as evidence.
4. **Draft** (`draft.js`) — a provider narrates the groups into phases and steps
   (pass one) and writes the reference sections (pass two). Open questions are
   surfaced rather than guessed.
5. **Review** (`export/review.js`) — a person clears the guidance, answers open
   questions, corrects steps, and approves. Approval is blocked until every
   guidance claim is settled.
6. **Export** (`export/`) — one structured document renders to HTML, Markdown,
   and Word.
7. **Contribute** (`corpus.js`) — optional and off by default; see
   [Security & privacy](#security--privacy).

## Configuration

All configuration is environment variables (see `server/.env.example`). Every
one is optional; with none set, the server runs fully locally with deterministic
narration.

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `8787` | Bound to `127.0.0.1` only. |
| `LLM_URL` | `http://localhost:11434/v1` | Any OpenAI-shaped chat-completions endpoint. A local Ollama is detected automatically. |
| `LLM_MODEL` | `llama3.2` | Model name passed to that endpoint. |
| `LLM_API_KEY` | — | Sent as a bearer token when set. |
| `SOP_PROVIDER` | auto | Force `rules` (no model) or `llm`. |
| `SYNC_*` | off | Optional sync of SOP metadata and usage to a workspace (counters and titles only). |
| `CORPUS` | off | Opt-in cross-organization corpus. Off unless set to `on`. |
| `CORPUS_K` | `5` | Distinct organizations a label must be seen at before its plaintext is shared. |
| `WEBHOOK_URL` | — | Endpoint to notify when a SOP is approved (metadata only). |

## Data model

One folder per SOP under `server/data/sops/<id>/`, holding the structured source
of truth (`sop.json`) plus every rendered artifact:

```
data/sops/<id>/
  sop.json        structured document — the single source every exporter reads
  index.html      visual guide
  review.html     review page
  sop.md          Markdown master
  sop.docx        Word document
```

The `sop.json` shape (`model.js`) separates two tiers of content deliberately:

- **Observed** — what the recording shows. Stated plainly.
- **Guidance** — domain knowledge no recording contains (why a field matters,
  how to decide, what the exceptions are). It lives in its own `guidance` field,
  carries a `verified` flag, and a person keeps or removes each claim before the
  SOP can be approved. Dropping every `guidance` key leaves a document of only
  what was actually recorded.

Top-level: `title`, `intro`, `status`, `meta` (system/workflow/audience/
sensitivity/version), `phases[]`, `steps[]` (each with `evidence[]`, an optional
`guidance` block, and a keyframe), the guidance-tier reference sections
(`prerequisites`, `decisions`, `troubleshooting`, `checklist`), and
`suggestedQuestions[]`.

Documents written before the model grew phases and reference sections load
through `normalize()`, so the store is forward-compatible without a migration.

## Output formats

Exporters (`export/index.js`) are independent renderers over `sop.json`; adding a
format touches nothing upstream. The Markdown master is the fullest export and
the one intended for ingestion into a retrieval/knowledge base — a screenshot
can't be indexed, so anything a keyframe carries in the visual guide is written
into the prose there. Unverified guidance renders with a visible marker in a
draft and is only ever presented as settled once a reviewer has cleared it.

## HTTP API

The server is bound to localhost. `GET` is open; writes require a same-origin or
extension origin.

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/recordings` | Run a recording through the pipeline. Returns `{ id, steps, clarifications, review, view }`. |
| `POST` | `/sops/:id/answers` | Fold answers to open questions into the named steps. |
| `POST` | `/sops/:id/corrections` | Rewrite a step; optionally remember the correction for future drafts. |
| `POST` | `/sops/:id/guidance` | Keep or remove guidance claims. |
| `POST` | `/sops/:id/approve` | Finalize. `400` while any guidance is unsettled. |
| `GET` | `/sops/:id` | Visual guide. |
| `GET` | `/sops/:id/review` | Review page. |
| `GET` | `/sops/:id/sop.md`, `/sop.docx` | Markdown / Word, downloaded under the SOP's title. |
| `GET` | `/export/approved.zip` | Every approved SOP's Markdown in one archive. |
| `GET` | `/` , `/practice`, `/health`, `/extension.zip` | Library, practice page, health check, extension download. |

## Security & privacy

The product is built for workflows that touch personal and account data, so the
handling is conservative by default:

- **Redaction runs first** (`redact.js`). Social security and card numbers,
  emails, phones, employer identification numbers, street addresses, and policy
  and account numbers are stripped before any provider, export, or `sop.json`
  sees the text. Every stage inherits this rather than each remembering to ask.
  Regular expressions catch data with a shape; they do not catch names.
- **Field values are never captured.** The recorder records element descriptors,
  not the contents typed into fields.
- **Screenshots never leave the machine.** Keyframes are embedded in the local
  guide and excluded from any sync.
- **A human gates every SOP.** Approval is blocked until a person has kept or
  removed each guidance claim — the part of the document the recording cannot
  vouch for.
- **The cross-organization corpus is opt-in.** It is off unless `CORPUS=on` is
  set explicitly, and even then a label's plaintext is shared only after it has
  been seen at `CORPUS_K` distinct organizations (enforced in the database, not
  the client). The server logs plainly at startup whether it is on.

## Integration surfaces

What exists today and where the product is designed to plug into a host:

- **Model provider** (`providers/`) — narration talks to a provider through a
  narrow interface, so the model (local or hosted, a shared endpoint or a
  private one) is a configuration choice, not a code change.
- **Exporters** (`export/`) — output formats are independent renderers over
  `sop.json`. A host-native artifact would be a new file, not a rewrite.
- **Approval webhook** (`webhook.js`) — a metadata-only `sop.approved` signal to
  a configurable endpoint, so a host learns a reviewed document is ready without
  polling. It carries the title, id, and where to fetch — never the body.
- **Sync** (`sync.js`) — optional mirror of SOP metadata and usage events to a
  workspace, authenticated as a real account so row-level security governs every
  write.

A hosted, multi-user deployment would add an authenticated identity on inbound
requests and a reachable (non-loopback) address; the server's read and write
paths are already separated to make that additive rather than invasive.

## Project layout

```
extension/            Chrome MV3 recorder
server/src/
  index.js            HTTP server and routing
  segment.js          event stream → ordered actions
  consolidate.js      actions → business-intent steps (evidence preserved)
  draft.js            two-pass drafting and assembly
  model.js            document shape, the two tiers, normalize()
  review.js           open-question checks
  revise.js           answers, corrections, guidance rulings, approval gate
  redact.js           pattern-based PII redaction
  fingerprint.js      workflow identity for the corpus
  corpus.js           opt-in cross-organization corpus (k-anonymity gated)
  webhook.js          sop.approved signal
  sync.js             optional metadata sync
  usage.js            usage ledger
  providers/          llm (model-backed) and rules (deterministic) narration
  export/             markdown, html, docx, review page, shared theme, zip
docs/                 this file and architecture.md
```
