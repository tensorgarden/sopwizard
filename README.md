# SOPWizard

Record a browser workflow while you work, and turn it into a clear, structured standard operating procedure — a readable step-by-step guide plus a clean document you can hand to a teammate or feed to an AI assistant.

## Why

Most process knowledge lives in people's heads. Writing it down is tedious, so it rarely happens. SOPWizard captures what you actually did — the pages you opened, the fields you filled, the choices you made — and drafts the SOP for you. You review, correct anything it misread, and export.

## How it works

1. **Record** — a Chrome extension captures the workflow as you perform it in the browser.
2. **Add context** — note the task, the systems involved, and any rules or exceptions, before or after recording.
3. **Generate** — the pipeline segments the recording into steps and drafts a clear SOP, asking follow-up questions when something is ambiguous.
4. **Review & correct** — fix any step, field, or decision in plain English; only the affected section is regenerated.
5. **Export** — a polished visual guide and a clean document.

## Layout

| Path | What |
| --- | --- |
| `extension/` | Chrome (MV3) recorder |
| `server/` | Processing pipeline: ingest → segment → generate |
| `docs/` | Architecture notes |

## Getting started

**Extension** — open `chrome://extensions`, enable Developer mode, choose *Load unpacked*, and select the `extension/` folder.

**Server** (requires Node 20+):

```bash
cd server
npm start
```

The extension posts recordings to the server at `http://localhost:8787`.

## Status

Early development.
