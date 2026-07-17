// Strips sensitive values from captured text. Everything leaving the local
// pipeline passes through here first.
//
// A regex catches data with a shape — SSN, FEIN, street address. It does not
// catch a person's name: "Delete policy for John Smith" has no shape to match,
// and an agency management system puts exactly that in a button's accessible
// name.
//
// So this is one layer, not the gate. What may enter the shared corpus is
// decided by k-anonymity (see corpus.js), not here: a label only travels once
// many agencies have independently produced it, and a client's name never will.
//
// Deliberately not redacted, because over-redaction destroys the document it is
// meant to protect:
//
//   Dates  — "coverage starts 07/16/26" is the answer a reader came for.
//   ZIP    — a rating input an SOP has to discuss, and nuking every five-digit
//            number would take premiums and counts with it.
//
// Both are quasi-identifying in combination, but neither reaches the corpus: a
// ZIP is a field value, and field values are never captured in the first place.

const PATTERNS = [
  { name: 'ssn', re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { name: 'card', re: /\b(?:\d[ -]?){13,16}\b/g },
  { name: 'email', re: /\b[\w.+-]+@[\w-]+\.[\w.]+\b/g },
  { name: 'phone', re: /\b(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}\b/g },

  // Employer identification number — two digits, hyphen, seven. Distinctive
  // enough to match on sight, and it identifies the business outright.
  { name: 'fein', re: /\b\d{2}-\d{7}\b/g },

  // Street address: a number, some words, and a thoroughfare type. The suffix
  // list is what keeps this from eating ordinary prose.
  {
    name: 'address',
    re: /\b\d{1,6}\s+(?:[A-Za-z0-9.'-]+\s+){0,4}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Circle|Cir|Terrace|Ter|Place|Pl|Parkway|Pkwy|Highway|Hwy|Way|Trail|Trl)\b\.?(?:\s+(?:Suite|Ste|Unit|Apt|#)\s*[\w-]+)?/gi,
  },

  // Policy, account, and claim numbers: a letter prefix against a long digit
  // run. Every carrier uses some variant of this.
  { name: 'policy number', re: /\b[A-Z]{2,5}[-\s]?\d{6,}\b/g },

  // Digit runs long enough to be an account or routing number rather than a
  // quantity or a dollar amount.
  { name: 'account number', re: /\b\d{9,17}\b/g },
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

// A cheap local pre-filter for anything bound for the shared corpus.
//
// Hashing a label does not protect it: labels are short and low-entropy, so a
// stored hash is recoverable with a dictionary in seconds, and the hash must be
// computed the same way everywhere to match across agencies — which rules out a
// per-org salt. Hashing keeps a label out of the shared corpus and anything
// downstream of it, but does not hide it from whoever runs the server.
//
// So this filter refuses on cheap, unambiguous signals only, and leaves the
// ambiguous call to the k-anonymity gate. "New Client" and "John Smith" are
// indistinguishable by shape; no rule here can separate them.
export function looksIdentifying(text) {
  if (!text) return true;
  const value = String(text).trim();

  if (!value || value.length > 60) return true;
  if (value.includes('removed]')) return true; // already matched a pattern above
  if (/\d/.test(value)) return true; // a control rarely needs digits; a record does

  return false;
}
