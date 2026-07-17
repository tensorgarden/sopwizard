import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactText, redactStep, looksIdentifying } from '../src/redact.js';

test('redacts data with a recognizable shape', () => {
  assert.match(redactText('SSN 123-45-6789'), /\[ssn removed\]/);
  assert.match(redactText('FEIN 47-1234567'), /\[fein removed\]/);
  assert.match(redactText('call 980-908-3982'), /\[phone removed\]/);
  assert.match(redactText('tom@test.com'), /\[email removed\]/);
  assert.match(redactText('card 4111 1111 1111 1111'), /\[card removed\]/);
  assert.match(redactText('1240 N Rockwell Ave Suite 300'), /\[address removed\]/);
  assert.match(redactText('policy POL-2026884'), /\[policy number removed\]/);
  assert.match(redactText('routing 021000021'), /\[account number removed\]/);
});

test('preserves the values an SOP is about', () => {
  assert.equal(redactText('Coverage starts on 07/16/26'), 'Coverage starts on 07/16/26');
  assert.equal(redactText('ZIP code 66223'), 'ZIP code 66223');
  assert.equal(redactText('$37.17 per month'), '$37.17 per month');
});

test('redactStep scrubs the target name and url', () => {
  const step = redactStep({ action: 'click', url: 'https://a.com/u?e=tom@test.com', target: { name: 'call 980-908-3982' } });
  assert.doesNotMatch(step.target.name, /980/);
  assert.doesNotMatch(step.url, /tom@test\.com/);
});

test('looksIdentifying refuses records, allows control labels', () => {
  assert.equal(looksIdentifying('Save client'), false);
  assert.equal(looksIdentifying('Get a Quote'), false);
  assert.equal(looksIdentifying('Row 84213'), true); // has digits
  assert.equal(looksIdentifying(''), true);
  assert.equal(looksIdentifying('x'.repeat(80)), true); // too long
});
