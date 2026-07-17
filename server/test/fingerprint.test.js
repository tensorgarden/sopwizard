import { test } from 'node:test';
import assert from 'node:assert/strict';
import { workflowFingerprint, pathTemplate, labelHash, labelKey, fingerprintsFor } from '../src/fingerprint.js';

test('same flow, different record ids, same fingerprint', () => {
  const a = [{ url: 'https://app.example.com/clients' }, { url: 'https://app.example.com/clients/new' }, { url: 'https://app.example.com/clients/84213' }];
  const b = [{ url: 'https://app.example.com/clients' }, { url: 'https://app.example.com/clients/new' }, { url: 'https://app.example.com/clients/99017' }];
  assert.equal(workflowFingerprint(a), workflowFingerprint(b));
});

test('different site, different fingerprint', () => {
  const a = [{ url: 'https://app.example.com/clients' }];
  const b = [{ url: 'https://other.example.com/clients' }];
  assert.notEqual(workflowFingerprint(a), workflowFingerprint(b));
});

test('path templating collapses record ids', () => {
  assert.equal(pathTemplate('https://a.com/clients/84213'), '/clients/:id');
  assert.equal(pathTemplate('https://a.com/policies/POL-2026-4471/edit'), '/policies/:id/edit');
  assert.equal(pathTemplate('https://a.com/clients/9f8e7d6c-1234-4abc-9def-000000000000'), '/clients/:id');
  assert.equal(pathTemplate('https://a.com/clients/new'), '/clients/new');
});

test('label key normalizes case and spacing; hash is stable', () => {
  assert.equal(labelKey('Save  Client'), 'save client');
  assert.equal(labelHash('Save Client'), labelHash('save client'));
});

test('fingerprintsFor prefers the stored workflow fingerprint', () => {
  const sop = { source: { workflowFingerprint: 'stored-key' }, steps: [{ index: 1, url: 'https://a.com/x', evidence: [{ action: 'click', target: { tag: 'button' } }] }] };
  assert.equal(fingerprintsFor(sop).workflow, 'stored-key');
});
