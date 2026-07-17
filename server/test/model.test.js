import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize, unverifiedGuidance, resolveGuidance, actionsIn, durationOf } from '../src/model.js';

test('normalize backfills evidence for legacy single-action steps', () => {
  const sop = normalize({ steps: [{ index: 1, action: 'click', target: { name: 'X' }, title: 'T', detail: 'D' }] });
  assert.equal(sop.steps[0].evidence.length, 1);
  assert.equal(sop.steps[0].evidence[0].action, 'click');
});

test('normalize drops a non-image keyframe', () => {
  const good = normalize({ steps: [{ index: 1, keyframe: 'data:image/jpeg;base64,AAAA', action: 'click' }] });
  const bad = normalize({ steps: [{ index: 1, keyframe: 'https://evil.example/x.gif', action: 'click' }] });
  assert.equal(good.steps[0].keyframe, 'data:image/jpeg;base64,AAAA');
  assert.equal(bad.steps[0].keyframe, null);
});

test('reference rows get stable ids and survive removal of a sibling', () => {
  const sop = normalize({ prerequisites: [{ item: 'A' }, { item: 'B' }, { item: 'C' }] });
  const gids = sop.prerequisites.map((r) => r.gid);
  assert.equal(new Set(gids).size, 3);

  resolveGuidance(sop, { gid: gids[1], keep: false }); // remove B
  assert.deepEqual(sop.prerequisites.map((r) => r.item), ['A', 'C']);
  // The surviving rows keep their original ids.
  assert.deepEqual(sop.prerequisites.map((r) => r.gid), [gids[0], gids[2]]);
});

test('keeping a step guidance claim verifies it; removing records the rejection', () => {
  const sop = normalize({ steps: [{ index: 1, action: 'click', guidance: { whyItMatters: 'because' } }] });
  const gid = unverifiedGuidance(sop)[0].gid;
  assert.equal(gid, 'step-1');

  const kept = normalize(JSON.parse(JSON.stringify(sop)));
  resolveGuidance(kept, { gid: 'step-1', keep: true });
  assert.equal(kept.steps[0].guidance.verified, true);

  resolveGuidance(sop, { gid: 'step-1', keep: false });
  assert.equal(sop.steps[0].guidance, null);
  assert.equal(sop.steps[0].guidanceRemoved, true);
});

test('actionsIn and durationOf read from evidence', () => {
  const sop = normalize({
    steps: [
      { index: 1, action: 'click', t: 0, evidence: [{ action: 'click', t: 0 }] },
      { index: 2, action: 'change', t: 1000, evidence: [{ action: 'change', t: 1000 }, { action: 'change', t: 32000 }] },
    ],
  });
  assert.equal(actionsIn(sop), 3);
  assert.equal(durationOf(sop), 32000);
});
