import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../src/model.js';
import { applyAnswers, applyGuidance, approve } from '../src/revise.js';

test('a step-scoped answer folds in and marks its question answered', () => {
  const sop = normalize({
    steps: [{ index: 2, action: 'change', target: { tag: 'select', name: 'Account type' }, title: 'T', detail: 'Pick a type.' }],
    suggestedQuestions: [{ stepIndex: 2, text: 'Which type?' }],
  });
  applyAnswers(sop, [{ stepIndex: 2, question: 'Which type?', text: 'Business for referrals.' }]);
  assert.match(sop.steps[0].detail, /Business for referrals\./);
  assert.equal(sop.suggestedQuestions[0].answered, true);
});

test('approve is blocked while guidance is unverified, and the error is exposable', () => {
  const sop = normalize({ steps: [{ index: 1, action: 'click', guidance: { whyItMatters: 'x' } }], suggestedQuestions: [] });
  assert.throws(
    () => approve(sop),
    (err) => err.expose === true && /guidance/.test(err.message)
  );
  assert.notEqual(sop.status, 'approved');
});

test('approve succeeds once guidance is settled', () => {
  const sop = normalize({ steps: [{ index: 1, action: 'click' }], suggestedQuestions: [] });
  applyGuidance(sop, []); // nothing to settle
  approve(sop);
  assert.equal(sop.status, 'approved');
});

test('editing an approved SOP demotes it to a draft', () => {
  const sop = normalize({ status: 'approved', approvedAt: 1, steps: [{ index: 1, action: 'click' }], suggestedQuestions: [], prerequisites: [{ item: 'A' }] });
  const gid = sop.prerequisites[0].gid;
  applyGuidance(sop, [{ gid, keep: true }]);
  assert.equal(sop.status, 'candidate');
  assert.equal(sop.approvedAt, undefined);
});
