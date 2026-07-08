# Architecture

SOPWizard turns a recorded browser session into a reviewed, exportable SOP. It is split so the capture surface, the model that interprets a recording, and the export formats can each change without touching the others.

## Pipeline

```
capture  →  segment  →  draft  →  review  →  export
```

1. **Capture** (`extension/`) — a Chrome MV3 extension records the workflow: pointer and keyboard interactions, form-field changes, navigation, and a keyframe at each meaningful step. Each event carries a description of the target element (role, accessible name, and a stable selector), so later stages don't have to guess from pixels alone.

2. **Segment** (`server/`) — the raw event stream is grouped into discrete steps on natural boundaries: navigations, submits, and settled network activity. Element descriptors give each step a deterministic label; a model is used only to write the narration, not to find the steps.

3. **Draft** — the segmented steps, plus any context the user added before and after recording, become a first SOP draft. The draft is checked against the source events, and genuinely open questions are surfaced back to the user rather than guessed.

4. **Review** — the user corrects any step, field, or decision in plain language. Corrections apply to the affected section only, and are kept so future drafts of similar workflows improve.

5. **Export** — two outputs: a visual guide (annotated keyframes + steps) and a clean document authored from a single source so it renders consistently to several formats.

## Seams

Three boundaries are deliberately pluggable:

- **Model provider** — the interpretation/narration step talks to a provider through a narrow interface, so the underlying model (hosted or self-managed) is a configuration choice, not a rewrite.
- **Exporters** — output formats are independent renderers over one structured SOP representation. Adding or changing a format doesn't touch capture or drafting.
- **Capture target** — the recorder works against any web application, so supporting additional surfaces is additive.

## Sensitive data

Recordings can contain personal and account information. Redaction runs before anything leaves the local pipeline, and a human review step gates every SOP before it is saved or shared.
