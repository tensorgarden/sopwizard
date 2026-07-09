# SOPWizard

Record a browser workflow while you work, and turn it into a clear, structured standard operating procedure — a polished visual guide plus clean Word and Markdown documents you can hand to a teammate or feed to an AI assistant.

## Why

Most process knowledge lives in people's heads. Writing it down is tedious, so it rarely happens. SOPWizard captures what you actually did — the pages you opened, the fields you filled, the choices you made — and drafts the SOP for you. You answer a couple of questions, correct anything it misread, approve, and share.

## How it works

```
capture  →  segment  →  draft  →  review  →  approve  →  export
```

1. **Record** — a Chrome extension captures the workflow as you perform it, with a screenshot at each step.
2. **Add context** — note the task and anything worth knowing before you start; add more after.
3. **Generate** — the pipeline segments the recording into steps and drafts the SOP, asking targeted questions instead of guessing.
4. **Review & correct** — fix any step in plain English; only that step changes. A correction can apply to just this SOP or to all future workflows like it — those become lessons that improve the next draft.
5. **Approve & export** — a visual guide with each step's screenshot and timestamp, plus Word and Markdown.

## Narration

The step that turns events into prose sits behind a small provider interface:

- **Default** — a deterministic narrator that needs no network or configuration, so everything works out of the box.
- **Model-backed** — point `LLM_URL` / `LLM_MODEL` at any chat-completions-style endpoint and drafts get natural titles, intros, and smarter questions. A local [Ollama](https://ollama.com) works as-is:

  ```bash
  ollama pull llama3.2   # then just start the server — it's detected automatically
  ```

  Small, inexpensive models are the design target: one compact request narrates the whole SOP. If the endpoint is missing or fails, the deterministic narrator takes over — generation never blocks.

Recordings never capture what you type, only which fields you touched. Screenshots stay on your machine; the only thing that can reach a model is text, and it passes through a deterministic redaction gate (SSNs, emails, phone and card numbers) first.

## Getting started

Requires Node 20+.

```bash
cd server
npm install
npm start        # → http://localhost:8787
```

Open `http://localhost:8787` — the home page has the extension download and install steps. Or load `extension/` unpacked at `chrome://extensions` directly.

To see the pipeline without recording anything: `npm run demo` (writes a sample SOP to `data/sops/sample/`).

## Layout

| Path | What |
| --- | --- |
| `extension/` | Chrome (MV3) recorder |
| `server/` | Pipeline: ingest → segment → draft → review → export |
| `docs/` | Architecture notes |

## Status

Early development.
