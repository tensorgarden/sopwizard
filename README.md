# SOPWizard

Record a browser workflow while you work, and turn it into a clear, structured standard operating procedure — a readable visual guide plus a clean document you can hand to a teammate or feed to an AI assistant.

## Why

Most process knowledge lives in people's heads. Writing it down is tedious, so it rarely happens. SOPWizard captures what you actually did — the pages you opened, the fields you filled, the choices you made — and drafts the SOP for you. You review, correct anything it misread, and export.

## How it works

```
capture  →  segment  →  draft  →  export
```

1. **Record** — a Chrome extension captures the workflow as you perform it, with a keyframe at each step.
2. **Add context** — note the task, the systems involved, and any rules or exceptions, before or after recording.
3. **Generate** — the pipeline segments the recording into steps and drafts a clear SOP.
4. **Review & correct** — fix any step, field, or decision; only the affected section is regenerated.
5. **Export** — a visual HTML guide and a Markdown document (the master other formats derive from).

The step that turns events into prose sits behind a small provider interface, so the model — hosted or self-managed — is a configuration choice rather than a rewrite. The default provider is deterministic and needs no network, so the pipeline runs anywhere out of the box.

## Layout

| Path | What |
| --- | --- |
| `extension/` | Chrome (MV3) recorder |
| `server/` | Processing pipeline: ingest → segment → draft → export |
| `docs/` | Architecture notes |

## Getting started

Requires Node 20+.

```bash
# see the pipeline produce a SOP from the bundled sample
cd server
npm run demo

# or run the server and post recordings to it
npm start   # listens on :8787
```

Generated SOPs are written under `server/data/sops/<id>/` as `sop.md`, `sop.docx`, `index.html`, and `sop.json`. Posting a recording to `POST /recordings` returns a `review` link (`/sops/<id>/review`) where you answer the open questions and correct any step in plain language — edits apply only to the step they name.

**Extension** — open `chrome://extensions`, enable Developer mode, choose *Load unpacked*, and select the `extension/` folder. With the server running, record a workflow and stop to generate the SOP.

## Status

Early development.
