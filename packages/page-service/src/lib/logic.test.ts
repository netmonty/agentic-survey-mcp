import { test } from 'node:test';
import assert from 'node:assert/strict';
import { visibleQuestionIds, evalCondition } from './logic';
import type { Question, AnswerValue, QuestionLogic } from './types';

function q(id: string, position: number, logic?: QuestionLogic): Question {
  return { id, surveyId: 's', position, type: 'short_text', prompt: id, required: false, config: {}, logic };
}

const single = (optionId: string): AnswerValue => ({
  kind: 'single_choice',
  selection: { optionId, label: optionId },
});
const multi = (...ids: string[]): AnswerValue => ({
  kind: 'multi_choice',
  selections: ids.map((id) => ({ optionId: id, label: id })),
});
const rating = (value: number): AnswerValue => ({ kind: 'rating', value });
const yesno = (value: boolean): AnswerValue => ({ kind: 'yes_no', value });

test('no logic → always visible', () => {
  const qs = [q('a', 0), q('b', 1)];
  const vis = visibleQuestionIds(qs, new Map());
  assert.deepEqual([...vis].sort(), ['a', 'b']);
});

test('show-when single_choice equals', () => {
  const qs = [
    q('a', 0),
    q('b', 1, { action: 'show', match: 'all', conditions: [{ questionId: 'a', op: 'equals', value: 'yes' }] }),
  ];
  assert.ok(!visibleQuestionIds(qs, new Map([['a', single('no')]])).has('b'));
  assert.ok(visibleQuestionIds(qs, new Map([['a', single('yes')]])).has('b'));
  // unanswered controller → show-when condition fails → hidden
  assert.ok(!visibleQuestionIds(qs, new Map()).has('b'));
});

test('hide-when rating gte', () => {
  const qs = [
    q('a', 0),
    q('b', 1, { action: 'hide', match: 'all', conditions: [{ questionId: 'a', op: 'gte', value: 4 }] }),
  ];
  assert.ok(!visibleQuestionIds(qs, new Map([['a', rating(5)]])).has('b')); // hidden
  assert.ok(visibleQuestionIds(qs, new Map([['a', rating(2)]])).has('b')); // shown
});

test('match any vs all', () => {
  const conds = [
    { questionId: 'a', op: 'equals' as const, value: 'x' },
    { questionId: 'c', op: 'equals' as const, value: 'y' },
  ];
  const any = [q('a', 0), q('c', 1), q('b', 2, { action: 'show', match: 'any', conditions: conds })];
  const all = [q('a', 0), q('c', 1), q('b', 2, { action: 'show', match: 'all', conditions: conds })];
  const onlyA = new Map<string, AnswerValue>([['a', single('x')], ['c', single('z')]]);
  assert.ok(visibleQuestionIds(any, onlyA).has('b'));
  assert.ok(!visibleQuestionIds(all, onlyA).has('b'));
});

test('multi_choice includes', () => {
  const qs = [
    q('a', 0),
    q('b', 1, { action: 'show', match: 'all', conditions: [{ questionId: 'a', op: 'includes', value: 'opt2' }] }),
  ];
  assert.ok(visibleQuestionIds(qs, new Map([['a', multi('opt1', 'opt2')]])).has('b'));
  assert.ok(!visibleQuestionIds(qs, new Map([['a', multi('opt1')]])).has('b'));
});

test('answered / not_answered', () => {
  const qs = [
    q('a', 0),
    q('b', 1, { action: 'show', match: 'all', conditions: [{ questionId: 'a', op: 'answered' }] }),
  ];
  assert.ok(visibleQuestionIds(qs, new Map([['a', yesno(true)]])).has('b'));
  assert.ok(!visibleQuestionIds(qs, new Map()).has('b'));
});

test('chained: dependency on a hidden question is treated as unanswered', () => {
  // b shows only when a == yes; c shows only when b answered.
  const qs = [
    q('a', 0),
    q('b', 1, { action: 'show', match: 'all', conditions: [{ questionId: 'a', op: 'equals', value: 'yes' }] }),
    q('c', 2, { action: 'show', match: 'all', conditions: [{ questionId: 'b', op: 'answered' }] }),
  ];
  // a=no → b hidden → even with a stale b answer, c stays hidden.
  const vis = visibleQuestionIds(qs, new Map([['a', single('no')], ['b', single('whatever')]]));
  assert.ok(!vis.has('b'));
  assert.ok(!vis.has('c'));
});

test('slider behaves numerically in logic', () => {
  const slider = (value: number): AnswerValue => ({ kind: 'slider', value });
  assert.ok(evalCondition({ questionId: 'a', op: 'gte', value: 50 }, slider(80)));
  assert.ok(!evalCondition({ questionId: 'a', op: 'gte', value: 50 }, slider(20)));
});

test('date / time compare as ordered strings', () => {
  const date = (v: string): AnswerValue => ({ kind: 'date', value: v });
  const time = (v: string): AnswerValue => ({ kind: 'time', value: v });
  assert.ok(evalCondition({ questionId: 'a', op: 'gt', value: '2026-01-01' }, date('2026-06-12')));
  assert.ok(evalCondition({ questionId: 'a', op: 'equals', value: '09:30' }, time('09:30')));
  assert.ok(evalCondition({ questionId: 'a', op: 'lt', value: '12:00' }, time('09:30')));
});

test('evalCondition not_equals on yes_no', () => {
  assert.ok(evalCondition({ questionId: 'a', op: 'not_equals', value: false }, yesno(true)));
  assert.ok(!evalCondition({ questionId: 'a', op: 'not_equals', value: true }, yesno(true)));
});
