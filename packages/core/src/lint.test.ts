import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSurvey } from './lint.js';
import type { Question, QuestionLogic } from '@agentic-survey/schema';

function q(
  id: string,
  position: number,
  over: Partial<Question> = {},
): Question {
  return {
    id,
    surveyId: 's',
    position,
    type: 'short_text',
    prompt: id,
    required: false,
    config: {},
    logic: null,
    ...over,
  };
}

const choice = (id: string, position: number, opts: string[], logic: QuestionLogic | null = null): Question =>
  q(id, position, { type: 'single_choice', config: { options: opts.map((o) => ({ id: o, label: o })) }, logic });

test('clean survey → no issues', () => {
  const qs = [
    choice('a', 0, ['yes', 'no']),
    q('b', 1, { logic: { action: 'show', match: 'all', conditions: [{ questionId: 'a', op: 'equals', value: 'yes' }] } }),
  ];
  assert.deepEqual(validateSurvey(qs), []);
});

test('forward reference is an error', () => {
  const qs = [
    q('a', 0, { logic: { action: 'show', match: 'all', conditions: [{ questionId: 'b', op: 'answered' }] } }),
    q('b', 1),
  ];
  const codes = validateSurvey(qs).map((i) => i.code);
  assert.ok(codes.includes('forward_reference'));
});

test('dangling reference is an error', () => {
  const qs = [
    q('a', 0),
    q('b', 1, { logic: { action: 'show', match: 'all', conditions: [{ questionId: 'ghost', op: 'answered' }] } }),
  ];
  const errs = validateSurvey(qs).filter((i) => i.level === 'error');
  assert.equal(errs[0].code, 'dangling_reference');
});

test('unknown option id → can never show', () => {
  const qs = [
    choice('a', 0, ['yes', 'no']),
    q('b', 1, { logic: { action: 'show', match: 'all', conditions: [{ questionId: 'a', op: 'equals', value: 'maybe' }] } }),
  ];
  const codes = validateSurvey(qs).map((i) => i.code);
  assert.ok(codes.includes('unknown_option'));
});

test('choice question with no options is an error', () => {
  const codes = validateSurvey([choice('a', 0, [])]).map((i) => i.code);
  assert.ok(codes.includes('no_options'));
});

test('numeric op on non-numeric target warns; bad operand errors', () => {
  const qs = [
    choice('a', 0, ['x']),
    q('b', 1, { logic: { action: 'show', match: 'all', conditions: [{ questionId: 'a', op: 'gt', value: 'x' }] } }),
  ];
  const issues = validateSurvey(qs);
  assert.ok(issues.some((i) => i.code === 'op_type_mismatch' && i.level === 'warning'));
  assert.ok(issues.some((i) => i.code === 'bad_operand' && i.level === 'error'));
});

test('empty conditions warns', () => {
  const qs = [q('a', 0, { logic: { action: 'show', match: 'all', conditions: [] } })];
  assert.equal(validateSurvey(qs)[0].code, 'empty_logic');
});
