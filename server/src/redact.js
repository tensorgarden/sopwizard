// Deterministic redaction of sensitive values in captured text.
//
// Recordings only ever capture element labels and page URLs — never typed
// values — but labels can still surface personal data (a row titled with a
// client's name and policy number, for example). Anything leaving the local
// pipeline passes through here first; this is a hard gate, not a model
// behavior.

const PATTERNS = [
  { name: 'ssn', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { name: 'card', re: /\b(?:\d[ -]?){13,16}\b/g },
  { name: 'email', re: /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g },
  { name: 'phone', re: /\b(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}\b/g },
];

export function redactText(text) {
  if (!text) return text;
  let out = String(text);
  for (const { name, re } of PATTERNS) {
    out = out.replace(re, `[${name} removed]`);
  }
  return out;
}

export function redactStep(step) {
  return {
    ...step,
    url: redactText(step.url),
    target: step.target
      ? { ...step.target, name: redactText(step.target.name) }
      : null,
  };
}
