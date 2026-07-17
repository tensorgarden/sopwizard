# SOPWizard

Record a browser workflow while you work, and turn it into a clear, structured standard operating procedure — a polished visual guide plus clean Word and Markdown documents you can hand to a teammate or feed to an AI assistant.

## Why

Most process knowledge lives in people's heads. Writing it down is tedious, so it rarely happens. SOPWizard captures what you actually did — the pages you opened, the fields you filled, the choices you made — and drafts the SOP for you. You answer a couple of questions, correct anything it misread, approve, and share.

## How it works

```
capture  →  segment  →  consolidate  →  draft  →  review  →  approve  →  export
```

1. **Record** — a Chrome extension captures the workflow as you perform it, with a screenshot at each step. It records only the tab you started in.
2. **Add context** — note the task and anything worth knowing before you start; add more after.
3. **Generate** — the pipeline groups the recording into the handful of steps the work actually consisted of and drafts the SOP, asking targeted questions instead of guessing.
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

Recordings never capture what you type, only which fields you touched. Screenshots stay on your machine; the only thing that can reach a model is text, and it passes through a deterministic redaction gate — Social Security, card, account and policy numbers, employer identification numbers, street addresses, emails, and phone numbers — first. A person reviews and approves every SOP before it is saved or shared.

## Getting started

Requires Node 20+.

```bash
cd server
npm install
npm start        # → http://localhost:8787
```

Open `http://localhost:8787` — the home page has the extension download and install steps. Or load `extension/` unpacked at `chrome://extensions` directly.

To see the pipeline without recording anything: `npm run demo`.

Run the tests with `npm test --workspace @sopwizard/server`.

## Where data lives

SOPs, the usage ledger, and lessons are stored outside the application folder, in your OS user-data directory (`~/Library/Application Support/SOPWizard` on macOS, `%APPDATA%\SOPWizard` on Windows, `~/.local/share/SOPWizard` on Linux) — so replacing the app with a new build never deletes your SOPs. A `data/` folder left over from an earlier version is migrated automatically on first run. Set `SOPWIZARD_DATA_DIR` to choose a different location.

## Layout

| Path | What |
| --- | --- |
| `extension/` | Chrome (MV3) recorder |
| `server/` | Pipeline: ingest → segment → consolidate → draft → review → export |
| `docs/` | Architecture and technical notes |

## Status

Pilot-ready. SOPWizard is an [Uncovered](https://uncoveredapp.com) product.
