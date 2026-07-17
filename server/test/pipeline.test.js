import { test } from 'node:test';
import assert from 'node:assert/strict';
import { segment } from '../src/segment.js';
import { consolidate } from '../src/consolidate.js';
import { creditsFor } from '../src/usage.js';

const recording = {
  events: [
    { seq: 0, type: 'click', url: 'https://a.com/list', at: 1000, target: { tag: 'button', name: 'New' } },
    { seq: 1, type: 'change', url: 'https://a.com/new', at: 2000, target: { tag: 'input', name: 'Name' } },
    { seq: 2, type: 'change', url: 'https://a.com/new', at: 3000, target: { tag: 'input', name: 'Email' } },
    { seq: 3, type: 'submit', url: 'https://a.com/new', at: 4000, target: { tag: 'button', name: 'Save' } },
  ],
};

test('segment inserts navigation steps and offsets from start', () => {
  const steps = segment(recording);
  const nav = steps.filter((s) => s.action === 'navigate');
  assert.equal(nav.length, 2); // /list then /new
  assert.equal(steps[0].t, 0);
});

test('consolidate merges a run of field changes on one page into one group', () => {
  const groups = consolidate(segment(recording));
  // The two consecutive change events on /new collapse into a single group.
  const fillGroup = groups.find((g) => g.actions.length === 2 && g.actions.every((a) => a.action === 'change'));
  assert.ok(fillGroup, 'expected the two field changes to be one group');
});

test('a click is a boundary, never merged into a fill run', () => {
  const groups = consolidate(segment(recording));
  for (const g of groups) {
    const hasClick = g.actions.some((a) => a.action === 'click');
    if (hasClick) assert.equal(g.actions.length, 1);
  }
});

test('creditsFor is 1 for a short, small recording and scales with size', () => {
  const small = { steps: [{ index: 1, t: 0, evidence: [{ t: 0 }] }] };
  assert.equal(creditsFor(small), 1);

  const big = { steps: Array.from({ length: 90 }, (_, i) => ({ index: i + 1, t: i * 1000, evidence: [{ t: i * 1000 }] })) };
  assert.ok(creditsFor(big) >= 2, 'a 90-action recording should cost more than one credit');
});
